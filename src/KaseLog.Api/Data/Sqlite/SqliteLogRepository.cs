using Dapper;
using KaseLog.Api.Models;

namespace KaseLog.Api.Data.Sqlite;

public sealed class SqliteLogRepository : ILogRepository
{
    private readonly IDbConnectionFactory _db;

    public SqliteLogRepository(IDbConnectionFactory db) => _db = db;

    public async Task<IEnumerable<LogResponse>> GetByKaseIdAsync(Guid kaseId)
    {
        using var conn = await _db.OpenAsync();
        var rows = (await conn.QueryAsync<LogRow>("""
            SELECT l.Id, l.KaseId, l.Title, l.Description, l.AutosaveEnabled, l.IsPinned, l.CreatedAt, l.UpdatedAt,
                   COALESCE((SELECT Content FROM LogVersions WHERE LogId = l.Id ORDER BY CreatedAt DESC LIMIT 1), '') AS Content,
                   (SELECT COUNT(*) FROM LogVersions WHERE LogId = l.Id) AS VersionCount
            FROM Logs l
            WHERE l.KaseId = @KaseId
            ORDER BY l.UpdatedAt DESC
            """, new { KaseId = kaseId.ToString() })).ToList();

        if (rows.Count == 0) return [];

        var logIds = rows.Select(r => r.Id).ToList();
        var tagsByLogId = await FetchTagsByLogIdsAsync(conn, logIds);
        return rows.Select(r => Map(r, tagsByLogId.GetValueOrDefault(r.Id, [])));
    }

    public async Task<LogResponse?> GetByIdAsync(Guid id)
    {
        using var conn = await _db.OpenAsync();
        var row = await conn.QuerySingleOrDefaultAsync<LogRow>("""
            SELECT l.Id, l.KaseId, l.Title, l.Description, l.AutosaveEnabled, l.IsPinned, l.CreatedAt, l.UpdatedAt,
                   COALESCE((SELECT Content FROM LogVersions WHERE LogId = l.Id ORDER BY CreatedAt DESC LIMIT 1), '') AS Content,
                   (SELECT COUNT(*) FROM LogVersions WHERE LogId = l.Id) AS VersionCount
            FROM Logs l
            WHERE l.Id = @Id
            """, new { Id = id.ToString() });
        if (row is null) return null;

        var tagsByLogId = await FetchTagsByLogIdsAsync(conn, [row.Id]);
        return Map(row, tagsByLogId.GetValueOrDefault(row.Id, []));
    }

    public async Task<LogResponse?> CreateAsync(Guid kaseId, string title, string? description, bool autosaveEnabled)
    {
        var logId = Guid.NewGuid();
        var versionId = Guid.NewGuid();
        var now = DateTime.UtcNow;
        var nowStr = now.ToString("O");

        using var conn = await _db.OpenAsync();

        var kaseExists = await conn.ExecuteScalarAsync<int>(
            "SELECT COUNT(*) FROM Kases WHERE Id = @KaseId",
            new { KaseId = kaseId.ToString() });

        if (kaseExists == 0) return null;

        using var tx = conn.BeginTransaction();
        try
        {
            await conn.ExecuteAsync("""
                INSERT INTO Logs (Id, KaseId, Title, Description, AutosaveEnabled, CreatedAt, UpdatedAt)
                VALUES (@Id, @KaseId, @Title, @Description, @AutosaveEnabled, @Now, @Now)
                """,
                new
                {
                    Id = logId.ToString(),
                    KaseId = kaseId.ToString(),
                    Title = title,
                    Description = description,
                    AutosaveEnabled = autosaveEnabled ? 1 : 0,
                    Now = nowStr,
                }, tx);

            await conn.ExecuteAsync("""
                INSERT INTO LogVersions (Id, LogId, Content, Label, IsAutosave, CreatedAt)
                VALUES (@Id, @LogId, '', NULL, 1, @Now)
                """,
                new { Id = versionId.ToString(), LogId = logId.ToString(), Now = nowStr }, tx);

            tx.Commit();
        }
        catch
        {
            tx.Rollback();
            throw;
        }

        return await GetByIdAsync(logId);
    }

    public async Task<LogResponse?> UpdateAsync(Guid id, string title, string? description, bool autosaveEnabled)
    {
        var nowStr = DateTime.UtcNow.ToString("O");
        using var conn = await _db.OpenAsync();
        var affected = await conn.ExecuteAsync("""
            UPDATE Logs SET Title = @Title, Description = @Description, AutosaveEnabled = @AutosaveEnabled, UpdatedAt = @Now
            WHERE Id = @Id
            """,
            new { Id = id.ToString(), Title = title, Description = description, AutosaveEnabled = autosaveEnabled ? 1 : 0, Now = nowStr });

        if (affected == 0) return null;
        return await GetByIdAsync(id);
    }

    public async Task<LogResponse?> SetPinnedAsync(Guid id, bool pinned)
    {
        using var conn = await _db.OpenAsync();
        var affected = await conn.ExecuteAsync(
            "UPDATE Logs SET IsPinned = @IsPinned WHERE Id = @Id",
            new { Id = id.ToString(), IsPinned = pinned ? 1 : 0 });
        if (affected == 0) return null;
        return await GetByIdAsync(id);
    }

    public async Task<bool> DeleteAsync(Guid id)
    {
        using var conn = await _db.OpenAsync();
        var affected = await conn.ExecuteAsync(
            "DELETE FROM Logs WHERE Id = @Id",
            new { Id = id.ToString() });
        return affected > 0;
    }

    public async Task<IEnumerable<LogVersionResponse>> GetVersionsAsync(Guid logId)
    {
        using var conn = await _db.OpenAsync();
        var rows = await conn.QueryAsync<VersionRow>("""
            SELECT Id, LogId, Content, Label, IsAutosave, CreatedAt
            FROM LogVersions
            WHERE LogId = @LogId
            ORDER BY CreatedAt DESC
            """, new { LogId = logId.ToString() });
        return rows.Select(MapVersion);
    }

    public async Task<LogVersionResponse?> GetVersionByIdAsync(Guid logId, Guid versionId)
    {
        using var conn = await _db.OpenAsync();
        var row = await conn.QuerySingleOrDefaultAsync<VersionRow>("""
            SELECT Id, LogId, Content, Label, IsAutosave, CreatedAt
            FROM LogVersions
            WHERE LogId = @LogId AND Id = @Id
            """, new { LogId = logId.ToString(), Id = versionId.ToString() });
        return row is null ? null : MapVersion(row);
    }

    public async Task<LogVersionResponse?> AddVersionAsync(Guid logId, string content, string? label, bool isAutosave)
    {
        using var conn = await _db.OpenAsync();

        var logExists = await conn.ExecuteScalarAsync<int>(
            "SELECT COUNT(*) FROM Logs WHERE Id = @LogId",
            new { LogId = logId.ToString() });

        if (logExists == 0) return null;

        var versionId = Guid.NewGuid();
        var nowStr = DateTime.UtcNow.ToString("O");

        await conn.ExecuteAsync("""
            INSERT INTO LogVersions (Id, LogId, Content, Label, IsAutosave, CreatedAt)
            VALUES (@Id, @LogId, @Content, @Label, @IsAutosave, @Now)
            """,
            new
            {
                Id = versionId.ToString(),
                LogId = logId.ToString(),
                Content = content,
                Label = label,
                IsAutosave = isAutosave ? 1 : 0,
                Now = nowStr,
            });

        await conn.ExecuteAsync(
            "UPDATE Logs SET UpdatedAt = @Now WHERE Id = @LogId",
            new { LogId = logId.ToString(), Now = nowStr });

        return await GetVersionByIdAsync(logId, versionId);
    }

    public async Task<LogVersionResponse?> RestoreVersionAsync(Guid logId, Guid versionId)
    {
        using var conn = await _db.OpenAsync();

        var sourceVersion = await conn.QuerySingleOrDefaultAsync<VersionRow>("""
            SELECT Id, LogId, Content, Label, IsAutosave, CreatedAt
            FROM LogVersions
            WHERE LogId = @LogId AND Id = @Id
            """, new { LogId = logId.ToString(), Id = versionId.ToString() });

        if (sourceVersion is null) return null;

        var newVersionId = Guid.NewGuid();
        var nowStr = DateTime.UtcNow.ToString("O");

        await conn.ExecuteAsync("""
            INSERT INTO LogVersions (Id, LogId, Content, Label, IsAutosave, CreatedAt)
            VALUES (@Id, @LogId, @Content, NULL, 0, @Now)
            """,
            new { Id = newVersionId.ToString(), LogId = logId.ToString(), Content = sourceVersion.Content, Now = nowStr });

        await conn.ExecuteAsync(
            "UPDATE Logs SET UpdatedAt = @Now WHERE Id = @LogId",
            new { LogId = logId.ToString(), Now = nowStr });

        return await GetVersionByIdAsync(logId, newVersionId);
    }

    private static async Task<Dictionary<string, IReadOnlyList<TagDto>>> FetchTagsByLogIdsAsync(
        System.Data.IDbConnection conn, IEnumerable<string> logIds)
    {
        var ids = logIds.ToList();
        if (ids.Count == 0) return [];

        var tagRows = await conn.QueryAsync<TagRow>(
            "SELECT t.Id, t.Name, t.CreatedAt, lt.LogId FROM Tags t JOIN LogTags lt ON lt.TagId = t.Id WHERE lt.LogId IN @Ids",
            new { Ids = ids });

        return tagRows
            .GroupBy(r => r.LogId)
            .ToDictionary(
                g => g.Key,
                g => (IReadOnlyList<TagDto>)g.Select(r => new TagDto
                {
                    Id = Guid.Parse(r.Id),
                    Name = r.Name,
                    CreatedAt = DateTime.Parse(r.CreatedAt, null, System.Globalization.DateTimeStyles.RoundtripKind),
                }).ToList());
    }

    private static LogResponse Map(LogRow row, IReadOnlyList<TagDto> tags) => new()
    {
        Id = Guid.Parse(row.Id),
        KaseId = Guid.Parse(row.KaseId),
        Title = row.Title,
        Description = row.Description,
        AutosaveEnabled = row.AutosaveEnabled != 0,
        IsPinned = row.IsPinned != 0,
        Content = row.Content,
        VersionCount = (int)row.VersionCount,
        Tags = tags,
        CreatedAt = DateTime.Parse(row.CreatedAt, null, System.Globalization.DateTimeStyles.RoundtripKind),
        UpdatedAt = DateTime.Parse(row.UpdatedAt, null, System.Globalization.DateTimeStyles.RoundtripKind),
    };

    private static LogVersionResponse MapVersion(VersionRow row) => new()
    {
        Id = Guid.Parse(row.Id),
        LogId = Guid.Parse(row.LogId),
        Content = row.Content,
        Label = row.Label,
        IsAutosave = row.IsAutosave != 0,
        CreatedAt = DateTime.Parse(row.CreatedAt, null, System.Globalization.DateTimeStyles.RoundtripKind),
    };

    private sealed class LogRow
    {
        public string Id { get; set; } = string.Empty;
        public string KaseId { get; set; } = string.Empty;
        public string Title { get; set; } = string.Empty;
        public string? Description { get; set; }
        public int AutosaveEnabled { get; set; }
        public int IsPinned { get; set; }
        public string Content { get; set; } = string.Empty;
        public long VersionCount { get; set; }
        public string CreatedAt { get; set; } = string.Empty;
        public string UpdatedAt { get; set; } = string.Empty;
    }

    private sealed class VersionRow
    {
        public string Id { get; set; } = string.Empty;
        public string LogId { get; set; } = string.Empty;
        public string Content { get; set; } = string.Empty;
        public string? Label { get; set; }
        public int IsAutosave { get; set; }
        public string CreatedAt { get; set; } = string.Empty;
    }

    private sealed class TagRow
    {
        public string Id { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string CreatedAt { get; set; } = string.Empty;
        public string LogId { get; set; } = string.Empty;
    }
}
