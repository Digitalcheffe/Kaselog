using System.Data;
using Dapper;
using KaseLog.Api.Data;
using KaseLog.Api.Data.Sqlite;
using Microsoft.Data.Sqlite;
using Xunit;

namespace KaseLog.Api.Tests.Data;

/// <summary>
/// Verifies SQLite schema initialization and data integrity guarantees.
/// Each test gets an isolated named in-memory database. A "keepAlive" connection
/// is held open for the duration of the test so SQLite doesn't destroy the DB.
/// </summary>
public sealed class SchemaTests : IAsyncDisposable
{
    private readonly SqliteConnection _keepAlive;
    private readonly SqliteConnectionFactory _factory;

    public SchemaTests()
    {
        // Named shared-cache in-memory database — unique per test instance
        var name = $"kaselog_test_{Guid.NewGuid():N}";
        var cs = $"Data Source={name};Mode=Memory;Cache=Shared";

        _keepAlive = new SqliteConnection(cs);
        _keepAlive.Open();

        _factory = new SqliteConnectionFactory(cs);
    }

    public async ValueTask DisposeAsync()
    {
        await _keepAlive.DisposeAsync();
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private async Task InitializeAsync()
    {
        var initializer = new SqliteSchemaInitializer(_factory);
        await initializer.InitializeAsync();
    }

    private static string NewId() => Guid.NewGuid().ToString();
    private static string Now()   => DateTime.UtcNow.ToString("O");

    private async Task InsertKaseAsync(IDbConnection conn, string id, string title = "Test Kase")
    {
        var now = Now();
        await conn.ExecuteAsync(
            "INSERT INTO Kases(Id, Title, CreatedAt, UpdatedAt) VALUES (@Id, @Title, @Now, @Now)",
            new { Id = id, Title = title, Now = now });
    }

    private async Task InsertLogAsync(IDbConnection conn, string id, string kaseId, string title = "Test Log")
    {
        var now = Now();
        await conn.ExecuteAsync(
            "INSERT INTO Logs(Id, KaseId, Title, CreatedAt, UpdatedAt) VALUES (@Id, @KaseId, @Title, @Now, @Now)",
            new { Id = id, KaseId = kaseId, Title = title, Now = now });
    }

    private async Task InsertLogVersionAsync(IDbConnection conn, string id, string logId, string content = "Hello world")
    {
        await conn.ExecuteAsync(
            "INSERT INTO LogVersions(Id, LogId, Content, IsAutosave, CreatedAt) VALUES (@Id, @LogId, @Content, 1, @Now)",
            new { Id = id, LogId = logId, Content = content, Now = Now() });
    }

    private async Task InsertTagAsync(IDbConnection conn, string id, string name = "test-tag")
    {
        await conn.ExecuteAsync(
            "INSERT INTO Tags(Id, Name, CreatedAt) VALUES (@Id, @Name, @Now)",
            new { Id = id, Name = name, Now = Now() });
    }

    private async Task InsertLogTagAsync(IDbConnection conn, string logId, string tagId)
    {
        await conn.ExecuteAsync(
            "INSERT INTO LogTags(LogId, TagId) VALUES (@LogId, @TagId)",
            new { LogId = logId, TagId = tagId });
    }

    private async Task InsertCollectionAsync(IDbConnection conn, string id, string title = "Test Collection", string color = "teal")
    {
        var now = Now();
        await conn.ExecuteAsync(
            "INSERT INTO Collections(Id, Title, Color, CreatedAt, UpdatedAt) VALUES (@Id, @Title, @Color, @Now, @Now)",
            new { Id = id, Title = title, Color = color, Now = now });
    }

    private async Task InsertCollectionFieldAsync(IDbConnection conn, string id, string collectionId,
        string name = "Field", string type = "text", int sortOrder = 0)
    {
        await conn.ExecuteAsync(
            "INSERT INTO CollectionFields(Id, CollectionId, Name, Type, SortOrder) VALUES (@Id, @CollectionId, @Name, @Type, @SortOrder)",
            new { Id = id, CollectionId = collectionId, Name = name, Type = type, SortOrder = sortOrder });
    }

    private async Task InsertCollectionLayoutAsync(IDbConnection conn, string id, string collectionId, string layout = "[]")
    {
        await conn.ExecuteAsync(
            "INSERT INTO CollectionLayout(Id, CollectionId, Layout) VALUES (@Id, @CollectionId, @Layout)",
            new { Id = id, CollectionId = collectionId, Layout = layout });
    }

    private async Task InsertCollectionItemAsync(IDbConnection conn, string id, string collectionId,
        string fieldValues = "{}", string? kaseId = null)
    {
        var now = Now();
        await conn.ExecuteAsync(
            "INSERT INTO CollectionItems(Id, CollectionId, KaseId, FieldValues, CreatedAt, UpdatedAt) VALUES (@Id, @CollectionId, @KaseId, @FieldValues, @Now, @Now)",
            new { Id = id, CollectionId = collectionId, KaseId = kaseId, FieldValues = fieldValues, Now = now });
    }

    // ── Tests ─────────────────────────────────────────────────────────────────

    [Fact]
    public async Task Schema_InitializesOnFreshDatabase_WithoutErrors()
    {
        var ex = await Record.ExceptionAsync(InitializeAsync);
        Assert.Null(ex);
    }

    [Fact]
    public async Task Schema_IsIdempotent_CallingTwiceDoesNotThrow()
    {
        var ex = await Record.ExceptionAsync(async () =>
        {
            await InitializeAsync();
            await InitializeAsync();
        });
        Assert.Null(ex);
    }

    [Fact]
    public async Task Schema_AllTablesAndFtsExistAfterInitialization()
    {
        await InitializeAsync();

        using var conn = await _factory.OpenAsync();

        var tables = (await conn.QueryAsync<string>(
            "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'"))
            .ToHashSet();

        Assert.Contains("Kases",          tables);
        Assert.Contains("Logs",           tables);
        Assert.Contains("LogVersions",    tables);
        Assert.Contains("Tags",           tables);
        Assert.Contains("LogTags",        tables);
        Assert.Contains("kaselog_search", tables);
    }

    [Fact]
    public async Task Cascade_DeletingKase_RemovesLogsAndLogVersions()
    {
        await InitializeAsync();

        using var conn = await _factory.OpenAsync();

        var kaseId      = NewId();
        var logId       = NewId();
        var versionId   = NewId();

        await InsertKaseAsync(conn, kaseId);
        await InsertLogAsync(conn, logId, kaseId);
        await InsertLogVersionAsync(conn, versionId, logId);

        // Sanity: rows exist before delete
        Assert.Equal(1L, await conn.ExecuteScalarAsync<long>("SELECT count(*) FROM Logs WHERE Id = @Id", new { Id = logId }));
        Assert.Equal(1L, await conn.ExecuteScalarAsync<long>("SELECT count(*) FROM LogVersions WHERE Id = @Id", new { Id = versionId }));

        await conn.ExecuteAsync("DELETE FROM Kases WHERE Id = @Id", new { Id = kaseId });

        Assert.Equal(0L, await conn.ExecuteScalarAsync<long>("SELECT count(*) FROM Logs WHERE Id = @Id", new { Id = logId }));
        Assert.Equal(0L, await conn.ExecuteScalarAsync<long>("SELECT count(*) FROM LogVersions WHERE Id = @Id", new { Id = versionId }));
    }

    [Fact]
    public async Task Cascade_DeletingLog_RemovesLogVersionsAndLogTags()
    {
        await InitializeAsync();

        using var conn = await _factory.OpenAsync();

        var kaseId    = NewId();
        var logId     = NewId();
        var tagId     = NewId();
        var versionId = NewId();

        await InsertKaseAsync(conn, kaseId);
        await InsertLogAsync(conn, logId, kaseId);
        await InsertTagAsync(conn, tagId);
        await InsertLogTagAsync(conn, logId, tagId);
        await InsertLogVersionAsync(conn, versionId, logId);

        await conn.ExecuteAsync("DELETE FROM Logs WHERE Id = @Id", new { Id = logId });

        Assert.Equal(0L, await conn.ExecuteScalarAsync<long>("SELECT count(*) FROM LogVersions WHERE LogId = @Id", new { Id = logId }));
        Assert.Equal(0L, await conn.ExecuteScalarAsync<long>("SELECT count(*) FROM LogTags WHERE LogId = @Id", new { Id = logId }));
    }

    [Fact]
    public async Task Fts_UpdatesOnLogVersionInsert()
    {
        await InitializeAsync();

        using var conn = await _factory.OpenAsync();

        var kaseId    = NewId();
        var logId     = NewId();
        var versionId = NewId();

        await InsertKaseAsync(conn, kaseId);
        await InsertLogAsync(conn, logId, kaseId);
        await InsertLogVersionAsync(conn, versionId, logId, "searchable content here");

        var count = await conn.ExecuteScalarAsync<long>(
            "SELECT count(*) FROM kaselog_search WHERE entity_id = @LogId AND entity_type = 'log'",
            new { LogId = logId });

        Assert.Equal(1L, count);
    }

    [Fact]
    public async Task Fts_UpdatesOnLogVersionDelete()
    {
        await InitializeAsync();

        using var conn = await _factory.OpenAsync();

        var kaseId    = NewId();
        var logId     = NewId();
        var versionId = NewId();

        await InsertKaseAsync(conn, kaseId);
        await InsertLogAsync(conn, logId, kaseId);
        await InsertLogVersionAsync(conn, versionId, logId);

        // Confirm FTS entry exists
        Assert.Equal(1L, await conn.ExecuteScalarAsync<long>(
            "SELECT count(*) FROM kaselog_search WHERE entity_id = @LogId AND entity_type = 'log'",
            new { LogId = logId }));

        await conn.ExecuteAsync("DELETE FROM LogVersions WHERE Id = @Id", new { Id = versionId });

        // No remaining versions — FTS entry should be gone
        Assert.Equal(0L, await conn.ExecuteScalarAsync<long>(
            "SELECT count(*) FROM kaselog_search WHERE entity_id = @LogId AND entity_type = 'log'",
            new { LogId = logId }));
    }

    [Fact]
    public async Task Fts_DeleteOldestVersion_ReindexesWithNewerVersion()
    {
        await InitializeAsync();

        using var conn = await _factory.OpenAsync();

        var kaseId  = NewId();
        var logId   = NewId();
        var v1Id    = NewId();
        var v2Id    = NewId();

        await InsertKaseAsync(conn, kaseId);
        await InsertLogAsync(conn, logId, kaseId);

        // Insert two versions; v2 is newer
        await InsertLogVersionAsync(conn, v1Id, logId, "version one content");
        await Task.Delay(1); // ensure distinct CreatedAt ordering
        await InsertLogVersionAsync(conn, v2Id, logId, "version two content");

        // Delete the older version — FTS should still reflect v2
        await conn.ExecuteAsync("DELETE FROM LogVersions WHERE Id = @Id", new { Id = v1Id });

        var ftsContent = await conn.ExecuteScalarAsync<string>(
            "SELECT content FROM kaselog_search WHERE entity_id = @LogId AND entity_type = 'log'",
            new { LogId = logId });

        Assert.Equal("version two content", ftsContent);
    }

    // ── Collections schema tests ───────────────────────────────────────────────

    [Fact]
    public async Task Collections_AllTablesInitializeCorrectly()
    {
        await InitializeAsync();

        using var conn = await _factory.OpenAsync();

        var tables = (await conn.QueryAsync<string>(
            "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'"))
            .ToHashSet();

        Assert.Contains("Collections",       tables);
        Assert.Contains("CollectionFields",  tables);
        Assert.Contains("CollectionLayout",  tables);
        Assert.Contains("CollectionItems",   tables);
    }

    [Fact]
    public async Task Collections_Cascade_DeletingCollection_RemovesFieldsLayoutAndItems()
    {
        await InitializeAsync();

        using var conn = await _factory.OpenAsync();

        var collectionId = NewId();
        var fieldId      = NewId();
        var layoutId     = NewId();
        var itemId       = NewId();

        await InsertCollectionAsync(conn, collectionId);
        await InsertCollectionFieldAsync(conn, fieldId, collectionId);
        await InsertCollectionLayoutAsync(conn, layoutId, collectionId);
        await InsertCollectionItemAsync(conn, itemId, collectionId);

        await conn.ExecuteAsync("DELETE FROM Collections WHERE Id = @Id", new { Id = collectionId });

        Assert.Equal(0L, await conn.ExecuteScalarAsync<long>(
            "SELECT count(*) FROM CollectionFields WHERE CollectionId = @Id", new { Id = collectionId }));
        Assert.Equal(0L, await conn.ExecuteScalarAsync<long>(
            "SELECT count(*) FROM CollectionLayout WHERE CollectionId = @Id", new { Id = collectionId }));
        Assert.Equal(0L, await conn.ExecuteScalarAsync<long>(
            "SELECT count(*) FROM CollectionItems WHERE CollectionId = @Id", new { Id = collectionId }));
    }

    [Fact]
    public async Task Collections_DeletingKase_SetsKaseIdNullOnLinkedItems()
    {
        await InitializeAsync();

        using var conn = await _factory.OpenAsync();

        var kaseId       = NewId();
        var collectionId = NewId();
        var itemId       = NewId();

        await InsertKaseAsync(conn, kaseId);
        await InsertCollectionAsync(conn, collectionId);
        await InsertCollectionItemAsync(conn, itemId, collectionId, kaseId: kaseId);

        // Sanity: KaseId is set before delete
        var kaseIdBefore = await conn.ExecuteScalarAsync<string?>(
            "SELECT KaseId FROM CollectionItems WHERE Id = @Id", new { Id = itemId });
        Assert.Equal(kaseId, kaseIdBefore);

        await conn.ExecuteAsync("DELETE FROM Kases WHERE Id = @Id", new { Id = kaseId });

        // Item still exists, KaseId is NULL
        var kaseIdAfter = await conn.ExecuteScalarAsync<string?>(
            "SELECT KaseId FROM CollectionItems WHERE Id = @Id", new { Id = itemId });
        Assert.Null(kaseIdAfter);

        Assert.Equal(1L, await conn.ExecuteScalarAsync<long>(
            "SELECT count(*) FROM CollectionItems WHERE Id = @Id", new { Id = itemId }));
    }

    [Fact]
    public async Task Collections_FieldReorder_UpdatesSortOrderAtomically()
    {
        await InitializeAsync();

        using var conn = await _factory.OpenAsync();

        var collectionId = NewId();
        var fieldA       = NewId();
        var fieldB       = NewId();
        var fieldC       = NewId();

        await InsertCollectionAsync(conn, collectionId);
        await InsertCollectionFieldAsync(conn, fieldA, collectionId, "Field A", sortOrder: 0);
        await InsertCollectionFieldAsync(conn, fieldB, collectionId, "Field B", sortOrder: 1);
        await InsertCollectionFieldAsync(conn, fieldC, collectionId, "Field C", sortOrder: 2);

        // Reverse the order atomically
        using var tx = conn.BeginTransaction();
        await conn.ExecuteAsync("UPDATE CollectionFields SET SortOrder = @S WHERE Id = @Id",
            new { Id = fieldA, S = 2 }, tx);
        await conn.ExecuteAsync("UPDATE CollectionFields SET SortOrder = @S WHERE Id = @Id",
            new { Id = fieldB, S = 1 }, tx);
        await conn.ExecuteAsync("UPDATE CollectionFields SET SortOrder = @S WHERE Id = @Id",
            new { Id = fieldC, S = 0 }, tx);
        tx.Commit();

        var orders = (await conn.QueryAsync<(string Id, int SortOrder)>(
            "SELECT Id, SortOrder FROM CollectionFields WHERE CollectionId = @Id ORDER BY SortOrder",
            new { Id = collectionId })).ToList();

        Assert.Equal(fieldC, orders[0].Id);
        Assert.Equal(fieldB, orders[1].Id);
        Assert.Equal(fieldA, orders[2].Id);
    }

    [Fact]
    public async Task Collections_Layout_UniquePerCollection_UpsertBehavior()
    {
        await InitializeAsync();

        using var conn = await _factory.OpenAsync();

        var collectionId = NewId();
        var layoutId1    = NewId();
        var layoutId2    = NewId();

        await InsertCollectionAsync(conn, collectionId);
        await InsertCollectionLayoutAsync(conn, layoutId1, collectionId, "[{\"cells\":[]}]");

        // Upsert: replace layout for same collection
        await conn.ExecuteAsync("""
            INSERT INTO CollectionLayout(Id, CollectionId, Layout)
            VALUES (@Id, @CollectionId, @Layout)
            ON CONFLICT(CollectionId) DO UPDATE SET Layout = excluded.Layout
            """,
            new { Id = layoutId2, CollectionId = collectionId, Layout = "[{\"cells\":[]},{\"cells\":[]}]" });

        var count = await conn.ExecuteScalarAsync<long>(
            "SELECT count(*) FROM CollectionLayout WHERE CollectionId = @Id", new { Id = collectionId });
        var layout = await conn.ExecuteScalarAsync<string>(
            "SELECT Layout FROM CollectionLayout WHERE CollectionId = @Id", new { Id = collectionId });

        Assert.Equal(1L, count);
        Assert.Equal("[{\"cells\":[]},{\"cells\":[]}]", layout);
    }

    [Fact]
    public async Task Collections_Fts_UpdatesOnCollectionItemInsert()
    {
        await InitializeAsync();

        using var conn = await _factory.OpenAsync();

        var collectionId = NewId();
        var fieldId      = NewId();
        var itemId       = NewId();

        await InsertCollectionAsync(conn, collectionId, "My Books");
        await InsertCollectionFieldAsync(conn, fieldId, collectionId, "Title", "text", sortOrder: 0);
        var fieldValues = $"{{\"{fieldId}\": \"Dune\"}}";
        await InsertCollectionItemAsync(conn, itemId, collectionId, fieldValues);

        var entityType = await conn.ExecuteScalarAsync<string>(
            "SELECT entity_type FROM kaselog_search WHERE entity_id = @Id",
            new { Id = itemId });

        Assert.Equal("collection_item", entityType);
    }

    [Fact]
    public async Task Collections_Fts_UpdatesOnCollectionItemUpdate()
    {
        await InitializeAsync();

        using var conn = await _factory.OpenAsync();

        var collectionId = NewId();
        var fieldId      = NewId();
        var itemId       = NewId();

        await InsertCollectionAsync(conn, collectionId);
        await InsertCollectionFieldAsync(conn, fieldId, collectionId, "Title", "text", sortOrder: 0);
        var fieldValues = $"{{\"{fieldId}\": \"Original\"}}";
        await InsertCollectionItemAsync(conn, itemId, collectionId, fieldValues);

        // Update the item with new field values
        var updatedValues = $"{{\"{fieldId}\": \"Updated\"}}";
        await conn.ExecuteAsync(
            "UPDATE CollectionItems SET FieldValues = @FV, UpdatedAt = @Now WHERE Id = @Id",
            new { FV = updatedValues, Now = Now(), Id = itemId });

        var ftsTitle = await conn.ExecuteScalarAsync<string>(
            "SELECT title FROM kaselog_search WHERE entity_id = @Id AND entity_type = 'collection_item'",
            new { Id = itemId });

        Assert.Equal("Updated", ftsTitle);
    }

    [Fact]
    public async Task Collections_Fts_EntryRemovedOnCollectionItemDelete()
    {
        await InitializeAsync();

        using var conn = await _factory.OpenAsync();

        var collectionId = NewId();
        var itemId       = NewId();

        await InsertCollectionAsync(conn, collectionId);
        await InsertCollectionItemAsync(conn, itemId, collectionId);

        Assert.Equal(1L, await conn.ExecuteScalarAsync<long>(
            "SELECT count(*) FROM kaselog_search WHERE entity_id = @Id AND entity_type = 'collection_item'",
            new { Id = itemId }));

        await conn.ExecuteAsync("DELETE FROM CollectionItems WHERE Id = @Id", new { Id = itemId });

        Assert.Equal(0L, await conn.ExecuteScalarAsync<long>(
            "SELECT count(*) FROM kaselog_search WHERE entity_id = @Id AND entity_type = 'collection_item'",
            new { Id = itemId }));
    }

    [Fact]
    public async Task Collections_Fts_SearchReturnsBothLogAndCollectionItemEntityTypes()
    {
        await InitializeAsync();

        using var conn = await _factory.OpenAsync();

        // Insert a log with FTS entry
        var kaseId       = NewId();
        var logId        = NewId();
        var versionId    = NewId();
        var collectionId = NewId();
        var fieldId      = NewId();
        var itemId       = NewId();

        await InsertKaseAsync(conn, kaseId);
        await InsertLogAsync(conn, logId, kaseId);
        await InsertLogVersionAsync(conn, versionId, logId, "searchable log content");

        // Insert a collection item with FTS entry
        await InsertCollectionAsync(conn, collectionId);
        await InsertCollectionFieldAsync(conn, fieldId, collectionId, "Name", "text", sortOrder: 0);
        var fieldValues = $"{{\"{fieldId}\": \"searchable item\"}}";
        await InsertCollectionItemAsync(conn, itemId, collectionId, fieldValues);

        var entityTypes = (await conn.QueryAsync<string>(
            "SELECT entity_type FROM kaselog_search ORDER BY entity_type"))
            .ToList();

        Assert.Contains("log",             entityTypes);
        Assert.Contains("collection_item", entityTypes);
    }
}
