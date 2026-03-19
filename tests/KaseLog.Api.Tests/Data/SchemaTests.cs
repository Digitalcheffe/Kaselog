using Dapper;
using KaseLog.Api.Data;
using KaseLog.Api.Data.Sqlite;
using Microsoft.Data.Sqlite;

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
            "SELECT count(*) FROM kaselog_search WHERE log_id = @LogId",
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
            "SELECT count(*) FROM kaselog_search WHERE log_id = @LogId", new { LogId = logId }));

        await conn.ExecuteAsync("DELETE FROM LogVersions WHERE Id = @Id", new { Id = versionId });

        // No remaining versions — FTS entry should be gone
        Assert.Equal(0L, await conn.ExecuteScalarAsync<long>(
            "SELECT count(*) FROM kaselog_search WHERE log_id = @LogId", new { LogId = logId }));
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
            "SELECT content FROM kaselog_search WHERE log_id = @LogId",
            new { LogId = logId });

        Assert.Equal("version two content", ftsContent);
    }
}
