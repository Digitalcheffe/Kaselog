using KaseLog.Api.Data;
using KaseLog.Api.Data.Sqlite;

var builder = WebApplication.CreateBuilder(args);

var port = Environment.GetEnvironmentVariable("KASELOG_PORT") ?? "5000";
builder.WebHost.UseUrls($"http://*:{port}");

// ── Database ─────────────────────────────────────────────────────────────────
var dbProvider = Environment.GetEnvironmentVariable("KASELOG_DB_PROVIDER") ?? "sqlite";
var dataPath   = Environment.GetEnvironmentVariable("KASELOG_DATA_PATH")   ?? "/data/kaselog.db";
var connString = Environment.GetEnvironmentVariable("KASELOG_CONNECTION_STRING")
                 ?? $"Data Source={dataPath};";

if (dbProvider.Equals("sqlite", StringComparison.OrdinalIgnoreCase))
{
    builder.Services.AddSingleton<IDbConnectionFactory>(
        new SqliteConnectionFactory(connString));
    builder.Services.AddSingleton<ISchemaInitializer, SqliteSchemaInitializer>();
}
else
{
    throw new InvalidOperationException($"Unsupported database provider: '{dbProvider}'.");
}

builder.Services.AddControllers();

var app = builder.Build();

// ── Schema initialization ─────────────────────────────────────────────────────
var schemaInitializer = app.Services.GetRequiredService<ISchemaInitializer>();
await schemaInitializer.InitializeAsync();

// ── Middleware ────────────────────────────────────────────────────────────────
app.UseDefaultFiles();
app.UseStaticFiles();

app.MapControllers();

// SPA fallback — return index.html for any unmatched route
app.MapFallbackToFile("index.html");

app.Run();

// Expose Program for WebApplicationFactory in integration tests
public partial class Program { }
