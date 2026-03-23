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
            SELECT k.Id, k.Title, k.Description, k.IsPinned, k.CreatedAt, k.UpdatedAt,
                   COUNT(l.Id) AS LogCount,
                   llatest.Title        AS LatestLogTitle,
                   llatest.Description  AS LatestLogPreview,
                   llatest.UpdatedAt    AS LatestLogUpdatedAt
            FROM Kases k
            LEFT JOIN Logs l ON l.KaseId = k.Id
            LEFT JOIN (
                SELECT l2.KaseId, l2.Title, l2.Description, l2.UpdatedAt
                FROM Logs l2
                INNER JOIN (
                    SELECT KaseId, MAX(UpdatedAt) AS MaxUpdatedAt
                    FROM Logs
                    GROUP BY KaseId
                ) m ON l2.KaseId = m.KaseId AND l2.UpdatedAt = m.MaxUpdatedAt
            ) llatest ON llatest.KaseId = k.Id
            GROUP BY k.Id
            ORDER BY k.IsPinned DESC,
                     CASE WHEN llatest.UpdatedAt IS NULL THEN 0 ELSE 1 END DESC,
                     llatest.UpdatedAt DESC
            """);
        return rows.Select(Map);
    }

    public async Task<KaseResponse?> GetByIdAsync(Guid id)
    {
        using var conn = await _db.OpenAsync();
        var row = await conn.QuerySingleOrDefaultAsync<KaseRow>("""
            SELECT k.Id, k.Title, k.Description, k.IsPinned, k.CreatedAt, k.UpdatedAt,
                   COUNT(l.Id) AS LogCount,
                   llatest.Title        AS LatestLogTitle,
                   llatest.Description  AS LatestLogPreview,
                   llatest.UpdatedAt    AS LatestLogUpdatedAt
            FROM Kases k
            LEFT JOIN Logs l ON l.KaseId = k.Id
            LEFT JOIN (
                SELECT l2.KaseId, l2.Title, l2.Description, l2.UpdatedAt
                FROM Logs l2
                INNER JOIN (
                    SELECT KaseId, MAX(UpdatedAt) AS MaxUpdatedAt
                    FROM Logs
                    GROUP BY KaseId
                ) m ON l2.KaseId = m.KaseId AND l2.UpdatedAt = m.MaxUpdatedAt
            ) llatest ON llatest.KaseId = k.Id
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
            INSERT INTO Kases (Id, Title, Description, IsPinned, CreatedAt, UpdatedAt)
            VALUES (@Id, @Title, @Description, 0, @Now, @Now)
            """,
            new { Id = id.ToString(), Title = title, Description = description, Now = nowStr });

        return new KaseResponse
        {
            Id = id,
            Title = title,
            Description = description,
            LogCount = 0,
            IsPinned = false,
            CreatedAt = now,
            UpdatedAt = now,
        };
    }

    public async Task<KaseResponse?> UpdateAsync(Guid id, string title, string? description, bool? isPinned = null)
    {
        var nowStr = DateTime.UtcNow.ToString("O");

        using var conn = await _db.OpenAsync();

        int affected;
        if (isPinned.HasValue)
        {
            affected = await conn.ExecuteAsync("""
                UPDATE Kases SET Title = @Title, Description = @Description, IsPinned = @IsPinned, UpdatedAt = @Now
                WHERE Id = @Id
                """,
                new { Id = id.ToString(), Title = title, Description = description, IsPinned = isPinned.Value ? 1 : 0, Now = nowStr });
        }
        else
        {
            affected = await conn.ExecuteAsync("""
                UPDATE Kases SET Title = @Title, Description = @Description, UpdatedAt = @Now
                WHERE Id = @Id
                """,
                new { Id = id.ToString(), Title = title, Description = description, Now = nowStr });
        }

        if (affected == 0) return null;

        return await GetByIdAsync(id);
    }

    public async Task<KaseResponse?> SetPinnedAsync(Guid id, bool pinned)
    {
        using var conn = await _db.OpenAsync();
        var affected = await conn.ExecuteAsync(
            "UPDATE Kases SET IsPinned = @IsPinned WHERE Id = @Id",
            new { Id = id.ToString(), IsPinned = pinned ? 1 : 0 });
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
                l.UpdatedAt       AS UpdatedAt,
                l.Title           AS Title,
                l.Description     AS Description,
                (SELECT COUNT(*) FROM LogVersions WHERE LogId = l.Id) AS VersionCount,
                l.IsPinned        AS IsPinned,
                NULL              AS CollectionId,
                NULL              AS CollectionTitle,
                NULL              AS CollectionColor,
                NULL              AS KaseId,
                NULL              AS FieldValues
            FROM Logs l
            WHERE l.KaseId = @KaseId
            UNION ALL
            SELECT
                'collection_item' AS EntityType,
                ci.Id             AS Id,
                ci.CreatedAt      AS CreatedAt,
                ci.UpdatedAt      AS UpdatedAt,
                NULL              AS Title,
                NULL              AS Description,
                0                 AS VersionCount,
                0                 AS IsPinned,
                ci.CollectionId   AS CollectionId,
                c.Title           AS CollectionTitle,
                c.Color           AS CollectionColor,
                ci.KaseId         AS KaseId,
                ci.FieldValues    AS FieldValues
            FROM CollectionItems ci
            JOIN Collections c ON c.Id = ci.CollectionId
            WHERE ci.KaseId = @KaseId
            ORDER BY UpdatedAt DESC
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

        // Batch-fetch fields for collection items to derive itemTitle and summaryFields
        var collectionIds = rowList
            .Where(r => r.EntityType == "collection_item" && r.CollectionId is not null)
            .Select(r => r.CollectionId!)
            .Distinct()
            .ToList();

        // schemaMap: collectionId -> (titleFieldId, summaryFields with Id+Name)
        var schemaMap = new Dictionary<string, (string? TitleFieldId, List<FieldMeta> SummaryFields)>();

        if (collectionIds.Count > 0)
        {
            var fieldRows = await conn.QueryAsync<FieldMetaRow>("""
                SELECT Id, CollectionId, Name, Type, ShowInList, SortOrder
                FROM CollectionFields
                WHERE CollectionId IN @Ids
                ORDER BY CollectionId, SortOrder
                """, new { Ids = collectionIds });

            foreach (var group in fieldRows.GroupBy(f => f.CollectionId))
            {
                var ordered = group.OrderBy(f => f.SortOrder).ToList();

                // First text or select field is the title field
                var titleField = ordered.FirstOrDefault(f => f.Type is "text" or "select");

                // Summary fields: showInList=true, exclude the title field, up to 4
                var summaryFields = ordered
                    .Where(f => f.ShowInList != 0 && f.Id != titleField?.Id)
                    .Take(4)
                    .Select(f => new FieldMeta(f.Id, f.Name))
                    .ToList();

                schemaMap[group.Key] = (titleField?.Id, summaryFields);
            }
        }

        return rowList.Select<TimelineRow, TimelineEntryResponse>(r =>
        {
            var createdAt = DateTime.Parse(r.CreatedAt, null, System.Globalization.DateTimeStyles.RoundtripKind);
            var updatedAt = DateTime.Parse(r.UpdatedAt, null, System.Globalization.DateTimeStyles.RoundtripKind);

            if (r.EntityType == "log")
            {
                return new TimelineEntryResponse
                {
                    EntityType   = "log",
                    Id           = Guid.Parse(r.Id),
                    CreatedAt    = createdAt,
                    UpdatedAt    = updatedAt,
                    Title        = r.Title,
                    Description  = r.Description,
                    VersionCount = (int)r.VersionCount,
                    IsPinned     = r.IsPinned != 0,
                    Tags         = tagMap.TryGetValue(r.Id, out var t) ? t : [],
                };
            }

            // ── Collection item ────────────────────────────────────────────────

            string? itemTitle = null;
            var summaryFields = new List<TimelineSummaryField>();

            if (r.FieldValues is not null)
            {
                try
                {
                    var fieldValuesDoc = JsonDocument.Parse(r.FieldValues);
                    var fv = fieldValuesDoc.RootElement;

                    if (r.CollectionId is not null &&
                        schemaMap.TryGetValue(r.CollectionId, out var schema))
                    {
                        // Resolve item title from first text/select field
                        if (schema.TitleFieldId is not null &&
                            fv.TryGetProperty(schema.TitleFieldId, out var titleEl) &&
                            titleEl.ValueKind == JsonValueKind.String)
                        {
                            itemTitle = titleEl.GetString();
                        }

                        // Resolve summary fields
                        foreach (var sf in schema.SummaryFields)
                        {
                            if (fv.TryGetProperty(sf.Id, out var valEl))
                            {
                                var val = valEl.ValueKind == JsonValueKind.String
                                    ? valEl.GetString()
                                    : valEl.ToString();
                                if (!string.IsNullOrWhiteSpace(val))
                                    summaryFields.Add(new TimelineSummaryField { Name = sf.Name, Value = val! });
                            }
                        }
                    }
                }
                catch { /* malformed JSON — fall through to fallback */ }
            }

            // Fallback to collection title when no title field found
            itemTitle ??= r.CollectionTitle;

            return new TimelineEntryResponse
            {
                EntityType      = "collection_item",
                Id              = Guid.Parse(r.Id),
                CreatedAt       = createdAt,
                UpdatedAt       = updatedAt,
                CollectionId    = r.CollectionId is null ? null : Guid.Parse(r.CollectionId),
                CollectionTitle = r.CollectionTitle,
                CollectionColor = r.CollectionColor,
                KaseId          = r.KaseId is null ? null : Guid.Parse(r.KaseId),
                ItemTitle       = itemTitle,
                SummaryFields   = summaryFields,
            };
        });
    }

    private sealed class TimelineRow
    {
        public string  EntityType     { get; set; } = string.Empty;
        public string  Id             { get; set; } = string.Empty;
        public string  CreatedAt      { get; set; } = string.Empty;
        public string  UpdatedAt      { get; set; } = string.Empty;
        public string? Title          { get; set; }
        public string? Description    { get; set; }
        public long    VersionCount   { get; set; }
        public int     IsPinned       { get; set; }
        public string? CollectionId   { get; set; }
        public string? CollectionTitle { get; set; }
        public string? CollectionColor { get; set; }
        public string? KaseId         { get; set; }
        public string? FieldValues    { get; set; }
    }

    private sealed class FieldMetaRow
    {
        public string Id           { get; set; } = string.Empty;
        public string CollectionId { get; set; } = string.Empty;
        public string Name         { get; set; } = string.Empty;
        public string Type         { get; set; } = string.Empty;
        public int    ShowInList   { get; set; }
        public int    SortOrder    { get; set; }
    }

    private sealed record FieldMeta(string Id, string Name);

    private static KaseResponse Map(KaseRow row) => new()
    {
        Id          = Guid.Parse(row.Id),
        Title       = row.Title,
        Description = row.Description,
        LogCount    = (int)row.LogCount,
        IsPinned    = row.IsPinned != 0,
        LatestLogTitle   = row.LatestLogTitle,
        LatestLogPreview = row.LatestLogPreview,
        LatestLogUpdatedAt = row.LatestLogUpdatedAt is null
            ? null
            : DateTime.Parse(row.LatestLogUpdatedAt, null, System.Globalization.DateTimeStyles.RoundtripKind),
        CreatedAt   = DateTime.Parse(row.CreatedAt, null, System.Globalization.DateTimeStyles.RoundtripKind),
        UpdatedAt   = DateTime.Parse(row.UpdatedAt, null, System.Globalization.DateTimeStyles.RoundtripKind),
    };

    private sealed class KaseRow
    {
        public string  Id                 { get; set; } = string.Empty;
        public string  Title              { get; set; } = string.Empty;
        public string? Description        { get; set; }
        public long    LogCount           { get; set; }
        public int     IsPinned           { get; set; }
        public string? LatestLogTitle     { get; set; }
        public string? LatestLogPreview   { get; set; }
        public string? LatestLogUpdatedAt { get; set; }
        public string  CreatedAt          { get; set; } = string.Empty;
        public string  UpdatedAt          { get; set; } = string.Empty;
    }
}
