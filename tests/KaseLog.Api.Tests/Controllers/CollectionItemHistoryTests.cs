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
/// Integration tests for the Collection item history feature.
/// Each test gets an isolated named in-memory SQLite database.
/// </summary>
public sealed class CollectionItemHistoryTests : IAsyncLifetime
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

    public CollectionItemHistoryTests()
    {
        _dbName = $"HistoryTest_{Guid.NewGuid():N}";
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

    private async Task<JsonElement> PostCollectionAsync(string title, string color = "teal")
    {
        var response = await _client.PostAsJsonAsync("/api/collections", new { title, color });
        response.EnsureSuccessStatusCode();
        return JsonDocument.Parse(await response.Content.ReadAsStringAsync())
            .RootElement.GetProperty("data");
    }

    private async Task<JsonElement> PostFieldAsync(
        string collectionId, string name, string type = "text", int sortOrder = 0)
    {
        var response = await _client.PostAsJsonAsync(
            $"/api/collections/{collectionId}/fields",
            new { name, type, required = false, showInList = true, sortOrder });
        response.EnsureSuccessStatusCode();
        return JsonDocument.Parse(await response.Content.ReadAsStringAsync())
            .RootElement.GetProperty("data");
    }

    private async Task<JsonElement> PostItemAsync(
        string collectionId, object fieldValues)
    {
        var response = await _client.PostAsJsonAsync(
            $"/api/collections/{collectionId}/items",
            new { fieldValues });
        response.EnsureSuccessStatusCode();
        return JsonDocument.Parse(await response.Content.ReadAsStringAsync())
            .RootElement.GetProperty("data");
    }

    private async Task<JsonElement> PutItemAsync(
        string itemId, object fieldValues, string? kaseId = null)
    {
        var response = await _client.PutAsJsonAsync(
            $"/api/items/{itemId}",
            new { fieldValues, kaseId });
        response.EnsureSuccessStatusCode();
        return JsonDocument.Parse(await response.Content.ReadAsStringAsync())
            .RootElement.GetProperty("data");
    }

    private async Task<JsonElement> GetHistoryAsync(string collectionId, string itemId)
    {
        var response = await _client.GetAsync(
            $"/api/collections/{collectionId}/items/{itemId}/history");
        response.EnsureSuccessStatusCode();
        return JsonDocument.Parse(await response.Content.ReadAsStringAsync())
            .RootElement.GetProperty("data");
    }

    // ── Tests ─────────────────────────────────────────────────────────────────

    [Fact]
    public async Task PutItem_WithChangedFields_CreatesHistoryRecord()
    {
        var col    = await PostCollectionAsync("Gear");
        var colId  = col.GetProperty("id").GetString()!;
        var field  = await PostFieldAsync(colId, "Name", "text", 0);
        var fId    = field.GetProperty("id").GetString()!;

        var item   = await PostItemAsync(colId, new Dictionary<string, string> { [fId] = "Tent" });
        var itemId = item.GetProperty("id").GetString()!;

        await PutItemAsync(itemId, new Dictionary<string, string> { [fId] = "Tarp" });

        var history = await GetHistoryAsync(colId, itemId);
        Assert.Equal(JsonValueKind.Array, history.ValueKind);
        Assert.Equal(1, history.GetArrayLength());
    }

    [Fact]
    public async Task PutItem_WithNoChangedFields_DoesNotCreateHistoryRecord()
    {
        var col    = await PostCollectionAsync("Books");
        var colId  = col.GetProperty("id").GetString()!;
        var field  = await PostFieldAsync(colId, "Title", "text", 0);
        var fId    = field.GetProperty("id").GetString()!;

        var item   = await PostItemAsync(colId, new Dictionary<string, string> { [fId] = "Dune" });
        var itemId = item.GetProperty("id").GetString()!;

        // PUT with identical field values
        await PutItemAsync(itemId, new Dictionary<string, string> { [fId] = "Dune" });

        var history = await GetHistoryAsync(colId, itemId);
        Assert.Equal(0, history.GetArrayLength());
    }

    [Fact]
    public async Task PutItem_ChangeSummary_ListsOnlyChangedFieldNames()
    {
        var col   = await PostCollectionAsync("Albums");
        var colId = col.GetProperty("id").GetString()!;
        var fA    = (await PostFieldAsync(colId, "Title", "text", 0)).GetProperty("id").GetString()!;
        var fB    = (await PostFieldAsync(colId, "Artist", "text", 1)).GetProperty("id").GetString()!;
        var fC    = (await PostFieldAsync(colId, "Year", "text", 2)).GetProperty("id").GetString()!;

        var item   = await PostItemAsync(colId, new Dictionary<string, string>
        {
            [fA] = "OK Computer", [fB] = "Radiohead", [fC] = "1997",
        });
        var itemId = item.GetProperty("id").GetString()!;

        // Change Title and Year only, Artist stays the same
        await PutItemAsync(itemId, new Dictionary<string, string>
        {
            [fA] = "Kid A", [fB] = "Radiohead", [fC] = "2000",
        });

        var history = await GetHistoryAsync(colId, itemId);
        var summary = history[0].GetProperty("changeSummary").GetString()!;

        Assert.Contains("Title", summary);
        Assert.Contains("Year", summary);
        Assert.DoesNotContain("Artist", summary);
    }

    [Fact]
    public async Task PutItem_HistoryRecord_StoresPreviousFieldValues()
    {
        var col   = await PostCollectionAsync("Games");
        var colId = col.GetProperty("id").GetString()!;
        var fId   = (await PostFieldAsync(colId, "Name", "text", 0)).GetProperty("id").GetString()!;

        var item   = await PostItemAsync(colId, new Dictionary<string, string> { [fId] = "Hades" });
        var itemId = item.GetProperty("id").GetString()!;

        await PutItemAsync(itemId, new Dictionary<string, string> { [fId] = "Hades II" });

        var history     = await GetHistoryAsync(colId, itemId);
        var savedValues = history[0].GetProperty("fieldValues");

        // FieldValues in the history row must reflect the OLD value, not the new one
        Assert.Equal("Hades", savedValues.GetProperty(fId).GetString());
    }

    [Fact]
    public async Task GetItemHistory_MultipleUpdates_ReturnsNewestFirst()
    {
        var col   = await PostCollectionAsync("Notes");
        var colId = col.GetProperty("id").GetString()!;
        var fId   = (await PostFieldAsync(colId, "Body", "text", 0)).GetProperty("id").GetString()!;

        var item   = await PostItemAsync(colId, new Dictionary<string, string> { [fId] = "v1" });
        var itemId = item.GetProperty("id").GetString()!;

        await PutItemAsync(itemId, new Dictionary<string, string> { [fId] = "v2" });
        await Task.Delay(10); // ensure distinct timestamps
        await PutItemAsync(itemId, new Dictionary<string, string> { [fId] = "v3" });

        var history = await GetHistoryAsync(colId, itemId);
        Assert.Equal(2, history.GetArrayLength());

        // Newest first: second update (v2 → v3) has a later createdAt than first (v1 → v2)
        var first  = DateTime.Parse(history[0].GetProperty("createdAt").GetString()!);
        var second = DateTime.Parse(history[1].GetProperty("createdAt").GetString()!);
        Assert.True(first >= second);
    }

    [Fact]
    public async Task GetItemHistory_NoHistory_ReturnsEmptyArray()
    {
        var col    = await PostCollectionAsync("Tools");
        var colId  = col.GetProperty("id").GetString()!;
        var fId    = (await PostFieldAsync(colId, "Name", "text", 0)).GetProperty("id").GetString()!;

        var item   = await PostItemAsync(colId, new Dictionary<string, string> { [fId] = "Hammer" });
        var itemId = item.GetProperty("id").GetString()!;

        // No updates — history should be empty
        var history = await GetHistoryAsync(colId, itemId);
        Assert.Equal(0, history.GetArrayLength());
    }

    [Fact]
    public async Task GetItemHistory_UnknownItemId_Returns404()
    {
        var col   = await PostCollectionAsync("Stuff");
        var colId = col.GetProperty("id").GetString()!;

        var response = await _client.GetAsync(
            $"/api/collections/{colId}/items/{Guid.NewGuid()}/history");
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task DeleteItem_CascadesAndRemovesHistoryRecords()
    {
        var col   = await PostCollectionAsync("Deletables");
        var colId = col.GetProperty("id").GetString()!;
        var fId   = (await PostFieldAsync(colId, "Tag", "text", 0)).GetProperty("id").GetString()!;

        var item   = await PostItemAsync(colId, new Dictionary<string, string> { [fId] = "alpha" });
        var itemId = item.GetProperty("id").GetString()!;

        await PutItemAsync(itemId, new Dictionary<string, string> { [fId] = "beta" });

        // Verify history exists before delete
        var historyBefore = await GetHistoryAsync(colId, itemId);
        Assert.Equal(1, historyBefore.GetArrayLength());

        // Delete the item
        var deleteResponse = await _client.DeleteAsync($"/api/items/{itemId}");
        Assert.Equal(HttpStatusCode.NoContent, deleteResponse.StatusCode);

        // GET history for the deleted item should now 404
        var afterDelete = await _client.GetAsync(
            $"/api/collections/{colId}/items/{itemId}/history");
        Assert.Equal(HttpStatusCode.NotFound, afterDelete.StatusCode);
    }
}
