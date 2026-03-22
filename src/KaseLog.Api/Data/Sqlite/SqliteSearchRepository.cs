using System.Text;
using System.Text.RegularExpressions;
using Dapper;
using KaseLog.Api.Models;

namespace KaseLog.Api.Data.Sqlite;

public sealed partial class SqliteSearchRepository : ISearchRepository
{
    private readonly IDbConnectionFactory _factory;

    public SqliteSearchRepository(IDbConnectionFactory factory)
    {
        _factory = factory;
    }

    public async Task<IEnumerable<SearchResultDto>> SearchAsync(
        string? q,
        string? kaseId,
        string? collectionId,
        string? type,
        IReadOnlyList<string> tags,
        DateTime? from,
        DateTime? to)
    {
        var hasQ = !string.IsNullOrWhiteSpace(q);
        var hasFilters = !string.IsNullOrWhiteSpace(kaseId)
            || !string.IsNullOrWhiteSpace(collectionId)
            || !string.IsNullOrWhiteSpace(type)
            || tags.Count > 0
            || from.HasValue
            || to.HasValue;

        if (!hasQ && !hasFilters)
            return [];

        using var connection = await _factory.OpenAsync();

        List<SearchResultRow> rows = hasQ
            ? await RunFtsQuery(connection, q!, kaseId, collectionId, type, tags, from, to)
            : await RunFilterQuery(connection, kaseId, collectionId, type, tags, from, to);

        if (rows.Count == 0)
            return [];

        // Fetch tags only for log entities
        var logIds = rows.Where(r => r.EntityType == "log").Select(r => r.LogId).Distinct().ToList();
        var tagMap = logIds.Count > 0
            ? await FetchTagsForLogs(connection, logIds)
            : new Dictionary<string, List<string>>();

        return rows.Select(r => new SearchResultDto
        {
            LogId = r.LogId,
            KaseId = r.KaseId,
            KaseTitle = r.KaseTitle,
            EntityType = r.EntityType,
            CollectionId = string.IsNullOrEmpty(r.CollectionId) ? null : r.CollectionId,
            CollectionTitle = string.IsNullOrEmpty(r.CollectionTitle) ? null : r.CollectionTitle,
            CollectionColor = string.IsNullOrEmpty(r.CollectionColor) ? null : r.CollectionColor,
            Title = r.Title,
            Highlight = BuildHighlight(r.Content, hasQ ? q : null),
            Tags = r.EntityType == "log" && tagMap.TryGetValue(r.LogId, out var t) ? t : [],
            UpdatedAt = r.UpdatedAt,
        });
    }

    // ── FTS5 path ─────────────────────────────────────────────────────────────

    private static async Task<List<SearchResultRow>> RunFtsQuery(
        System.Data.IDbConnection connection,
        string q,
        string? kaseId,
        string? collectionId,
        string? type,
        IReadOnlyList<string> tags,
        DateTime? from,
        DateTime? to)
    {
        var ftsQuery = BuildFtsQuery(q);
        var sql = new StringBuilder("""
            SELECT
                ks.entity_id                   AS LogId,
                COALESCE(ks.kase_id, '')        AS KaseId,
                COALESCE(ks.kase_title, '')     AS KaseTitle,
                ks.entity_type                  AS EntityType,
                COALESCE(ks.collection_id, '')  AS CollectionId,
                COALESCE(ks.collection_title, '') AS CollectionTitle,
                COALESCE(col.Color, '')         AS CollectionColor,
                ks.title                        AS Title,
                ks.content                      AS Content,
                CASE
                    WHEN ks.entity_type = 'log' THEN l.UpdatedAt
                    ELSE ci.UpdatedAt
                END AS UpdatedAt
            FROM kaselog_search ks
            LEFT JOIN Logs l ON l.Id = ks.entity_id AND ks.entity_type = 'log'
            LEFT JOIN CollectionItems ci ON ci.Id = ks.entity_id AND ks.entity_type = 'collection_item'
            LEFT JOIN Collections col ON col.Id = ks.collection_id AND ks.entity_type = 'collection_item'
            WHERE ks MATCH @ftsQuery
            """);

        var p = new DynamicParameters();
        p.Add("ftsQuery", ftsQuery);

        if (!string.IsNullOrWhiteSpace(type))
        {
            sql.AppendLine(" AND ks.entity_type = @type");
            p.Add("type", type);
        }

        if (!string.IsNullOrWhiteSpace(kaseId))
        {
            sql.AppendLine(" AND ks.kase_id = @kaseId");
            p.Add("kaseId", kaseId);
        }

        if (!string.IsNullOrWhiteSpace(collectionId))
        {
            sql.AppendLine(" AND ks.collection_id = @collectionId");
            p.Add("collectionId", collectionId);
        }

        AppendFtsDateAndTagFilters(sql, p, tags, from, to);

        sql.AppendLine(" ORDER BY rank LIMIT 100");

        try
        {
            var result = await connection.QueryAsync<SearchResultRow>(sql.ToString(), p);
            return result.ToList();
        }
        catch
        {
            return [];
        }
    }

    // ── Filter-only path (no full-text query) ─────────────────────────────────

    private static async Task<List<SearchResultRow>> RunFilterQuery(
        System.Data.IDbConnection connection,
        string? kaseId,
        string? collectionId,
        string? type,
        IReadOnlyList<string> tags,
        DateTime? from,
        DateTime? to)
    {
        var includeLog = string.IsNullOrEmpty(type) || type == "log";
        var includeItem = string.IsNullOrEmpty(type) || type == "collection_item"
            || !string.IsNullOrEmpty(collectionId);

        // Tag filters are log-only; suppress items when tags are set and no explicit type
        if (tags.Count > 0 && string.IsNullOrEmpty(type))
            includeItem = false;

        if (!includeLog && !includeItem)
            return [];

        var p = new DynamicParameters();
        var addedParams = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        void TryAdd(string name, object value)
        {
            if (addedParams.Add(name))
                p.Add(name, value);
        }

        var parts = new List<string>();

        if (includeLog)
        {
            var logSql = new StringBuilder("""
                SELECT
                    l.Id       AS LogId,
                    l.KaseId   AS KaseId,
                    k.Title    AS KaseTitle,
                    'log'      AS EntityType,
                    ''         AS CollectionId,
                    ''         AS CollectionTitle,
                    ''         AS CollectionColor,
                    l.Title    AS Title,
                    COALESCE(lv.Content, '') AS Content,
                    l.UpdatedAt
                FROM Logs l
                JOIN Kases k ON k.Id = l.KaseId
                LEFT JOIN (
                    SELECT LogId, Content
                    FROM LogVersions
                    WHERE (LogId, CreatedAt) IN (
                        SELECT LogId, MAX(CreatedAt) FROM LogVersions GROUP BY LogId
                    )
                ) lv ON lv.LogId = l.Id
                WHERE 1=1
                """);

            if (!string.IsNullOrWhiteSpace(kaseId))
            {
                logSql.AppendLine(" AND l.KaseId = @kaseId");
                TryAdd("kaseId", kaseId);
            }

            if (from.HasValue)
            {
                logSql.AppendLine(" AND l.UpdatedAt >= @from");
                TryAdd("from", from.Value.ToString("O"));
            }

            if (to.HasValue)
            {
                logSql.AppendLine(" AND l.UpdatedAt <= @to");
                TryAdd("to", to.Value.ToString("O"));
            }

            for (var i = 0; i < tags.Count; i++)
            {
                var paramName = $"tag{i}";
                logSql.AppendLine($"""
                     AND EXISTS (
                        SELECT 1 FROM LogTags lt
                        JOIN Tags t ON t.Id = lt.TagId
                        WHERE lt.LogId = l.Id AND LOWER(t.Name) = LOWER(@{paramName})
                    )
                    """);
                TryAdd(paramName, tags[i]);
            }

            parts.Add(logSql.ToString());
        }

        if (includeItem)
        {
            var itemSql = new StringBuilder("""
                SELECT
                    ci.Id                   AS LogId,
                    COALESCE(ci.KaseId, '') AS KaseId,
                    COALESCE(k.Title, '')   AS KaseTitle,
                    'collection_item'       AS EntityType,
                    ci.CollectionId         AS CollectionId,
                    c.Title                 AS CollectionTitle,
                    c.Color                 AS CollectionColor,
                    COALESCE(
                        (
                            SELECT json_extract(ci.FieldValues, '$.' || cf.Id)
                            FROM CollectionFields cf
                            WHERE cf.CollectionId = ci.CollectionId
                              AND cf.Type IN ('text', 'select')
                            ORDER BY cf.SortOrder
                            LIMIT 1
                        ),
                        ''
                    )                       AS Title,
                    ''                      AS Content,
                    ci.UpdatedAt
                FROM CollectionItems ci
                JOIN Collections c ON c.Id = ci.CollectionId
                LEFT JOIN Kases k ON k.Id = ci.KaseId
                WHERE 1=1
                """);

            if (!string.IsNullOrWhiteSpace(kaseId))
            {
                itemSql.AppendLine(" AND ci.KaseId = @kaseId");
                TryAdd("kaseId", kaseId);
            }

            if (!string.IsNullOrWhiteSpace(collectionId))
            {
                itemSql.AppendLine(" AND ci.CollectionId = @collectionId");
                TryAdd("collectionId", collectionId);
            }

            if (from.HasValue)
            {
                itemSql.AppendLine(" AND ci.UpdatedAt >= @from");
                TryAdd("from", from.Value.ToString("O"));
            }

            if (to.HasValue)
            {
                itemSql.AppendLine(" AND ci.UpdatedAt <= @to");
                TryAdd("to", to.Value.ToString("O"));
            }

            parts.Add(itemSql.ToString());
        }

        string finalSql;
        if (parts.Count == 1)
            finalSql = parts[0] + " ORDER BY UpdatedAt DESC LIMIT 100";
        else
            finalSql = $"SELECT * FROM (\n{string.Join("\nUNION ALL\n", parts)}\n) ORDER BY UpdatedAt DESC LIMIT 100";

        var result = await connection.QueryAsync<SearchResultRow>(finalSql, p);
        return result.ToList();
    }

    // ── FTS date/tag filters (handles both entity types) ─────────────────────

    private static void AppendFtsDateAndTagFilters(
        StringBuilder sql,
        DynamicParameters p,
        IReadOnlyList<string> tags,
        DateTime? from,
        DateTime? to)
    {
        if (from.HasValue)
        {
            sql.AppendLine("""
                 AND (
                    (ks.entity_type = 'log' AND l.UpdatedAt >= @from) OR
                    (ks.entity_type = 'collection_item' AND ci.UpdatedAt >= @from)
                 )
                """);
            p.Add("from", from.Value.ToString("O"));
        }

        if (to.HasValue)
        {
            sql.AppendLine("""
                 AND (
                    (ks.entity_type = 'log' AND l.UpdatedAt <= @to) OR
                    (ks.entity_type = 'collection_item' AND ci.UpdatedAt <= @to)
                 )
                """);
            p.Add("to", to.Value.ToString("O"));
        }

        for (var i = 0; i < tags.Count; i++)
        {
            var paramName = $"tag{i}";
            // Tag filters apply to logs; collection items pass through automatically
            sql.AppendLine($"""
                 AND (
                    ks.entity_type = 'collection_item' OR
                    EXISTS (
                        SELECT 1 FROM LogTags lt
                        JOIN Tags t ON t.Id = lt.TagId
                        WHERE lt.LogId = ks.entity_id AND LOWER(t.Name) = LOWER(@{paramName})
                    )
                 )
                """);
            p.Add(paramName, tags[i]);
        }
    }

    // ── Tag lookup ────────────────────────────────────────────────────────────

    private static async Task<Dictionary<string, List<string>>> FetchTagsForLogs(
        System.Data.IDbConnection connection,
        IReadOnlyList<string> logIds)
    {
        const string sql = """
            SELECT lt.LogId, t.Name
            FROM LogTags lt
            JOIN Tags t ON t.Id = lt.TagId
            WHERE lt.LogId IN @logIds
            ORDER BY t.Name
            """;

        var rows = await connection.QueryAsync<(string LogId, string Name)>(sql, new { logIds });

        var map = new Dictionary<string, List<string>>(StringComparer.OrdinalIgnoreCase);
        foreach (var (logId, name) in rows)
        {
            if (!map.TryGetValue(logId, out var list))
            {
                list = [];
                map[logId] = list;
            }
            list.Add(name);
        }
        return map;
    }

    // ── FTS5 query builder ────────────────────────────────────────────────────

    /// <summary>
    /// Wraps each token in double-quotes for FTS5 so special characters are
    /// treated literally. Multiple tokens use AND semantics (FTS5 default).
    /// </summary>
    private static string BuildFtsQuery(string q)
    {
        var tokens = q.Trim().Split(' ', StringSplitOptions.RemoveEmptyEntries);
        return string.Join(' ', tokens.Select(t => $"\"{t.Replace("\"", "\"\"")}\""));
    }

    // ── Excerpt builder ───────────────────────────────────────────────────────

    /// <summary>
    /// Strips HTML tags from content and returns a plain-text excerpt
    /// centred around the first occurrence of any search term.
    /// </summary>
    private static string BuildHighlight(string? content, string? q)
    {
        if (string.IsNullOrEmpty(content))
            return string.Empty;

        var plain = HtmlTagRegex().Replace(content, " ");
        plain = WhitespaceRegex().Replace(plain, " ").Trim();

        if (string.IsNullOrEmpty(plain))
            return string.Empty;

        const int excerptLength = 250;

        if (string.IsNullOrWhiteSpace(q))
            return plain.Length > excerptLength ? plain[..excerptLength] + "…" : plain;

        var terms = q.Trim().Split(' ', StringSplitOptions.RemoveEmptyEntries);
        var firstIndex = -1;
        foreach (var term in terms)
        {
            var idx = plain.IndexOf(term, StringComparison.OrdinalIgnoreCase);
            if (idx >= 0 && (firstIndex < 0 || idx < firstIndex))
                firstIndex = idx;
        }

        if (firstIndex < 0)
            return plain.Length > excerptLength ? plain[..excerptLength] + "…" : plain;

        var start = Math.Max(0, firstIndex - excerptLength / 3);
        var end = Math.Min(plain.Length, start + excerptLength);
        start = Math.Max(0, end - excerptLength);

        var excerpt = plain[start..end];
        if (start > 0) excerpt = "…" + excerpt;
        if (end < plain.Length) excerpt += "…";

        return excerpt;
    }

    [GeneratedRegex(@"<[^>]+>")]
    private static partial Regex HtmlTagRegex();

    [GeneratedRegex(@"\s+")]
    private static partial Regex WhitespaceRegex();

    private sealed class SearchResultRow
    {
        public string LogId { get; init; } = string.Empty;
        public string KaseId { get; init; } = string.Empty;
        public string KaseTitle { get; init; } = string.Empty;
        public string EntityType { get; init; } = "log";
        public string CollectionId { get; init; } = string.Empty;
        public string CollectionTitle { get; init; } = string.Empty;
        public string CollectionColor { get; init; } = string.Empty;
        public string Title { get; init; } = string.Empty;
        public string Content { get; init; } = string.Empty;
        public string UpdatedAt { get; init; } = string.Empty;
    }
}
