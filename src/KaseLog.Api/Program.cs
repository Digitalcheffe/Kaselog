using KaseLog.Api.Data;
using KaseLog.Api.Data.Sqlite;
using KaseLog.Api.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.OpenApi.Models;
using System.Reflection;

var builder = WebApplication.CreateBuilder(args);

var port = Environment.GetEnvironmentVariable("KASELOG_PORT") ?? "5000";
builder.WebHost.UseUrls($"http://*:{port}");

// ── Database ─────────────────────────────────────────────────────────────────
var dbProvider = Environment.GetEnvironmentVariable("KASELOG_DB_PROVIDER") ?? "sqlite";
var dataPath   = Environment.GetEnvironmentVariable("KASELOG_DATA_PATH")   ?? "/data/kaselog.db";
var connStringEnv = Environment.GetEnvironmentVariable("KASELOG_CONNECTION_STRING");
var connString = !string.IsNullOrEmpty(connStringEnv)
                 ? connStringEnv
                 : $"Data Source={dataPath};";

// ── Image storage ─────────────────────────────────────────────────────────────
var dataDir = Path.GetDirectoryName(dataPath) ?? "/data";
var imagesDir = Path.Combine(dataDir, "images");
builder.Services.AddSingleton(new ImageStorageOptions(imagesDir));

if (dbProvider.Equals("sqlite", StringComparison.OrdinalIgnoreCase))
{
    builder.Services.AddSingleton<IDbConnectionFactory>(
        new SqliteConnectionFactory(connString));
    builder.Services.AddSingleton<ISchemaInitializer, SqliteSchemaInitializer>();
    builder.Services.AddScoped<IKaseRepository, SqliteKaseRepository>();
    builder.Services.AddScoped<ILogRepository, SqliteLogRepository>();
    builder.Services.AddScoped<ITagRepository, SqliteTagRepository>();
}
else
{
    throw new InvalidOperationException($"Unsupported database provider: '{dbProvider}'.");
}

builder.Services.AddControllers()
    .ConfigureApiBehaviorOptions(options =>
    {
        options.InvalidModelStateResponseFactory = context =>
        {
            var errors = context.ModelState
                .Where(x => x.Value?.Errors.Count > 0)
                .ToDictionary(
                    x => x.Key,
                    x => x.Value!.Errors.Select(e => e.ErrorMessage).ToArray());

            var response = new
            {
                data = (object?)null,
                error = new
                {
                    type = "https://tools.ietf.org/html/rfc7807",
                    title = "Validation failed",
                    status = 400,
                    detail = "One or more validation errors occurred.",
                    errors,
                },
                meta = (object?)null,
            };

            return new BadRequestObjectResult(response);
        };
    });

// ── Swagger / OpenAPI (development only) ─────────────────────────────────────
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "KaseLog API",
        Version = "v1",
        Description = "KaseLog is a private ops journal for the solo technical operator. " +
                      "Open a Kase when something needs attention, and write Logs as the work unfolds.",
    });

    var xmlFile = $"{Assembly.GetExecutingAssembly().GetName().Name}.xml";
    var xmlPath = Path.Combine(AppContext.BaseDirectory, xmlFile);
    if (File.Exists(xmlPath))
        options.IncludeXmlComments(xmlPath);
});

var app = builder.Build();

// ── Data directories ─────────────────────────────────────────────────────────
Directory.CreateDirectory(imagesDir);

// ── Schema initialization ─────────────────────────────────────────────────────
var schemaInitializer = app.Services.GetRequiredService<ISchemaInitializer>();
await schemaInitializer.InitializeAsync();

// ── Swagger UI ────────────────────────────────────────────────────────────────
app.UseSwagger();
app.UseSwaggerUI(c => c.SwaggerEndpoint("/swagger/v1/swagger.json", "KaseLog API v1"));

// ── Middleware ────────────────────────────────────────────────────────────────
app.UseDefaultFiles();
app.UseStaticFiles();

app.MapControllers();

// Health check — no database dependency
app.MapGet("/health", () => Results.Ok(new { status = "ok", version = "1.0.0" }))
   .WithName("Health")
   .WithSummary("Returns API health status.")
   .WithTags("Health");

// SPA fallback — return index.html for any unmatched route
app.MapFallbackToFile("index.html");

app.Run();

// Expose Program for WebApplicationFactory in integration tests
public partial class Program { }
