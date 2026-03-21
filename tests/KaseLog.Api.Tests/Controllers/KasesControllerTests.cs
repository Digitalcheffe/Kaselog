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
}
