using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Dapper;
using KaseLog.Api.Data;
using KaseLog.Api.Data.Sqlite;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Data.Sqlite;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace KaseLog.Api.Tests.Controllers;

/// <summary>
/// Integration tests for Logs and LogVersions endpoints.
/// Each test gets an isolated named in-memory SQLite database.
/// </summary>
public sealed class LogsControllerTests : IAsyncLifetime
{
    private readonly string _dbName;
    private string _testConnString = null!;
    private SqliteConnection _keepAlive = null!;
    private WebApplicationFactory<Program> _factory = null!;
    private HttpClient _client = null!;

    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNameCaseInsensitive = true,
    };

    public LogsControllerTests()
    {
        _dbName = $"LogsTest_{Guid.NewGuid():N}";
    }

    public async Task InitializeAsync()
    {
        _testConnString = $"Data Source={_dbName};Mode=Memory;Cache=Shared";

        _keepAlive = new SqliteConnection(_testConnString);
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

    private async Task<JsonElement> PostKaseAsync(string title = "Test Kase")
    {
        var response = await _client.PostAsJsonAsync("/api/kases", new { title });
        response.EnsureSuccessStatusCode();
        return JsonDocument.Parse(await response.Content.ReadAsStringAsync())
            .RootElement.GetProperty("data");
    }

    private async Task<JsonElement> PostLogAsync(string kaseId, string title = "Test Log", string? description = null)
    {
        var response = await _client.PostAsJsonAsync(
            $"/api/kases/{kaseId}/logs",
            new { title, description });
        response.EnsureSuccessStatusCode();
        return JsonDocument.Parse(await response.Content.ReadAsStringAsync())
            .RootElement.GetProperty("data");
    }

    private async Task<JsonElement> PostVersionAsync(string logId, string content, string? label = null, bool isAutosave = true)
    {
        var response = await _client.PostAsJsonAsync(
            $"/api/logs/{logId}/versions",
            new { content, label, isAutosave });
        response.EnsureSuccessStatusCode();
        return JsonDocument.Parse(await response.Content.ReadAsStringAsync())
            .RootElement.GetProperty("data");
    }

    private async Task<SqliteConnection> OpenTestConnectionAsync()
    {
        var conn = new SqliteConnection(_testConnString);
        await conn.OpenAsync();
        await conn.ExecuteAsync("PRAGMA foreign_keys=ON;");
        return conn;
    }

    // ── Tests ─────────────────────────────────────────────────────────────────

    [Fact]
    public async Task PostLog_CreatesInitialEmptyLogVersion()
    {
        var kase = await PostKaseAsync();
        var kaseId = kase.GetProperty("id").GetString()!;

        var log = await PostLogAsync(kaseId, "My Log");
        var logId = log.GetProperty("id").GetString()!;

        // VersionCount should be 1
        Assert.Equal(1, log.GetProperty("versionCount").GetInt32());

        // Verify the initial version exists in the DB with empty content
        await using var conn = await OpenTestConnectionAsync();
        var count = await conn.ExecuteScalarAsync<int>(
            "SELECT COUNT(*) FROM LogVersions WHERE LogId = @LogId",
            new { LogId = logId });
        Assert.Equal(1, count);

        var content = await conn.ExecuteScalarAsync<string>(
            "SELECT Content FROM LogVersions WHERE LogId = @LogId",
            new { LogId = logId });
        Assert.Equal("", content);
    }

    [Fact]
    public async Task GetLogById_ReturnsContentFromMostRecentVersion()
    {
        var kase = await PostKaseAsync();
        var kaseId = kase.GetProperty("id").GetString()!;
        var log = await PostLogAsync(kaseId);
        var logId = log.GetProperty("id").GetString()!;

        // Add a version with specific content
        await PostVersionAsync(logId, "Version 2 content");
        await PostVersionAsync(logId, "Version 3 content — most recent");

        var response = await _client.GetAsync($"/api/logs/{logId}");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var root = JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement;
        var data = root.GetProperty("data");

        Assert.Equal("Version 3 content — most recent", data.GetProperty("content").GetString());
        Assert.Equal(3, data.GetProperty("versionCount").GetInt32());
    }

    [Fact]
    public async Task PostVersion_IncrementsVersionCount()
    {
        var kase = await PostKaseAsync();
        var kaseId = kase.GetProperty("id").GetString()!;
        var log = await PostLogAsync(kaseId);
        var logId = log.GetProperty("id").GetString()!;

        Assert.Equal(1, log.GetProperty("versionCount").GetInt32());

        await PostVersionAsync(logId, "New content");

        var response = await _client.GetAsync($"/api/logs/{logId}");
        var root = JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement;

        Assert.Equal(2, root.GetProperty("data").GetProperty("versionCount").GetInt32());
    }

    [Fact]
    public async Task PostVersion_NamedCheckpoint_IsAutosaveFalseAndLabelSet()
    {
        var kase = await PostKaseAsync();
        var kaseId = kase.GetProperty("id").GetString()!;
        var log = await PostLogAsync(kaseId);
        var logId = log.GetProperty("id").GetString()!;

        var version = await PostVersionAsync(logId, "Checkpoint content", label: "Release v1.0", isAutosave: false);

        Assert.False(version.GetProperty("isAutosave").GetBoolean());
        Assert.Equal("Release v1.0", version.GetProperty("label").GetString());
    }

    [Fact]
    public async Task PostVersion_AutosaveVersion_IsAutosaveTrueAndLabelNull()
    {
        var kase = await PostKaseAsync();
        var kaseId = kase.GetProperty("id").GetString()!;
        var log = await PostLogAsync(kaseId);
        var logId = log.GetProperty("id").GetString()!;

        var version = await PostVersionAsync(logId, "Autosaved content", label: null, isAutosave: true);

        Assert.True(version.GetProperty("isAutosave").GetBoolean());
        Assert.Equal(JsonValueKind.Null, version.GetProperty("label").ValueKind);
    }

    [Fact]
    public async Task RestoreVersion_CreatesNewVersionAndLeavesHistoryUnchanged()
    {
        var kase = await PostKaseAsync();
        var kaseId = kase.GetProperty("id").GetString()!;
        var log = await PostLogAsync(kaseId);
        var logId = log.GetProperty("id").GetString()!;

        var v2 = await PostVersionAsync(logId, "Version 2 content");
        var v2Id = v2.GetProperty("id").GetString()!;

        var v3 = await PostVersionAsync(logId, "Version 3 content");
        var v3Id = v3.GetProperty("id").GetString()!;

        // Restore v2
        var restoreResponse = await _client.PostAsync(
            $"/api/logs/{logId}/versions/{v2Id}/restore", null);
        Assert.Equal(HttpStatusCode.OK, restoreResponse.StatusCode);

        var restored = JsonDocument.Parse(await restoreResponse.Content.ReadAsStringAsync())
            .RootElement.GetProperty("data");

        // Restored version has v2 content
        Assert.Equal("Version 2 content", restored.GetProperty("content").GetString());
        // Restored version is a new entry (different ID)
        Assert.NotEqual(v2Id, restored.GetProperty("id").GetString());

        // History now has 4 versions (initial empty + v2 + v3 + restored)
        var versionsResponse = await _client.GetAsync($"/api/logs/{logId}/versions");
        var versions = JsonDocument.Parse(await versionsResponse.Content.ReadAsStringAsync())
            .RootElement.GetProperty("data");
        Assert.Equal(4, versions.GetArrayLength());

        // v2 and v3 still exist unchanged
        var allIds = versions.EnumerateArray().Select(v => v.GetProperty("id").GetString()).ToList();
        Assert.Contains(v2Id, allIds);
        Assert.Contains(v3Id, allIds);
    }

    [Fact]
    public async Task DeleteLog_CascadesToAllLogVersions()
    {
        var kase = await PostKaseAsync();
        var kaseId = kase.GetProperty("id").GetString()!;
        var log = await PostLogAsync(kaseId);
        var logId = log.GetProperty("id").GetString()!;

        await PostVersionAsync(logId, "Content A");
        await PostVersionAsync(logId, "Content B");

        var deleteResponse = await _client.DeleteAsync($"/api/logs/{logId}");
        Assert.Equal(HttpStatusCode.NoContent, deleteResponse.StatusCode);

        await using var conn = await OpenTestConnectionAsync();
        var versionCount = await conn.ExecuteScalarAsync<int>(
            "SELECT COUNT(*) FROM LogVersions WHERE LogId = @LogId",
            new { LogId = logId });
        Assert.Equal(0, versionCount);
    }

    [Fact]
    public async Task PostVersion_UpdatesFts5Index()
    {
        var kase = await PostKaseAsync("Searchable Kase");
        var kaseId = kase.GetProperty("id").GetString()!;
        var log = await PostLogAsync(kaseId, "Searchable Log");
        var logId = log.GetProperty("id").GetString()!;

        await PostVersionAsync(logId, "uniqueterm_abc123 content here");

        await using var conn = await OpenTestConnectionAsync();
        var ftsCount = await conn.ExecuteScalarAsync<int>(
            "SELECT COUNT(*) FROM kaselog_search WHERE kaselog_search MATCH 'uniqueterm_abc123'");
        Assert.Equal(1, ftsCount);
    }

    [Fact]
    public async Task DeleteLog_RemovesFts5Entry()
    {
        var kase = await PostKaseAsync();
        var kaseId = kase.GetProperty("id").GetString()!;
        var log = await PostLogAsync(kaseId);
        var logId = log.GetProperty("id").GetString()!;

        await PostVersionAsync(logId, "some content");

        // Verify FTS entry exists before delete
        await using var conn = await OpenTestConnectionAsync();
        var beforeCount = await conn.ExecuteScalarAsync<int>(
            "SELECT COUNT(*) FROM kaselog_search WHERE log_id = @LogId",
            new { LogId = logId });
        Assert.Equal(1, beforeCount);

        await _client.DeleteAsync($"/api/logs/{logId}");

        var afterCount = await conn.ExecuteScalarAsync<int>(
            "SELECT COUNT(*) FROM kaselog_search WHERE log_id = @LogId",
            new { LogId = logId });
        Assert.Equal(0, afterCount);
    }

    [Fact]
    public async Task GetLogById_UnknownId_Returns404()
    {
        var response = await _client.GetAsync($"/api/logs/{Guid.NewGuid()}");
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);

        var root = JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement;
        Assert.Equal(JsonValueKind.Null, root.GetProperty("data").ValueKind);
        Assert.NotEqual(JsonValueKind.Null, root.GetProperty("error").ValueKind);
    }

    [Fact]
    public async Task PostLog_EmptyTitle_Returns400()
    {
        var kase = await PostKaseAsync();
        var kaseId = kase.GetProperty("id").GetString()!;

        var response = await _client.PostAsJsonAsync($"/api/kases/{kaseId}/logs", new { title = "" });
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task PostLog_TitleOver200Chars_Returns400()
    {
        var kase = await PostKaseAsync();
        var kaseId = kase.GetProperty("id").GetString()!;

        var response = await _client.PostAsJsonAsync($"/api/kases/{kaseId}/logs",
            new { title = new string('A', 201) });
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task PostLog_UnknownKaseId_Returns404()
    {
        var response = await _client.PostAsJsonAsync(
            $"/api/kases/{Guid.NewGuid()}/logs",
            new { title = "Test" });
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task GetLogsByKase_ReturnsLogsInReverseChronologicalOrder()
    {
        var kase = await PostKaseAsync();
        var kaseId = kase.GetProperty("id").GetString()!;

        await PostLogAsync(kaseId, "Log A");
        await Task.Delay(10);
        await PostLogAsync(kaseId, "Log B");

        var response = await _client.GetAsync($"/api/kases/{kaseId}/logs");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var data = JsonDocument.Parse(await response.Content.ReadAsStringAsync())
            .RootElement.GetProperty("data");
        Assert.Equal(2, data.GetArrayLength());
        // Most recent first
        Assert.Equal("Log B", data[0].GetProperty("title").GetString());
        Assert.Equal("Log A", data[1].GetProperty("title").GetString());
    }

    [Fact]
    public async Task DeleteLog_UnknownId_Returns404()
    {
        var response = await _client.DeleteAsync($"/api/logs/{Guid.NewGuid()}");
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task PutLog_UpdatesTitleAndDescription()
    {
        var kase = await PostKaseAsync();
        var kaseId = kase.GetProperty("id").GetString()!;
        var log = await PostLogAsync(kaseId, "Original Title");
        var logId = log.GetProperty("id").GetString()!;

        var response = await _client.PutAsJsonAsync($"/api/logs/{logId}",
            new { title = "Updated Title", description = "New desc", autosaveEnabled = true });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var data = JsonDocument.Parse(await response.Content.ReadAsStringAsync())
            .RootElement.GetProperty("data");
        Assert.Equal("Updated Title", data.GetProperty("title").GetString());
        Assert.Equal("New desc", data.GetProperty("description").GetString());
    }

    [Fact]
    public async Task PutLog_UnknownId_Returns404()
    {
        var response = await _client.PutAsJsonAsync($"/api/logs/{Guid.NewGuid()}",
            new { title = "Title", autosaveEnabled = true });
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }
}
