var builder = WebApplication.CreateBuilder(args);

var port = Environment.GetEnvironmentVariable("KASELOG_PORT") ?? "5000";
builder.WebHost.UseUrls($"http://*:{port}");

builder.Services.AddControllers();

var app = builder.Build();

// Serve React static files (wwwroot) in production
app.UseDefaultFiles();
app.UseStaticFiles();

app.MapControllers();

// SPA fallback — return index.html for any unmatched route
app.MapFallbackToFile("index.html");

app.Run();

// Expose Program for WebApplicationFactory in tests
public partial class Program { }
