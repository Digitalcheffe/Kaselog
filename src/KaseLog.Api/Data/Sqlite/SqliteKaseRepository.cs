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
