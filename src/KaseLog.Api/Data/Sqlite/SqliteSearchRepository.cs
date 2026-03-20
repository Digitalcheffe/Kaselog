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
        IReadOnlyList<string> tags,
        DateTime? from,
        DateTime? to)
    {
        var hasQ = !string.IsNullOrWhiteSpace(q);
        var hasFilters = !string.IsNullOrWhiteSpace(kaseId) || tags.Count > 0 || from.HasValue || to.HasValue;

        if (!hasQ && !hasFilters)
            return [];

        using var connection = await _factory.OpenAsync();

        List<SearchResultRow> rows = hasQ
            ? await RunFtsQuery(connection, q!, kaseId, tags, from, to)
            : await RunFilterQuery(connection, kaseId, tags, from, to);

        if (rows.Count == 0)
            return [];

        var logIds = rows.Select(r => r.LogId).Distinct().ToList();
        var tagMap = await FetchTagsForLogs(connection, logIds);

        return rows.Select(r => new SearchResultDto
        {
            LogId = r.LogId,
            KaseId = r.KaseId,
            KaseTitle = r.KaseTitle,
            EntityType = r.EntityType,
            Title = r.Title,
            Highlight = BuildHighlight(r.Content, hasQ ? q : null),
            Tags = tagMap.TryGetValue(r.LogId, out var t) ? t : [],
            UpdatedAt = r.UpdatedAt,
        });
    }

    // ── FTS5 path ─────────────────────────────────────────────────────────────

    private static async Task<List<SearchResultRow>> RunFtsQuery(
        System.Data.IDbConnection connection,
        string q,
        string? kaseId,
        IReadOnlyList<string> tags,
        DateTime? from,
        DateTime? to)
    {
        var ftsQuery = BuildFtsQuery(q);
        var sql = new StringBuilder("""
            SELECT
                kaselog_search.entity_id   AS LogId,
                kaselog_search.kase_id     AS KaseId,
                kaselog_search.kase_title  AS KaseTitle,
                kaselog_search.entity_type AS EntityType,
                kaselog_search.title       AS Title,
                kaselog_search.content     AS Content,
                l.UpdatedAt
            FROM kaselog_search
            JOIN Logs l ON l.Id = kaselog_search.entity_id
            WHERE kaselog_search MATCH @ftsQuery
              AND kaselog_search.entity_type = 'log'
            """);

        var p = new DynamicParameters();
        p.Add("ftsQuery", ftsQuery);

        if (!string.IsNullOrWhiteSpace(kaseId))
        {
            sql.AppendLine(" AND kaselog_search.kase_id = @kaseId");
            p.Add("kaseId", kaseId);
        }

        AppendDateAndTagFilters(sql, p, tags, from, to, "kaselog_search.entity_id");

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
        IReadOnlyList<string> tags,
        DateTime? from,
        DateTime? to)
    {
        var sql = new StringBuilder("""
            SELECT
                l.Id       AS LogId,
                l.KaseId   AS KaseId,
                k.Title    AS KaseTitle,
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

        var p = new DynamicParameters();

        if (!string.IsNullOrWhiteSpace(kaseId))
        {
            sql.AppendLine(" AND l.KaseId = @kaseId");
            p.Add("kaseId", kaseId);
        }

        AppendDateAndTagFilters(sql, p, tags, from, to, "l.Id");

        sql.AppendLine(" ORDER BY l.UpdatedAt DESC LIMIT 100");

        var result = await connection.QueryAsync<SearchResultRow>(sql.ToString(), p);
        return result.ToList();
    }

    // ── Shared filter helpers ─────────────────────────────────────────────────

    private static void AppendDateAndTagFilters(
        StringBuilder sql,
        DynamicParameters p,
        IReadOnlyList<string> tags,
        DateTime? from,
        DateTime? to,
        string logIdColumn)
    {
        if (from.HasValue)
        {
            sql.AppendLine(" AND l.UpdatedAt >= @from");
            p.Add("from", from.Value.ToString("O"));
        }

        if (to.HasValue)
        {
            sql.AppendLine(" AND l.UpdatedAt <= @to");
            p.Add("to", to.Value.ToString("O"));
        }

        for (var i = 0; i < tags.Count; i++)
        {
            var paramName = $"tag{i}";
            sql.AppendLine($"""
                 AND EXISTS (
                    SELECT 1 FROM LogTags lt
                    JOIN Tags t ON t.Id = lt.TagId
                    WHERE lt.LogId = {logIdColumn} AND LOWER(t.Name) = LOWER(@{paramName})
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
        public string Title { get; init; } = string.Empty;
        public string Content { get; init; } = string.Empty;
        public string UpdatedAt { get; init; } = string.Empty;
    }
}
