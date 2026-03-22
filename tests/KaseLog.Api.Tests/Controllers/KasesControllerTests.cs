using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Dapper;
using KaseLog.Api.Data;
using KaseLog.Api.Data.Sqlite;
using KaseLog.Api.Tests;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Data.Sqlite;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace KaseLog.Api.Tests.Controllers;

/// <summary>
/// Integration tests for GET/POST/PUT/DELETE /api/kases.
/// Each test gets an isolated named in-memory SQLite database.
/// </summary>
public sealed class KasesControllerTests : IAsyncLifetime
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

    public KasesControllerTests()
    {
        _dbName = $"KasesTest_{Guid.NewGuid():N}";
    }

    public async Task InitializeAsync()
    {
        _testConnString = $"Data Source={_dbName};Mode=Memory;Cache=Shared";

        // Hold a connection open so SQLite keeps the in-memory DB alive.
        _keepAlive = new SqliteConnection(_testConnString);
        await _keepAlive.OpenAsync();

        // Point the app's data path to a temp dir to avoid /data permission issues.
        var tempDir = Path.Combine(Path.GetTempPath(), _dbName);
        Environment.SetEnvironmentVariable("KASELOG_DATA_PATH",
            Path.Combine(tempDir, "kaselog.db"));

        _factory = new WebApplicationFactory<Program>()
            .WithWebHostBuilder(builder =>
            {
                builder.ConfigureTestServices(services =>
                {
                    // Replace the production IDbConnectionFactory with the test one.
                    var descriptor = services.SingleOrDefault(
                        d => d.ServiceType == typeof(IDbConnectionFactory));
                    if (descriptor is not null) services.Remove(descriptor);

                    services.AddSingleton<IDbConnectionFactory>(
                        new SqliteConnectionFactory(_testConnString));

                    // Replace the seed initializer with a no-op so tests start
                    // with a clean database — no pre-seeded kases.
                    var seedDescriptor = services.SingleOrDefault(
                        d => d.ServiceType == typeof(ISeedInitializer));
                    if (seedDescriptor is not null) services.Remove(seedDescriptor);

                    services.AddSingleton<ISeedInitializer, NoopSeedInitializer>();
                });
            });

        // Creating the client triggers app startup, which initializes the schema.
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

    private async Task InsertLogAsync(string kaseId)
    {
        await using var conn = new SqliteConnection(_testConnString);
        await conn.OpenAsync();
        await conn.ExecuteAsync("PRAGMA foreign_keys=ON;");
        var now = DateTime.UtcNow.ToString("O");
        await conn.ExecuteAsync(
            "INSERT INTO Logs (Id, KaseId, Title, AutosaveEnabled, CreatedAt, UpdatedAt) " +
            "VALUES (@Id, @KaseId, @Title, 1, @Now, @Now)",
            new { Id = Guid.NewGuid().ToString(), KaseId = kaseId, Title = "Test Log", Now = now });
    }

    private async Task<JsonElement> PostKaseAsync(string title, string? description = null)
    {
        var body = new { title, description };
        var response = await _client.PostAsJsonAsync("/api/kases", body);
        response.EnsureSuccessStatusCode();
        var root = JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement;
        return root.GetProperty("data");
    }

    // ── Tests ─────────────────────────────────────────────────────────────────

    [Fact]
    public async Task GetKases_EmptyDatabase_ReturnsEmptyList()
    {
        var response = await _client.GetAsync("/api/kases");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var root = JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement;
        Assert.Equal(JsonValueKind.Array, root.GetProperty("data").ValueKind);
        Assert.Equal(0, root.GetProperty("data").GetArrayLength());
    }

    [Fact]
    public async Task PostKase_ValidRequest_CreatesKaseWithAllFields()
    {
        var response = await _client.PostAsJsonAsync("/api/kases",
            new { title = "My Kase", description = "A description" });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);

        var root = JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement;
        Assert.Equal(JsonValueKind.Null, root.GetProperty("error").ValueKind);

        var data = root.GetProperty("data");
        Assert.NotEqual(Guid.Empty, Guid.Parse(data.GetProperty("id").GetString()!));
        Assert.Equal("My Kase", data.GetProperty("title").GetString());
        Assert.Equal("A description", data.GetProperty("description").GetString());
        Assert.Equal(0, data.GetProperty("logCount").GetInt32());
        Assert.NotEmpty(data.GetProperty("createdAt").GetString()!);
        Assert.NotEmpty(data.GetProperty("updatedAt").GetString()!);
    }

    [Fact]
    public async Task PostKase_EmptyTitle_Returns400()
    {
        var response = await _client.PostAsJsonAsync("/api/kases",
            new { title = "" });
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task PostKase_TitleOver200Chars_Returns400()
    {
        var response = await _client.PostAsJsonAsync("/api/kases",
            new { title = new string('A', 201) });
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task GetKaseById_UnknownId_Returns404()
    {
        var response = await _client.GetAsync($"/api/kases/{Guid.NewGuid()}");
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task GetKaseById_ExistingKase_ReturnsCorrectKaseWithLogCount()
    {
        var data = await PostKaseAsync("Test Kase");
        var id = data.GetProperty("id").GetString()!;

        var response = await _client.GetAsync($"/api/kases/{id}");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var root = JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement;
        var fetched = root.GetProperty("data");

        Assert.Equal(id, fetched.GetProperty("id").GetString());
        Assert.Equal("Test Kase", fetched.GetProperty("title").GetString());
        Assert.Equal(0, fetched.GetProperty("logCount").GetInt32());
    }

    [Fact]
    public async Task PutKase_ValidRequest_UpdatesTitleAndUpdatedAt()
    {
        var created = await PostKaseAsync("Original Title");
        var id = created.GetProperty("id").GetString()!;
        var originalUpdatedAt = created.GetProperty("updatedAt").GetString()!;

        // Small delay to ensure UpdatedAt advances
        await Task.Delay(10);

        var response = await _client.PutAsJsonAsync($"/api/kases/{id}",
            new { title = "Updated Title" });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var root = JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement;
        var data = root.GetProperty("data");

        Assert.Equal("Updated Title", data.GetProperty("title").GetString());

        var newUpdatedAt = data.GetProperty("updatedAt").GetString()!;
        Assert.True(
            DateTime.Parse(newUpdatedAt) >= DateTime.Parse(originalUpdatedAt),
            "UpdatedAt should be >= original after update");
    }

    [Fact]
    public async Task PutKase_UnknownId_Returns404()
    {
        var response = await _client.PutAsJsonAsync($"/api/kases/{Guid.NewGuid()}",
            new { title = "New Title" });
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task DeleteKase_ExistingKase_Returns204AndRemovesKase()
    {
        var data = await PostKaseAsync("To Delete");
        var id = data.GetProperty("id").GetString()!;

        var deleteResponse = await _client.DeleteAsync($"/api/kases/{id}");
        Assert.Equal(HttpStatusCode.NoContent, deleteResponse.StatusCode);

        var getResponse = await _client.GetAsync($"/api/kases/{id}");
        Assert.Equal(HttpStatusCode.NotFound, getResponse.StatusCode);
    }

    [Fact]
    public async Task DeleteKase_UnknownId_Returns404()
    {
        var response = await _client.DeleteAsync($"/api/kases/{Guid.NewGuid()}");
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task GetKaseById_AfterLogsAdded_LogCountIsAccurate()
    {
        var data = await PostKaseAsync("Kase With Logs");
        var id = data.GetProperty("id").GetString()!;

        await InsertLogAsync(id);
        await InsertLogAsync(id);

        var response = await _client.GetAsync($"/api/kases/{id}");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var root = JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement;
        Assert.Equal(2, root.GetProperty("data").GetProperty("logCount").GetInt32());
    }

    // ── Pin / unpin tests ──────────────────────────────────────────────────────

    [Fact]
    public async Task PostKase_NewKase_IsPinned_DefaultsFalse()
    {
        var data = await PostKaseAsync("Fresh Kase");
        Assert.False(data.GetProperty("isPinned").GetBoolean());
    }

    [Fact]
    public async Task Pin_ExistingKase_ReturnsTrueAndPersists()
    {
        var kase = await PostKaseAsync("Pin Me");
        var id = kase.GetProperty("id").GetString()!;

        var pinResponse = await _client.PostAsync($"/api/kases/{id}/pin", null);
        Assert.Equal(HttpStatusCode.OK, pinResponse.StatusCode);

        var root = JsonDocument.Parse(await pinResponse.Content.ReadAsStringAsync()).RootElement;
        Assert.True(root.GetProperty("data").GetProperty("isPinned").GetBoolean());

        // Verify persistence via GET
        var getRoot = JsonDocument.Parse(
            await (await _client.GetAsync($"/api/kases/{id}")).Content.ReadAsStringAsync()
        ).RootElement;
        Assert.True(getRoot.GetProperty("data").GetProperty("isPinned").GetBoolean());
    }

    [Fact]
    public async Task Unpin_PinnedKase_ReturnsFalseAndPersists()
    {
        var kase = await PostKaseAsync("Unpin Me");
        var id = kase.GetProperty("id").GetString()!;

        await _client.PostAsync($"/api/kases/{id}/pin", null);

        var unpinResponse = await _client.PostAsync($"/api/kases/{id}/unpin", null);
        Assert.Equal(HttpStatusCode.OK, unpinResponse.StatusCode);

        var root = JsonDocument.Parse(await unpinResponse.Content.ReadAsStringAsync()).RootElement;
        Assert.False(root.GetProperty("data").GetProperty("isPinned").GetBoolean());
    }

    [Fact]
    public async Task Pin_UnknownId_Returns404()
    {
        var response = await _client.PostAsync($"/api/kases/{Guid.NewGuid()}/pin", null);
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Unpin_UnknownId_Returns404()
    {
        var response = await _client.PostAsync($"/api/kases/{Guid.NewGuid()}/unpin", null);
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task GetKases_PinnedKaseSortsFirst()
    {
        // Create two kases, pin the second one
        var k1 = await PostKaseAsync("Kase One");
        await Task.Delay(5);
        var k2 = await PostKaseAsync("Kase Two");
        var id2 = k2.GetProperty("id").GetString()!;

        await _client.PostAsync($"/api/kases/{id2}/pin", null);

        var response = await _client.GetAsync("/api/kases");
        var root = JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement;
        var arr = root.GetProperty("data").EnumerateArray().ToArray();

        Assert.Equal(2, arr.Length);
        Assert.Equal(id2, arr[0].GetProperty("id").GetString()); // pinned first
        Assert.True(arr[0].GetProperty("isPinned").GetBoolean());
        Assert.False(arr[1].GetProperty("isPinned").GetBoolean());
    }

    [Fact]
    public async Task GetKases_IncludesLatestLogFields()
    {
        var kase = await PostKaseAsync("Kase With Log");
        var id = kase.GetProperty("id").GetString()!;
        await InsertLogAsync(id);

        var response = await _client.GetAsync("/api/kases");
        var root = JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement;
        var arr = root.GetProperty("data").EnumerateArray().ToArray();

        var fetched = arr[0];
        // latestLogTitle should be "Test Log" (our InsertLogAsync default)
        Assert.Equal("Test Log", fetched.GetProperty("latestLogTitle").GetString());
        // latestLogUpdatedAt should be a valid ISO datetime
        var latestAt = fetched.GetProperty("latestLogUpdatedAt");
        Assert.NotEqual(JsonValueKind.Null, latestAt.ValueKind);
        Assert.True(DateTime.TryParse(latestAt.GetString(), out _));
    }

    [Fact]
    public async Task PutKase_WithIsPinned_PersistsNewPinState()
    {
        var kase = await PostKaseAsync("Kase For Put");
        var id = kase.GetProperty("id").GetString()!;

        var response = await _client.PutAsJsonAsync($"/api/kases/{id}",
            new { title = "Kase For Put", isPinned = true });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var root = JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement;
        Assert.True(root.GetProperty("data").GetProperty("isPinned").GetBoolean());
    }
}
