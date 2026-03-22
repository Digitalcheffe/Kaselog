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
/// Integration tests for GET and PUT /api/user, covering FontSize persistence and COALESCE behaviour.
/// Each test gets an isolated named in-memory SQLite database.
/// </summary>
public sealed class UserControllerTests : IAsyncLifetime
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

    public UserControllerTests()
    {
        _dbName = $"UserTest_{Guid.NewGuid():N}";
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
                    // with a clean database — no pre-seeded data.
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

    // ── Tests ─────────────────────────────────────────────────────────────────

    [Fact]
    public async Task Get_FreshDatabase_ReturnsDefaults()
    {
        var response = await _client.GetAsync("/api/user");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var root = JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement;
        Assert.Equal(JsonValueKind.Null, root.GetProperty("error").ValueKind);

        var data = root.GetProperty("data");
        Assert.NotEmpty(data.GetProperty("id").GetString()!);
        Assert.Equal("light",  data.GetProperty("theme").GetString());
        Assert.Equal("teal",   data.GetProperty("accent").GetString());
        Assert.Equal("medium", data.GetProperty("fontSize").GetString());
    }

    [Fact]
    public async Task Put_WithFontSizeLarge_PersistsAndReturnedByGet()
    {
        var putResponse = await _client.PutAsJsonAsync("/api/user",
            new { theme = "light", accent = "teal", fontSize = "large" });
        Assert.Equal(HttpStatusCode.OK, putResponse.StatusCode);

        var putRoot = JsonDocument.Parse(await putResponse.Content.ReadAsStringAsync()).RootElement;
        Assert.Equal("large", putRoot.GetProperty("data").GetProperty("fontSize").GetString());

        // Confirm GET also returns the persisted value.
        var getResponse = await _client.GetAsync("/api/user");
        var getRoot = JsonDocument.Parse(await getResponse.Content.ReadAsStringAsync()).RootElement;
        Assert.Equal("large", getRoot.GetProperty("data").GetProperty("fontSize").GetString());
    }

    [Fact]
    public async Task Put_WithThemeDark_PersistsCorrectly()
    {
        var putResponse = await _client.PutAsJsonAsync("/api/user",
            new { theme = "dark", accent = "teal", fontSize = "medium" });
        Assert.Equal(HttpStatusCode.OK, putResponse.StatusCode);

        var root = JsonDocument.Parse(await putResponse.Content.ReadAsStringAsync()).RootElement;
        Assert.Equal("dark", root.GetProperty("data").GetProperty("theme").GetString());
    }

    [Fact]
    public async Task Put_WithPartialBodyOmittingFontSize_PreservesExistingFontSizeViaCoalesce()
    {
        // First PUT sets fontSize to "large".
        var firstPut = await _client.PutAsJsonAsync("/api/user",
            new { theme = "light", accent = "teal", fontSize = "large" });
        Assert.Equal(HttpStatusCode.OK, firstPut.StatusCode);

        // Second PUT omits fontSize (sends null) — existing value must be preserved.
        var secondPut = await _client.PutAsJsonAsync("/api/user",
            new { theme = "light", accent = "teal" });
        Assert.Equal(HttpStatusCode.OK, secondPut.StatusCode);

        var root = JsonDocument.Parse(await secondPut.Content.ReadAsStringAsync()).RootElement;
        Assert.Equal("large", root.GetProperty("data").GetProperty("fontSize").GetString());
    }

    [Fact]
    public async Task Get_AfterPut_ReturnsUpdatedValues()
    {
        await _client.PutAsJsonAsync("/api/user",
            new { theme = "dark", accent = "blue", fontSize = "small" });

        var response = await _client.GetAsync("/api/user");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var root = JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement;
        var data = root.GetProperty("data");

        Assert.Equal("dark",  data.GetProperty("theme").GetString());
        Assert.Equal("blue",  data.GetProperty("accent").GetString());
        Assert.Equal("small", data.GetProperty("fontSize").GetString());
    }
}
