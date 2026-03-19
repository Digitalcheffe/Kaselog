using System.Data;

namespace KaseLog.Api.Data;

/// <summary>
/// Creates and returns open database connections.
/// Callers are responsible for disposing each connection.
/// </summary>
public interface IDbConnectionFactory
{
    Task<IDbConnection> OpenAsync();
}
