using KaseLog.Api;
using KaseLog.Api.Data;
using KaseLog.Api.Data.Sqlite;
using KaseLog.Api.Middleware;
using KaseLog.Api.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.OpenApi.Models;
using System.Reflection;

var builder = WebApplication.CreateBuilder(args);

builder.Logging.AddSimpleConsole(opts =>
{
    opts.SingleLine       = true;
    opts.IncludeScopes    = false;
    opts.TimestampFormat  = null;
    opts.UseUtcTimestamp  = true;
});

var port         = Environment.GetEnvironmentVariable("KASELOG_PORT")              ?? "5000";
var dbProvider   = Environment.GetEnvironmentVariable("KASELOG_DB_PROVIDER")       ?? "sqlite";
var dataPath     = Environment.GetEnvironmentVariable("KASELOG_DATA_PATH")         ?? "/data/kaselog.db";
var connStringEnv = Environment.GetEnvironmentVariable("KASELOG_CONNECTION_STRING");
var connString   = !string.IsNullOrEmpty(connStringEnv)
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

var version = Assembly.GetExecutingAssembly().GetName().Version?.ToString(3) ?? "1.0.0";

// ── Schema ────────────────────────────────────────────────────────────────────
SchemaInitResult schemaResult;
try
{
    var schemaInit = app.Services.GetRequiredService<ISchemaInitializer>();
    schemaResult = await schemaInit.InitializeAsync();
}
catch (Exception ex)
{
    // Database is unreachable — treat all tables as missing.
    var logger = app.Services.GetRequiredService<ILoggerFactory>()
        .CreateLogger("KaseLog.Startup");
    logger.LogCritical(ex, "Database unreachable during schema init");

    schemaResult = new SchemaInitResult(0,
        ["Kases", "Logs", "LogVersions", "Tags", "LogTags",
         "Collections", "CollectionFields", "CollectionLayout", "CollectionItems", "kaselog_search"]);
}

// ── Images directory ──────────────────────────────────────────────────────────
string imagesStatus;
bool   imagesFailed = false;
try
{
    bool existed = Directory.Exists(imagesDir);
    Directory.CreateDirectory(imagesDir);
    imagesStatus = existed
        ? $"{Directory.GetFiles(imagesDir).Length} files"
        : "created";
}
catch (Exception ex)
{
    var logger = app.Services.GetRequiredService<ILoggerFactory>()
        .CreateLogger("KaseLog.Startup");
    logger.LogCritical(ex, "Cannot create images directory: {ImagesDir}", imagesDir);

    imagesStatus = "ERROR — not writable";
    imagesFailed = true;
}

// ── Seed ──────────────────────────────────────────────────────────────────────
SeedStatus seedStatus;
try
{
    var seedInit = app.Services.GetRequiredService<ISeedInitializer>();
    seedStatus = await seedInit.SeedAsync();
}
catch (Exception ex)
{
    var logger = app.Services.GetRequiredService<ILoggerFactory>()
        .CreateLogger("KaseLog.Startup");
    logger.LogError(ex, "Seed transaction failed");
    seedStatus = SeedStatus.Error;
}

// ── Startup banner ────────────────────────────────────────────────────────────
var bannerCtx = new StartupContext(
    Version:      version,
    Port:         port,
    DatabasePath: dataPath,
    DbProvider:   dbProvider,
    Schema:       schemaResult,
    ImagesDir:    imagesDir,
    ImagesStatus: imagesStatus,
    ImagesFailed: imagesFailed,
    Seed:         seedStatus,
    StartedAt:    DateTime.UtcNow
);

StartupBanner.Print(bannerCtx);

if (!schemaResult.IsOk || imagesFailed)
{
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

app.Run();

// Expose Program for WebApplicationFactory in integration tests
public partial class Program { }
