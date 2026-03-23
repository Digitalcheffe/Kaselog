using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using KaseLog.Api.Data;
using KaseLog.Api.Data.Sqlite;
using KaseLog.Api.Tests;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Data.Sqlite;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace KaseLog.Api.Tests.Controllers;

/// <summary>
/// Integration tests for GET /api/logs/{id}/export.
/// </summary>
public sealed class LogExportControllerTests : IAsyncLifetime
{
    private readonly string _dbName;
    private string _testConnString = null!;
    private SqliteConnection _keepAlive = null!;
    private WebApplicationFactory<Program> _factory = null!;
    private HttpClient _client = null!;

    public LogExportControllerTests()
    {
        _dbName = $"LogExportTest_{Guid.NewGuid():N}";
    }

    public async Task InitializeAsync()
    {
        _testConnString = $"Data Source={_dbName};Mode=Memory;Cache=Shared";
        _keepAlive      = new SqliteConnection(_testConnString);
        await _keepAlive.OpenAsync();

        var tempDir = Path.Combine(Path.GetTempPath(), _dbName);
        Environment.SetEnvironmentVariable("KASELOG_DATA_PATH",
            Path.Combine(tempDir, "kaselog.db"));

        _factory = new WebApplicationFactory<Program>()
            .WithWebHostBuilder(builder =>
            {
                builder.ConfigureTestServices(services =>
                {
                    var descriptor = services.SingleOrDefault(
                        d => d.ServiceType == typeof(IDbConnectionFactory));
                    if (descriptor is not null) services.Remove(descriptor);

                    services.AddSingleton<IDbConnectionFactory>(
                        new SqliteConnectionFactory(_testConnString));

                    var seedDescriptor = services.SingleOrDefault(
                        d => d.ServiceType == typeof(ISeedInitializer));
                    if (seedDescriptor is not null) services.Remove(seedDescriptor);

                    services.AddSingleton<ISeedInitializer, NoopSeedInitializer>();
                });
            });

        _client = _factory.CreateClient();
    }

    public async Task DisposeAsync()
    {
        Environment.SetEnvironmentVariable("KASELOG_DATA_PATH", null);
        _client.Dispose();
        await _factory.DisposeAsync();
        await _keepAlive.DisposeAsync();
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private async Task<string> CreateKaseAsync(string title)
    {
        var res = await _client.PostAsJsonAsync("/api/kases", new { title, description = (string?)null });
        res.EnsureSuccessStatusCode();
        var root = JsonDocument.Parse(await res.Content.ReadAsStringAsync()).RootElement;
        return root.GetProperty("data").GetProperty("id").GetString()!;
    }

    private async Task<string> CreateLogAsync(string kaseId, string title, string content)
    {
        var res = await _client.PostAsJsonAsync($"/api/kases/{kaseId}/logs",
            new { title, description = (string?)null, autosaveEnabled = true });
        res.EnsureSuccessStatusCode();
        var root = JsonDocument.Parse(await res.Content.ReadAsStringAsync()).RootElement;
        var logId = root.GetProperty("data").GetProperty("id").GetString()!;

        await _client.PostAsJsonAsync($"/api/logs/{logId}/versions",
            new { content, label = (string?)null, isAutosave = false });

        return logId;
    }

    private async Task AddTagAsync(string logId, string tagName)
    {
        var res = await _client.PostAsJsonAsync($"/api/logs/{logId}/tags", new { name = tagName });
        res.EnsureSuccessStatusCode();
    }

    // ── Tests ─────────────────────────────────────────────────────────────────

    [Fact]
    public async Task Export_Markdown_UnknownLog_Returns404()
    {
        var response = await _client.GetAsync($"/api/logs/{Guid.NewGuid()}/export?format=markdown");
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Export_Pdf_UnknownLog_Returns404()
    {
        var response = await _client.GetAsync($"/api/logs/{Guid.NewGuid()}/export?format=pdf");
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Export_InvalidFormat_Returns400()
    {
        var kaseId = await CreateKaseAsync("Test Kase");
        var logId  = await CreateLogAsync(kaseId, "Test Log", "content");

        var response = await _client.GetAsync($"/api/logs/{logId}/export?format=xlsx");
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Export_Markdown_ValidLog_ReturnsMarkdownFile()
    {
        var kaseId = await CreateKaseAsync("My Kase");
        var logId  = await CreateLogAsync(kaseId, "My Export Log", "## Section\n\nSome log content.");

        var response = await _client.GetAsync($"/api/logs/{logId}/export?format=markdown");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("text/markdown", response.Content.Headers.ContentType?.MediaType);

        var text = await response.Content.ReadAsStringAsync();
        Assert.Contains("My Export Log", text);
        Assert.Contains("Section", text);
        Assert.Contains("log content", text);
    }

    [Fact]
    public async Task Export_Markdown_IncludesKaseName()
    {
        var kaseId = await CreateKaseAsync("The Kase Name");
        var logId  = await CreateLogAsync(kaseId, "My Log", "content");

        var response = await _client.GetAsync($"/api/logs/{logId}/export?format=markdown");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var text = await response.Content.ReadAsStringAsync();
        Assert.Contains("The Kase Name", text);
    }

    [Fact]
    public async Task Export_Markdown_IncludesTags()
    {
        var kaseId = await CreateKaseAsync("Kase");
        var logId  = await CreateLogAsync(kaseId, "Tagged Log", "content");
        await AddTagAsync(logId, "networking");
        await AddTagAsync(logId, "proxmox");

        var response = await _client.GetAsync($"/api/logs/{logId}/export?format=markdown");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var text = await response.Content.ReadAsStringAsync();
        Assert.Contains("networking", text);
        Assert.Contains("proxmox", text);
    }

    [Fact]
    public async Task Export_Markdown_IncludesVersionCountAndTimestamps()
    {
        var kaseId = await CreateKaseAsync("Kase");
        var logId  = await CreateLogAsync(kaseId, "Versioned Log", "v1 content");

        // Add a second version so versionCount > 1
        await _client.PostAsJsonAsync($"/api/logs/{logId}/versions",
            new { content = "v2 content", label = (string?)null, isAutosave = false });

        var response = await _client.GetAsync($"/api/logs/{logId}/export?format=markdown");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var text = await response.Content.ReadAsStringAsync();
        // Versions count should be present
        Assert.Contains("Versions:", text);
        // Created and Last edited dates should be present
        Assert.Contains("Created:", text);
        Assert.Contains("Last edited:", text);
    }

    [Fact]
    public async Task Export_Markdown_DefaultsToMarkdownFormat()
    {
        var kaseId = await CreateKaseAsync("Kase");
        var logId  = await CreateLogAsync(kaseId, "Default Format Log", "content");

        // No format param — should default to markdown
        var response = await _client.GetAsync($"/api/logs/{logId}/export");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("text/markdown", response.Content.Headers.ContentType?.MediaType);
    }

    [Fact]
    public async Task Export_Markdown_FilenameSlugged()
    {
        var kaseId = await CreateKaseAsync("Kase");
        var logId  = await CreateLogAsync(kaseId, "My Cool Log", "content");

        var response = await _client.GetAsync($"/api/logs/{logId}/export?format=markdown");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var disposition = response.Content.Headers.ContentDisposition;
        Assert.NotNull(disposition);
        Assert.EndsWith(".md", disposition!.FileName?.Trim('"'));
        Assert.Contains("log-", disposition!.FileName?.Trim('"'));
    }

    [Fact]
    public async Task Export_Markdown_ContentDispositionHeaderPresent()
    {
        var kaseId = await CreateKaseAsync("Kase");
        var logId  = await CreateLogAsync(kaseId, "Disposition Test Log", "content");

        var response = await _client.GetAsync($"/api/logs/{logId}/export?format=markdown");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var disposition = response.Content.Headers.ContentDisposition;
        Assert.NotNull(disposition);
        Assert.Equal("attachment", disposition!.DispositionType);
    }

    [Fact]
    public async Task Export_Pdf_ValidLog_ReturnsPdfBinary()
    {
        var kaseId = await CreateKaseAsync("PDF Kase");
        var logId  = await CreateLogAsync(kaseId, "PDF Log", "Some content here.");

        var response = await _client.GetAsync($"/api/logs/{logId}/export?format=pdf");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("application/pdf", response.Content.Headers.ContentType?.MediaType);

        var disposition = response.Content.Headers.ContentDisposition;
        Assert.NotNull(disposition);
        Assert.EndsWith(".pdf", disposition!.FileName?.Trim('"'));

        var bytes = await response.Content.ReadAsByteArrayAsync();
        Assert.True(bytes.Length > 0, "PDF should be non-empty");
        // PDF magic bytes: %PDF
        Assert.Equal((byte)'%', bytes[0]);
        Assert.Equal((byte)'P', bytes[1]);
        Assert.Equal((byte)'D', bytes[2]);
        Assert.Equal((byte)'F', bytes[3]);
    }

    [Fact]
    public async Task Export_Pdf_ContentDispositionHeaderPresent()
    {
        var kaseId = await CreateKaseAsync("Kase");
        var logId  = await CreateLogAsync(kaseId, "PDF Disposition Log", "content");

        var response = await _client.GetAsync($"/api/logs/{logId}/export?format=pdf");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var disposition = response.Content.Headers.ContentDisposition;
        Assert.NotNull(disposition);
        Assert.Equal("attachment", disposition!.DispositionType);
    }
}
