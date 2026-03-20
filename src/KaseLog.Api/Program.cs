using KaseLog.Api.Data;
using KaseLog.Api.Data.Sqlite;
using Microsoft.AspNetCore.Mvc;

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

if (dbProvider.Equals("sqlite", StringComparison.OrdinalIgnoreCase))
{
    builder.Services.AddSingleton<IDbConnectionFactory>(
        new SqliteConnectionFactory(connString));
    builder.Services.AddSingleton<ISchemaInitializer, SqliteSchemaInitializer>();
    builder.Services.AddScoped<IKaseRepository, SqliteKaseRepository>();
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

var app = builder.Build();

// ── Data directories ─────────────────────────────────────────────────────────
var dataDir = Path.GetDirectoryName(dataPath) ?? "/data";
Directory.CreateDirectory(Path.Combine(dataDir, "images"));

// ── Schema initialization ─────────────────────────────────────────────────────
var schemaInitializer = app.Services.GetRequiredService<ISchemaInitializer>();
await schemaInitializer.InitializeAsync();

// ── Middleware ────────────────────────────────────────────────────────────────
app.UseDefaultFiles();
app.UseStaticFiles();

app.MapControllers();

// Health check — no database dependency
app.MapGet("/health", () => Results.Ok(new { status = "ok", version = "1.0.0" }));

// SPA fallback — return index.html for any unmatched route
app.MapFallbackToFile("index.html");

app.Run();

// Expose Program for WebApplicationFactory in integration tests
public partial class Program { }
