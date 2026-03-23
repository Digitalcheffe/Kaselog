using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Dapper;
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
/// Integration tests for GET /api/kases/{id}/export.
/// </summary>
public sealed class KaseExportControllerTests : IAsyncLifetime
{
    private readonly string _dbName;
    private string _testConnString = null!;
    private SqliteConnection _keepAlive = null!;
    private WebApplicationFactory<Program> _factory = null!;
    private HttpClient _client = null!;

    public KaseExportControllerTests()
    {
        _dbName = $"ExportTest_{Guid.NewGuid():N}";
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

    private async Task<string> CreateKaseAsync(string title, string? description = null)
    {
        var res = await _client.PostAsJsonAsync("/api/kases", new { title, description });
        res.EnsureSuccessStatusCode();
        var root = JsonDocument.Parse(await res.Content.ReadAsStringAsync()).RootElement;
        return root.GetProperty("data").GetProperty("id").GetString()!;
    }

    private async Task CreateLogAsync(string kaseId, string title, string content)
    {
        var res = await _client.PostAsJsonAsync($"/api/kases/{kaseId}/logs",
            new { title, description = (string?)null, autosaveEnabled = true });
        res.EnsureSuccessStatusCode();
        var root = JsonDocument.Parse(await res.Content.ReadAsStringAsync()).RootElement;
        var logId = root.GetProperty("data").GetProperty("id").GetString()!;

        // Add a version with content
        await _client.PostAsJsonAsync($"/api/logs/{logId}/versions",
            new { content, label = (string?)null, isAutosave = false });
    }

    private async Task<string> CreateCollectionAsync(string title)
    {
        var res = await _client.PostAsJsonAsync("/api/collections",
            new { title, color = "teal" });
        res.EnsureSuccessStatusCode();
        var root = JsonDocument.Parse(await res.Content.ReadAsStringAsync()).RootElement;
        return root.GetProperty("data").GetProperty("id").GetString()!;
    }

    private async Task<string> AddFieldAsync(string collectionId, string name, string type)
    {
        var res = await _client.PostAsJsonAsync($"/api/collections/{collectionId}/fields",
            new { name, type, required = false, showInList = true, options = (string[]?)null });
        res.EnsureSuccessStatusCode();
        var root = JsonDocument.Parse(await res.Content.ReadAsStringAsync()).RootElement;
        return root.GetProperty("data").GetProperty("id").GetString()!;
    }

    private async Task CreateItemLinkedToKaseAsync(string collectionId, string kaseId, string fieldId, string fieldValue)
    {
        var fieldValues = new Dictionary<string, object> { [fieldId] = fieldValue };
        var res = await _client.PostAsJsonAsync($"/api/collections/{collectionId}/items",
            new { kaseId, fieldValues });
        res.EnsureSuccessStatusCode();
    }

    // ── Tests ─────────────────────────────────────────────────────────────────

    [Fact]
    public async Task Export_Markdown_UnknownKase_Returns404()
    {
        var response = await _client.GetAsync($"/api/kases/{Guid.NewGuid()}/export?format=markdown");
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Export_Pdf_UnknownKase_Returns404()
    {
        var response = await _client.GetAsync($"/api/kases/{Guid.NewGuid()}/export?format=pdf");
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Export_InvalidFormat_Returns400()
    {
        var kaseId = await CreateKaseAsync("Test Kase");
        var response = await _client.GetAsync($"/api/kases/{kaseId}/export?format=xlsx");
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Export_Markdown_ValidKase_ReturnsMarkdownFile()
    {
        var kaseId = await CreateKaseAsync("My Export Kase", "A description for testing");
        await CreateLogAsync(kaseId, "First Log", "## Hello\n\nThis is the log content.");

        var response = await _client.GetAsync($"/api/kases/{kaseId}/export?format=markdown");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("text/markdown", response.Content.Headers.ContentType?.MediaType);

        var disposition = response.Content.Headers.ContentDisposition;
        Assert.NotNull(disposition);
        Assert.EndsWith(".md", disposition!.FileName?.Trim('"'));

        var text = await response.Content.ReadAsStringAsync();
        Assert.Contains("My Export Kase", text);
        Assert.Contains("First Log", text);
        Assert.Contains("Hello", text);
        Assert.Contains("log content", text);
    }

    [Fact]
    public async Task Export_Markdown_IncludesAllLogs()
    {
        var kaseId = await CreateKaseAsync("Multi Log Kase");
        await CreateLogAsync(kaseId, "Alpha Log", "Content Alpha");
        await CreateLogAsync(kaseId, "Beta Log", "Content Beta");

        var response = await _client.GetAsync($"/api/kases/{kaseId}/export?format=markdown");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var text = await response.Content.ReadAsStringAsync();
        Assert.Contains("Alpha Log", text);
        Assert.Contains("Beta Log", text);
        Assert.Contains("Content Alpha", text);
        Assert.Contains("Content Beta", text);
    }

    [Fact]
    public async Task Export_Markdown_DefaultsToMarkdownFormat()
    {
        var kaseId = await CreateKaseAsync("Default Format Kase");
        // No format query param — should default to markdown
        var response = await _client.GetAsync($"/api/kases/{kaseId}/export");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var text = await response.Content.ReadAsStringAsync();
        Assert.Contains("Default Format Kase", text);
    }

    [Fact]
    public async Task Export_Pdf_ValidKase_ReturnsPdfBinary()
    {
        var kaseId = await CreateKaseAsync("PDF Kase", "PDF export test");
        await CreateLogAsync(kaseId, "Log One", "Some content here.");

        var response = await _client.GetAsync($"/api/kases/{kaseId}/export?format=pdf");
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
    public async Task Export_Markdown_IncludesCollectionItemsAppendix()
    {
        var kaseId       = await CreateKaseAsync("Kase With Items");
        var colId        = await CreateCollectionAsync("Gear");
        var fieldId      = await AddFieldAsync(colId, "Name", "text");
        await CreateItemLinkedToKaseAsync(colId, kaseId, fieldId, "Canon R5");

        var response = await _client.GetAsync($"/api/kases/{kaseId}/export?format=markdown");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var text = await response.Content.ReadAsStringAsync();
        Assert.Contains("Collection Items", text);
        Assert.Contains("Gear", text);
        Assert.Contains("Canon R5", text);
    }

    [Fact]
    public async Task Export_Pdf_IncludesCollectionItemsAppendix()
    {
        var kaseId  = await CreateKaseAsync("PDF With Items");
        var colId   = await CreateCollectionAsync("Books");
        var fieldId = await AddFieldAsync(colId, "Title", "text");
        await CreateItemLinkedToKaseAsync(colId, kaseId, fieldId, "The Phoenix Project");

        var response = await _client.GetAsync($"/api/kases/{kaseId}/export?format=pdf");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var bytes = await response.Content.ReadAsByteArrayAsync();
        Assert.True(bytes.Length > 0);
        // Valid PDF header
        Assert.Equal((byte)'%', bytes[0]);
    }

    [Fact]
    public async Task Export_Markdown_ContentDispositionHeaderPresent()
    {
        var kaseId = await CreateKaseAsync("Disposition Test");

        var response = await _client.GetAsync($"/api/kases/{kaseId}/export?format=markdown");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var disposition = response.Content.Headers.ContentDisposition;
        Assert.NotNull(disposition);
        Assert.Equal("attachment", disposition!.DispositionType);
    }

    [Fact]
    public async Task Export_Pdf_ContentDispositionHeaderPresent()
    {
        var kaseId = await CreateKaseAsync("PDF Disposition Test");

        var response = await _client.GetAsync($"/api/kases/{kaseId}/export?format=pdf");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var disposition = response.Content.Headers.ContentDisposition;
        Assert.NotNull(disposition);
        Assert.Equal("attachment", disposition!.DispositionType);
    }
}
