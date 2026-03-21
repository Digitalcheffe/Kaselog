namespace KaseLog.Api.Data;

/// <summary>
/// Initializes the database schema on first run.
/// Implementations must be idempotent — safe to call on every startup.
/// </summary>
public interface ISchemaInitializer
{
    /// <summary>
    /// Runs all DDL statements idempotently.
    /// Returns <c>true</c> when this is a fresh (empty) database, <c>false</c> when
    /// the schema already existed.
    /// </summary>
    Task<bool> InitializeAsync();
}
