using System.Data;
using Dapper;
using Microsoft.Data.Sqlite;

namespace KaseLog.Api.Data.Sqlite;

public sealed class SqliteConnectionFactory : IDbConnectionFactory
{
    private readonly string _connectionString;

    public SqliteConnectionFactory(string connectionString)
    {
        _connectionString = connectionString;
    }

    public async Task<IDbConnection> OpenAsync()
    {
        var connection = new SqliteConnection(_connectionString);
        await connection.OpenAsync();

        // Required on every connection — SQLite defaults both to off.
        // Run as separate commands to avoid any provider ambiguity with multi-statement strings.
        await connection.ExecuteAsync("PRAGMA journal_mode=WAL;");
        await connection.ExecuteAsync("PRAGMA foreign_keys=ON;");

        return connection;
    }
}
