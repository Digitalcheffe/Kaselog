using KaseLog.Api.Data;
using KaseLog.Api.Data.Sqlite;
using KaseLog.Api.Middleware;
using KaseLog.Api.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.OpenApi.Models;
using System.Reflection;

var builder = WebApplication.CreateBuilder(args);

var port      = Environment.GetEnvironmentVariable("KASELOG_PORT")         ?? "5000";
var dbProvider = Environment.GetEnvironmentVariable("KASELOG_DB_PROVIDER") ?? "sqlite";
var dataPath  = Environment.GetEnvironmentVariable("KASELOG_DATA_PATH")    ?? "/data/kaselog.db";
var connStringEnv = Environment.GetEnvironmentVariable("KASELOG_CONNECTION_STRING");
var connString = !string.IsNullOrEmpty(connStringEnv)
                 ? connStringEnv
                 : $"Data Source={dataPath};";

builder.WebHost.UseUrls($"http://*:{port}");

// ── Image storage ─────────────────────────────────────────────────────────────
var dataDir   = Path.GetDirectoryName(dataPath) ?? "/data";
var imagesDir = Path.Combine(dataDir, "images");
builder.Services.AddSingleton(new ImageStorageOptions(imagesDir));

// ── Database provider ─────────────────────────────────────────────────────────
if (dbProvider.Equals("sqlite", StringComparison.OrdinalIgnoreCase))
{
    builder.Services.AddSingleton<IDbConnectionFactory>(
        new SqliteConnectionFactory(connString));
    builder.Services.AddSingleton<ISchemaInitializer, SqliteSchemaInitializer>();
    builder.Services.AddSingleton<ISeedInitializer,   SqliteSeedInitializer>();
    builder.Services.AddScoped<IKaseRepository,       SqliteKaseRepository>();
    builder.Services.AddScoped<ILogRepository,        SqliteLogRepository>();
    builder.Services.AddScoped<ITagRepository,        SqliteTagRepository>();
    builder.Services.AddScoped<ISearchRepository,     SqliteSearchRepository>();
    builder.Services.AddScoped<IUserRepository,       SqliteUserRepository>();
    builder.Services.AddScoped<ICollectionRepository, SqliteCollectionRepository>();
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
                    type   = "https://tools.ietf.org/html/rfc7807",
                    title  = "Validation failed",
                    status = 400,
                    detail = "One or more validation errors occurred.",
                    errors,
                },
                meta = (object?)null,
            };

            return new BadRequestObjectResult(response);
        };
    });

// ── Swagger / OpenAPI ─────────────────────────────────────────────────────────
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new OpenApiInfo
    {
        Title       = "KaseLog API",
        Version     = "v1",
        Description = "KaseLog is a private ops journal for the solo technical operator. " +
                      "Open a Kase when something needs attention, and write Logs as the work unfolds.",
    });

    var xmlFile = $"{Assembly.GetExecutingAssembly().GetName().Name}.xml";
    var xmlPath = Path.Combine(AppContext.BaseDirectory, xmlFile);
    if (File.Exists(xmlPath))
        options.IncludeXmlComments(xmlPath);
});

// ── Build app ─────────────────────────────────────────────────────────────────
var app = builder.Build();

var startupLogger = app.Services
    .GetRequiredService<ILoggerFactory>()
    .CreateLogger("KaseLog.Startup");

// ── [INIT] ────────────────────────────────────────────────────────────────────
var version = Assembly.GetExecutingAssembly().GetName().Version?.ToString(3) ?? "1.0.0";
startupLogger.LogInformation(
    "[INIT] Application starting — version: {Version}, environment: {Env}, KASELOG_PORT: {Port}, KASELOG_DB_PROVIDER: {Provider}",
    version, app.Environment.EnvironmentName, port, dbProvider);

// ── [DB] ──────────────────────────────────────────────────────────────────────
try
{
    startupLogger.LogInformation(
        "[DB] Opening database connection — KASELOG_DATA_PATH: {DataPath}", dataPath);

    var schemaInitializer = app.Services.GetRequiredService<ISchemaInitializer>();

    startupLogger.LogInformation("[DB] Initializing schema");
    bool isFreshDb = await schemaInitializer.InitializeAsync();
    startupLogger.LogInformation(
        "[DB] Schema initialized — {Status}",
        isFreshDb ? "fresh database" : "existing database");

    startupLogger.LogInformation("[DB] WAL mode and foreign keys verified");
}
catch (Exception ex)
{
    startupLogger.LogCritical("[FATAL] [DB] {Message}", ex.Message);
    Environment.Exit(1);
}

// ── [STORAGE] ─────────────────────────────────────────────────────────────────
try
{
    bool imagesDirExisted = Directory.Exists(imagesDir);
    Directory.CreateDirectory(imagesDir);
    startupLogger.LogInformation(
        "[STORAGE] {ImagesDir} — {Status}",
        imagesDir, imagesDirExisted ? "already exists" : "created");
}
catch (Exception ex)
{
    startupLogger.LogCritical("[FATAL] [STORAGE] {Message}", ex.Message);
    Environment.Exit(1);
}

// ── [SEED] ────────────────────────────────────────────────────────────────────
try
{
    startupLogger.LogInformation("[SEED] Checking first-run seed");
    var seedInitializer = app.Services.GetRequiredService<ISeedInitializer>();
    await seedInitializer.SeedAsync();
}
catch (Exception ex)
{
    startupLogger.LogCritical("[FATAL] [SEED] {Message}", ex.Message);
    Environment.Exit(1);
}

// ── Middleware ─────────────────────────────────────────────────────────────────
app.UseMiddleware<RequestLoggingMiddleware>();
app.UseSwagger();
app.UseSwaggerUI(c => c.SwaggerEndpoint("/swagger/v1/swagger.json", "KaseLog API v1"));
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

// ── [READY] ──────────────────────────────────────────────────────────────────
startupLogger.LogInformation("[READY] Listening on http://*:{Port}", port);
app.Run();

// Expose Program for WebApplicationFactory in integration tests
public partial class Program { }
