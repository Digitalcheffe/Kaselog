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
/// Integration tests for the Collections API.
/// Each test gets an isolated named in-memory SQLite database.
/// </summary>
public sealed class CollectionsControllerTests : IAsyncLifetime
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

    public CollectionsControllerTests()
    {
        _dbName = $"CollectionsTest_{Guid.NewGuid():N}";
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

    private async Task<JsonElement> PostFieldAsync(string collectionId, string name,
        string type = "text", bool required = false, int sortOrder = 0)
    {
        var response = await _client.PostAsJsonAsync(
            $"/api/collections/{collectionId}/fields",
            new { name, type, required, showInList = true, sortOrder });
        response.EnsureSuccessStatusCode();
        return JsonDocument.Parse(await response.Content.ReadAsStringAsync())
            .RootElement.GetProperty("data");
    }

    private async Task<JsonElement> PostKaseAsync(string title)
    {
        var response = await _client.PostAsJsonAsync("/api/kases", new { title });
        response.EnsureSuccessStatusCode();
        return JsonDocument.Parse(await response.Content.ReadAsStringAsync())
            .RootElement.GetProperty("data");
    }

    private async Task InsertLogVersionAsync(string logId, string content)
    {
        await using var conn = new SqliteConnection(_testConnString);
        await conn.OpenAsync();
        await conn.ExecuteAsync("PRAGMA foreign_keys=ON;");
        await conn.ExecuteAsync(
            "INSERT INTO LogVersions(Id, LogId, Content, IsAutosave, CreatedAt) VALUES (@Id, @LogId, @Content, 1, @Now)",
            new { Id = Guid.NewGuid().ToString(), LogId = logId, Content = content, Now = DateTime.UtcNow.ToString("O") });
    }

    private async Task InsertLogAsync(string kaseId, string title = "Test Log")
    {
        await using var conn = new SqliteConnection(_testConnString);
        await conn.OpenAsync();
        await conn.ExecuteAsync("PRAGMA foreign_keys=ON;");
        var now = DateTime.UtcNow.ToString("O");
        await conn.ExecuteAsync(
            "INSERT INTO Logs(Id, KaseId, Title, AutosaveEnabled, CreatedAt, UpdatedAt) VALUES (@Id, @KaseId, @Title, 1, @Now, @Now)",
            new { Id = Guid.NewGuid().ToString(), KaseId = kaseId, Title = title, Now = now });
    }

    // ── Tests ─────────────────────────────────────────────────────────────────

    [Fact]
    public async Task GetCollections_EmptyDatabase_ReturnsEmptyList()
    {
        var response = await _client.GetAsync("/api/collections");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var root = JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement;
        Assert.Equal(JsonValueKind.Array, root.GetProperty("data").ValueKind);
        Assert.Equal(0, root.GetProperty("data").GetArrayLength());
    }

    [Fact]
    public async Task PostCollection_ValidRequest_CreatesCollectionWithCorrectFields()
    {
        var response = await _client.PostAsJsonAsync("/api/collections",
            new { title = "My Gear", color = "blue" });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);

        var root = JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement;
        var data = root.GetProperty("data");

        Assert.NotEqual(Guid.Empty, Guid.Parse(data.GetProperty("id").GetString()!));
        Assert.Equal("My Gear", data.GetProperty("title").GetString());
        Assert.Equal("blue", data.GetProperty("color").GetString());
        Assert.NotEmpty(data.GetProperty("createdAt").GetString()!);
        Assert.NotEmpty(data.GetProperty("updatedAt").GetString()!);
        Assert.Equal(JsonValueKind.Null, root.GetProperty("error").ValueKind);
    }

    [Fact]
    public async Task GetCollection_UnknownId_Returns404()
    {
        var response = await _client.GetAsync($"/api/collections/{Guid.NewGuid()}");
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task PostField_AddsFieldWithCorrectSortOrder()
    {
        var col   = await PostCollectionAsync("Books");
        var colId = col.GetProperty("id").GetString()!;

        var field = await PostFieldAsync(colId, "Title", "text", sortOrder: 3);

        Assert.Equal("Title",  field.GetProperty("name").GetString());
        Assert.Equal("text",   field.GetProperty("type").GetString());
        Assert.Equal(3,        field.GetProperty("sortOrder").GetInt32());
        Assert.Equal(colId,    field.GetProperty("collectionId").GetString());
    }

    [Fact]
    public async Task PutFieldsReorder_UpdatesAllSortOrders()
    {
        var col   = await PostCollectionAsync("Movies");
        var colId = col.GetProperty("id").GetString()!;

        var fieldA = await PostFieldAsync(colId, "A", sortOrder: 0);
        var fieldB = await PostFieldAsync(colId, "B", sortOrder: 1);
        var fieldC = await PostFieldAsync(colId, "C", sortOrder: 2);

        var idA = fieldA.GetProperty("id").GetString()!;
        var idB = fieldB.GetProperty("id").GetString()!;
        var idC = fieldC.GetProperty("id").GetString()!;

        // Reverse the order: C, B, A
        var reorderResponse = await _client.PutAsJsonAsync(
            $"/api/collections/{colId}/fields/reorder",
            new { fieldIds = new[] { idC, idB, idA } });

        Assert.Equal(HttpStatusCode.OK, reorderResponse.StatusCode);

        var getResponse = await _client.GetAsync($"/api/collections/{colId}/fields");
        var fields = JsonDocument.Parse(await getResponse.Content.ReadAsStringAsync())
            .RootElement.GetProperty("data");

        Assert.Equal(idC, fields[0].GetProperty("id").GetString());
        Assert.Equal(0,   fields[0].GetProperty("sortOrder").GetInt32());
        Assert.Equal(idB, fields[1].GetProperty("id").GetString());
        Assert.Equal(1,   fields[1].GetProperty("sortOrder").GetInt32());
        Assert.Equal(idA, fields[2].GetProperty("id").GetString());
        Assert.Equal(2,   fields[2].GetProperty("sortOrder").GetInt32());
    }

    [Fact]
    public async Task PutLayout_StoresLayoutJsonAndRetrievesItUnchanged()
    {
        var col   = await PostCollectionAsync("Vinyl");
        var colId = col.GetProperty("id").GetString()!;

        var layout = """[{"cells":[{"kind":"field","fieldId":"abc","span":2},null]}]""";

        var putResponse = await _client.PutAsJsonAsync(
            $"/api/collections/{colId}/layout",
            new { layout });
        Assert.Equal(HttpStatusCode.OK, putResponse.StatusCode);

        var getResponse = await _client.GetAsync($"/api/collections/{colId}/layout");
        Assert.Equal(HttpStatusCode.OK, getResponse.StatusCode);

        var returned = JsonDocument.Parse(await getResponse.Content.ReadAsStringAsync())
            .RootElement.GetProperty("data").GetProperty("layout").GetString();

        Assert.Equal(layout, returned);
    }

    [Fact]
    public async Task PostItem_MissingRequiredField_Returns400()
    {
        var col   = await PostCollectionAsync("Albums");
        var colId = col.GetProperty("id").GetString()!;

        // Add a required field
        await PostFieldAsync(colId, "Artist", "text", required: true, sortOrder: 0);

        // Post item without the required field
        var response = await _client.PostAsJsonAsync(
            $"/api/collections/{colId}/items",
            new { fieldValues = new { } });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);

        var root = JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement;
        Assert.Equal(JsonValueKind.Null, root.GetProperty("data").ValueKind);
        Assert.Equal(400, root.GetProperty("error").GetProperty("status").GetInt32());
    }

    [Fact]
    public async Task PostItem_ValidData_CreatesItemAndIndexesInFts5()
    {
        var col     = await PostCollectionAsync("Films");
        var colId   = col.GetProperty("id").GetString()!;
        var field   = await PostFieldAsync(colId, "Title", "text", sortOrder: 0);
        var fieldId = field.GetProperty("id").GetString()!;

        var fieldValues = new Dictionary<string, string> { [fieldId] = "Blade Runner" };
        var response = await _client.PostAsJsonAsync(
            $"/api/collections/{colId}/items",
            new { fieldValues });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);

        var data   = JsonDocument.Parse(await response.Content.ReadAsStringAsync())
            .RootElement.GetProperty("data");
        var itemId = data.GetProperty("id").GetString()!;

        // Verify FTS5 entry
        await using var conn = new SqliteConnection(_testConnString);
        await conn.OpenAsync();
        var entityType = await conn.ExecuteScalarAsync<string>(
            "SELECT entity_type FROM kaselog_search WHERE entity_id = @Id",
            new { Id = itemId });

        Assert.Equal("collection_item", entityType);
    }

    [Fact]
    public async Task GetItems_WithFieldFilter_ReturnsMatchingItemsOnly()
    {
        var col     = await PostCollectionAsync("Books");
        var colId   = col.GetProperty("id").GetString()!;
        var field   = await PostFieldAsync(colId, "Genre", "select", sortOrder: 0);
        var fieldId = field.GetProperty("id").GetString()!;

        // Create two items with different genres
        await _client.PostAsJsonAsync($"/api/collections/{colId}/items",
            new { fieldValues = new Dictionary<string, string> { [fieldId] = "Fiction" } });
        await _client.PostAsJsonAsync($"/api/collections/{colId}/items",
            new { fieldValues = new Dictionary<string, string> { [fieldId] = "Non-Fiction" } });

        // Filter by Genre=Fiction
        var response = await _client.GetAsync(
            $"/api/collections/{colId}/items?field[{fieldId}]=Fiction");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var items = JsonDocument.Parse(await response.Content.ReadAsStringAsync())
            .RootElement.GetProperty("data");

        Assert.Equal(1, items.GetArrayLength());
        var returned = items[0].GetProperty("fieldValues");
        Assert.Equal("Fiction", returned.GetProperty(fieldId).GetString());
    }

    [Fact]
    public async Task GetTimeline_ReturnsMixedEntriesWithCorrectEntityType()
    {
        var kase   = await PostKaseAsync("Incident Alpha");
        var kaseId = kase.GetProperty("id").GetString()!;

        // Add a log
        await InsertLogAsync(kaseId, "First Log");

        // Add a collection item linked to the kase
        var col     = await PostCollectionAsync("Items");
        var colId   = col.GetProperty("id").GetString()!;
        var field   = await PostFieldAsync(colId, "Name", "text");
        var fieldId = field.GetProperty("id").GetString()!;

        await _client.PostAsJsonAsync($"/api/collections/{colId}/items",
            new
            {
                kaseId,
                fieldValues = new Dictionary<string, string> { [fieldId] = "Widget" },
            });

        var response = await _client.GetAsync($"/api/kases/{kaseId}/timeline");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var entries = JsonDocument.Parse(await response.Content.ReadAsStringAsync())
            .RootElement.GetProperty("data");

        Assert.True(entries.GetArrayLength() >= 2);

        var entityTypes = Enumerable.Range(0, entries.GetArrayLength())
            .Select(i => entries[i].GetProperty("entityType").GetString())
            .ToHashSet();

        Assert.Contains("log",             entityTypes);
        Assert.Contains("collection_item", entityTypes);
    }

    [Fact]
    public async Task GetTimeline_EntriesAreInReverseChronologicalOrder()
    {
        var kase   = await PostKaseAsync("Order Test");
        var kaseId = kase.GetProperty("id").GetString()!;

        // Insert log first
        await InsertLogAsync(kaseId, "Log A");
        await Task.Delay(10);

        // Insert collection item second
        var col     = await PostCollectionAsync("Things");
        var colId   = col.GetProperty("id").GetString()!;
        var field   = await PostFieldAsync(colId, "Name", "text");
        var fieldId = field.GetProperty("id").GetString()!;

        await _client.PostAsJsonAsync($"/api/collections/{colId}/items",
            new { kaseId, fieldValues = new Dictionary<string, string> { [fieldId] = "Item B" } });

        var response = await _client.GetAsync($"/api/kases/{kaseId}/timeline");
        var entries  = JsonDocument.Parse(await response.Content.ReadAsStringAsync())
            .RootElement.GetProperty("data");

        Assert.True(entries.GetArrayLength() >= 2);

        // First entry should be newer (collection_item inserted after log)
        var first  = DateTime.Parse(entries[0].GetProperty("createdAt").GetString()!);
        var second = DateTime.Parse(entries[1].GetProperty("createdAt").GetString()!);
        Assert.True(first >= second, "Timeline should be in reverse-chronological order");
    }

    [Fact]
    public async Task DeleteCollection_RemovesCollectionFieldsLayoutAndItems()
    {
        var col   = await PostCollectionAsync("To Delete");
        var colId = col.GetProperty("id").GetString()!;

        await PostFieldAsync(colId, "Name", "text");
        await _client.PutAsJsonAsync($"/api/collections/{colId}/layout",
            new { layout = "[]" });
        await _client.PostAsJsonAsync($"/api/collections/{colId}/items",
            new { fieldValues = new { } });

        var deleteResponse = await _client.DeleteAsync($"/api/collections/{colId}");
        Assert.Equal(HttpStatusCode.NoContent, deleteResponse.StatusCode);

        // Collection is gone
        var getResponse = await _client.GetAsync($"/api/collections/{colId}");
        Assert.Equal(HttpStatusCode.NotFound, getResponse.StatusCode);

        // Verify DB cascade via direct query
        await using var conn = new SqliteConnection(_testConnString);
        await conn.OpenAsync();

        Assert.Equal(0L, await conn.ExecuteScalarAsync<long>(
            "SELECT count(*) FROM CollectionFields WHERE CollectionId = @Id", new { Id = colId }));
        Assert.Equal(0L, await conn.ExecuteScalarAsync<long>(
            "SELECT count(*) FROM CollectionLayout WHERE CollectionId = @Id", new { Id = colId }));
        Assert.Equal(0L, await conn.ExecuteScalarAsync<long>(
            "SELECT count(*) FROM CollectionItems WHERE CollectionId = @Id", new { Id = colId }));
    }

    [Fact]
    public async Task DeleteItem_RemovesFts5Entry()
    {
        var col     = await PostCollectionAsync("Stamps");
        var colId   = col.GetProperty("id").GetString()!;
        var field   = await PostFieldAsync(colId, "Name", "text");
        var fieldId = field.GetProperty("id").GetString()!;

        var createResponse = await _client.PostAsJsonAsync($"/api/collections/{colId}/items",
            new { fieldValues = new Dictionary<string, string> { [fieldId] = "Penny Black" } });
        var itemId = JsonDocument.Parse(await createResponse.Content.ReadAsStringAsync())
            .RootElement.GetProperty("data").GetProperty("id").GetString()!;

        // Confirm FTS entry exists
        await using var conn = new SqliteConnection(_testConnString);
        await conn.OpenAsync();
        Assert.Equal(1L, await conn.ExecuteScalarAsync<long>(
            "SELECT count(*) FROM kaselog_search WHERE entity_id = @Id AND entity_type = 'collection_item'",
            new { Id = itemId }));

        var deleteResponse = await _client.DeleteAsync($"/api/items/{itemId}");
        Assert.Equal(HttpStatusCode.NoContent, deleteResponse.StatusCode);

        Assert.Equal(0L, await conn.ExecuteScalarAsync<long>(
            "SELECT count(*) FROM kaselog_search WHERE entity_id = @Id AND entity_type = 'collection_item'",
            new { Id = itemId }));
    }
}
