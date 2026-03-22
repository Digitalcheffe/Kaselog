using Dapper;
using KaseLog.Api.Models;
using KaseLog.Api.Models.Requests;

namespace KaseLog.Api.Data.Sqlite;

public sealed class SqliteUserRepository : IUserRepository
{
    // Single well-known ID for the local user profile.
    private const string LocalUserId = "00000000-0000-0000-0000-000000000001";

    private readonly IDbConnectionFactory _factory;

    public SqliteUserRepository(IDbConnectionFactory factory)
    {
        _factory = factory;
    }

    public async Task<UserResponse> GetAsync()
    {
        using var connection = await _factory.OpenAsync();

        var row = await connection.QuerySingleOrDefaultAsync<UserRow>(
            "SELECT Id, FirstName, LastName, Email, Theme, Accent, FontSize, CreatedAt, UpdatedAt FROM Users WHERE Id = @Id",
            new { Id = LocalUserId });

        if (row is null)
        {
            // Return defaults — the row is created on first PUT.
            var now = DateTime.UtcNow.ToString("o");
            return new UserResponse
            {
                Id        = LocalUserId,
                FirstName = null,
                LastName  = null,
                Email     = null,
                Theme     = "light",
                Accent    = "teal",
                FontSize  = "medium",
                CreatedAt = now,
                UpdatedAt = now,
            };
        }

        return Map(row);
    }

    public async Task<UserResponse> UpsertAsync(UpdateUserRequest request)
    {
        using var connection = await _factory.OpenAsync();

        var now = DateTime.UtcNow.ToString("o");

        await connection.ExecuteAsync(
            """
            INSERT INTO Users (Id, FirstName, LastName, Email, Theme, Accent, FontSize, CreatedAt, UpdatedAt)
            VALUES (@Id, @FirstName, @LastName, @Email, @Theme, @Accent, COALESCE(@FontSize, 'medium'), @Now, @Now)
            ON CONFLICT(Id) DO UPDATE SET
              FirstName = excluded.FirstName,
              LastName  = excluded.LastName,
              Email     = excluded.Email,
              Theme     = excluded.Theme,
              Accent    = excluded.Accent,
              FontSize  = COALESCE(excluded.FontSize, FontSize),
              UpdatedAt = excluded.UpdatedAt
            """,
            new
            {
                Id        = LocalUserId,
                request.FirstName,
                request.LastName,
                request.Email,
                request.Theme,
                request.Accent,
                FontSize  = request.FontSize,
                Now       = now,
            });

        var row = await connection.QuerySingleAsync<UserRow>(
            "SELECT Id, FirstName, LastName, Email, Theme, Accent, FontSize, CreatedAt, UpdatedAt FROM Users WHERE Id = @Id",
            new { Id = LocalUserId });

        return Map(row);
    }

    private static UserResponse Map(UserRow row) => new()
    {
        Id        = row.Id,
        FirstName = row.FirstName,
        LastName  = row.LastName,
        Email     = row.Email,
        Theme     = row.Theme,
        Accent    = row.Accent,
        FontSize  = row.FontSize,
        CreatedAt = row.CreatedAt,
        UpdatedAt = row.UpdatedAt,
    };

    private sealed class UserRow
    {
        public required string Id { get; init; }
        public string? FirstName { get; init; }
        public string? LastName { get; init; }
        public string? Email { get; init; }
        public required string Theme { get; init; }
        public required string Accent { get; init; }
        public required string FontSize { get; init; }
        public required string CreatedAt { get; init; }
        public required string UpdatedAt { get; init; }
    }
}
