using System.Text.Json;
using Dapper;
using KaseLog.Api.Models;

namespace KaseLog.Api.Data.Sqlite;

public sealed class SqliteKaseRepository : IKaseRepository
{
    private readonly IDbConnectionFactory _db;

    public SqliteKaseRepository(IDbConnectionFactory db) => _db = db;

    public async Task<IEnumerable<KaseResponse>> GetAllAsync()
    {
        using var conn = await _db.OpenAsync();
        var rows = await conn.QueryAsync<KaseRow>("""
            SELECT k.Id, k.Title, k.Description, k.CreatedAt, k.UpdatedAt,
                   COUNT(l.Id) AS LogCount
            FROM Kases k
            LEFT JOIN Logs l ON l.KaseId = k.Id
            GROUP BY k.Id
            ORDER BY k.UpdatedAt DESC
            """);
        return rows.Select(Map);
    }

    public async Task<KaseResponse?> GetByIdAsync(Guid id)
    {
        using var conn = await _db.OpenAsync();
        var row = await conn.QuerySingleOrDefaultAsync<KaseRow>("""
            SELECT k.Id, k.Title, k.Description, k.CreatedAt, k.UpdatedAt,
                   COUNT(l.Id) AS LogCount
            FROM Kases k
            LEFT JOIN Logs l ON l.KaseId = k.Id
            WHERE k.Id = @Id
            GROUP BY k.Id
            """, new { Id = id.ToString() });
        return row is null ? null : Map(row);
    }

    public async Task<KaseResponse> CreateAsync(string title, string? description)
    {
        var id = Guid.NewGuid();
        var now = DateTime.UtcNow;
        var nowStr = now.ToString("O");

        using var conn = await _db.OpenAsync();
        await conn.ExecuteAsync("""
            INSERT INTO Kases (Id, Title, Description, CreatedAt, UpdatedAt)
            VALUES (@Id, @Title, @Description, @Now, @Now)
            """,
            new { Id = id.ToString(), Title = title, Description = description, Now = nowStr });

        return new KaseResponse
        {
            Id = id,
            Title = title,
            Description = description,
            LogCount = 0,
            CreatedAt = now,
            UpdatedAt = now,
        };
    }

    public async Task<KaseResponse?> UpdateAsync(Guid id, string title, string? description)
    {
        var nowStr = DateTime.UtcNow.ToString("O");

        using var conn = await _db.OpenAsync();
        var affected = await conn.ExecuteAsync("""
            UPDATE Kases SET Title = @Title, Description = @Description, UpdatedAt = @Now
            WHERE Id = @Id
            """,
            new { Id = id.ToString(), Title = title, Description = description, Now = nowStr });

        if (affected == 0) return null;

        return await GetByIdAsync(id);
    }

    public async Task<bool> DeleteAsync(Guid id)
    {
        using var conn = await _db.OpenAsync();
        var affected = await conn.ExecuteAsync(
            "DELETE FROM Kases WHERE Id = @Id",
            new { Id = id.ToString() });
        return affected > 0;
    }

    public async Task<IEnumerable<TimelineEntryResponse>> GetTimelineAsync(Guid kaseId, int page, int pageSize)
    {
        using var conn = await _db.OpenAsync();

        var rows = await conn.QueryAsync<TimelineRow>("""
            SELECT
                'log'             AS EntityType,
                l.Id              AS Id,
                l.CreatedAt       AS CreatedAt,
                l.Title           AS Title,
                l.Description     AS Description,
                (SELECT COUNT(*) FROM LogVersions WHERE LogId = l.Id) AS VersionCount,
                NULL              AS CollectionId,
                NULL              AS CollectionTitle,
                NULL              AS CollectionColor,
                NULL              AS FieldValues
            FROM Logs l
            WHERE l.KaseId = @KaseId
            UNION ALL
            SELECT
                'collection_item' AS EntityType,
                ci.Id             AS Id,
                ci.CreatedAt      AS CreatedAt,
                NULL              AS Title,
                NULL              AS Description,
                0                 AS VersionCount,
                ci.CollectionId   AS CollectionId,
                c.Title           AS CollectionTitle,
                c.Color           AS CollectionColor,
                ci.FieldValues    AS FieldValues
            FROM CollectionItems ci
            JOIN Collections c ON c.Id = ci.CollectionId
            WHERE ci.KaseId = @KaseId
            ORDER BY CreatedAt DESC
            LIMIT @PageSize OFFSET @Offset
            """,
            new { KaseId = kaseId.ToString(), PageSize = pageSize, Offset = (page - 1) * pageSize });

        var rowList = rows.ToList();

        // Fetch tags for any logs in the result
        var logIds = rowList
            .Where(r => r.EntityType == "log")
            .Select(r => r.Id)
            .ToList();

        Dictionary<string, List<string>> tagMap = [];
        if (logIds.Count > 0)
        {
            var tagRows = await conn.QueryAsync<(string LogId, string Name)>("""
                SELECT lt.LogId, t.Name
                FROM LogTags lt
                JOIN Tags t ON t.Id = lt.TagId
                WHERE lt.LogId IN @LogIds
                ORDER BY t.Name
                """, new { LogIds = logIds });

            foreach (var (logId, name) in tagRows)
            {
                if (!tagMap.TryGetValue(logId, out var list))
                {
                    list = [];
                    tagMap[logId] = list;
                }
                list.Add(name);
            }
        }

        return rowList.Select(r => r.EntityType == "log"
            ? new TimelineEntryResponse
            {
                EntityType   = "log",
                Id           = Guid.Parse(r.Id),
                CreatedAt    = DateTime.Parse(r.CreatedAt, null, System.Globalization.DateTimeStyles.RoundtripKind),
                Title        = r.Title,
                Description  = r.Description,
                VersionCount = (int)r.VersionCount,
                Tags         = tagMap.TryGetValue(r.Id, out var t) ? t : [],
            }
            : new TimelineEntryResponse
            {
                EntityType       = "collection_item",
                Id               = Guid.Parse(r.Id),
                CreatedAt        = DateTime.Parse(r.CreatedAt, null, System.Globalization.DateTimeStyles.RoundtripKind),
                CollectionId     = r.CollectionId is null ? null : Guid.Parse(r.CollectionId),
                CollectionTitle  = r.CollectionTitle,
                CollectionColor  = r.CollectionColor,
                FieldValues      = r.FieldValues is null
                    ? null
                    : JsonDocument.Parse(r.FieldValues).RootElement.Clone(),
            });
    }

    private sealed class TimelineRow
    {
        public string EntityType { get; set; } = string.Empty;
        public string Id { get; set; } = string.Empty;
        public string CreatedAt { get; set; } = string.Empty;
        public string? Title { get; set; }
        public string? Description { get; set; }
        public long VersionCount { get; set; }
        public string? CollectionId { get; set; }
        public string? CollectionTitle { get; set; }
        public string? CollectionColor { get; set; }
        public string? FieldValues { get; set; }
    }

    private static KaseResponse Map(KaseRow row) => new()
    {
        Id = Guid.Parse(row.Id),
        Title = row.Title,
        Description = row.Description,
        LogCount = (int)row.LogCount,
        CreatedAt = DateTime.Parse(row.CreatedAt, null, System.Globalization.DateTimeStyles.RoundtripKind),
        UpdatedAt = DateTime.Parse(row.UpdatedAt, null, System.Globalization.DateTimeStyles.RoundtripKind),
    };

    private sealed class KaseRow
    {
        public string Id { get; set; } = string.Empty;
        public string Title { get; set; } = string.Empty;
        public string? Description { get; set; }
        public long LogCount { get; set; }
        public string CreatedAt { get; set; } = string.Empty;
        public string UpdatedAt { get; set; } = string.Empty;
    }
}
