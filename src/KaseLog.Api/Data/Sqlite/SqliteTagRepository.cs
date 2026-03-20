using Dapper;
using KaseLog.Api.Models;

namespace KaseLog.Api.Data.Sqlite;

public sealed class SqliteTagRepository : ITagRepository
{
    private readonly IDbConnectionFactory _db;

    public SqliteTagRepository(IDbConnectionFactory db) => _db = db;

    public async Task<IEnumerable<TagDto>> GetAllAsync()
    {
        using var conn = await _db.OpenAsync();
        var rows = await conn.QueryAsync<TagRow>(
            "SELECT Id, Name, CreatedAt FROM Tags ORDER BY Name ASC");
        return rows.Select(Map);
    }

    public async Task<TagDto?> AddToLogAsync(Guid logId, string tagName)
    {
        var normalized = tagName.Trim().ToLowerInvariant();
        if (string.IsNullOrEmpty(normalized)) return null;

        using var conn = await _db.OpenAsync();

        var logExists = await conn.ExecuteScalarAsync<int>(
            "SELECT COUNT(*) FROM Logs WHERE Id = @LogId",
            new { LogId = logId.ToString() });
        if (logExists == 0) return null;

        // Upsert tag by name (idempotent)
        var existing = await conn.QuerySingleOrDefaultAsync<TagRow>(
            "SELECT Id, Name, CreatedAt FROM Tags WHERE Name = @Name",
            new { Name = normalized });

        string tagId;
        TagDto tag;
        if (existing is not null)
        {
            tagId = existing.Id;
            tag = Map(existing);
        }
        else
        {
            tagId = Guid.NewGuid().ToString();
            var now = DateTime.UtcNow.ToString("O");
            await conn.ExecuteAsync(
                "INSERT OR IGNORE INTO Tags (Id, Name, CreatedAt) VALUES (@Id, @Name, @Now)",
                new { Id = tagId, Name = normalized, Now = now });

            var created = await conn.QuerySingleOrDefaultAsync<TagRow>(
                "SELECT Id, Name, CreatedAt FROM Tags WHERE Name = @Name",
                new { Name = normalized });
            if (created is null) return null;
            tagId = created.Id;
            tag = Map(created);
        }

        // Link tag to log (idempotent)
        await conn.ExecuteAsync(
            "INSERT OR IGNORE INTO LogTags (LogId, TagId) VALUES (@LogId, @TagId)",
            new { LogId = logId.ToString(), TagId = tagId });

        return tag;
    }

    public async Task<bool> RemoveFromLogAsync(Guid logId, Guid tagId)
    {
        using var conn = await _db.OpenAsync();
        var affected = await conn.ExecuteAsync(
            "DELETE FROM LogTags WHERE LogId = @LogId AND TagId = @TagId",
            new { LogId = logId.ToString(), TagId = tagId.ToString() });
        return affected > 0;
    }

    private static TagDto Map(TagRow row) => new()
    {
        Id = Guid.Parse(row.Id),
        Name = row.Name,
        CreatedAt = DateTime.Parse(row.CreatedAt, null, System.Globalization.DateTimeStyles.RoundtripKind),
    };

    private sealed class TagRow
    {
        public string Id { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string CreatedAt { get; set; } = string.Empty;
    }
}
