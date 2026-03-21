namespace KaseLog.Api.Data;

/// <summary>
/// Initializes the database schema on first run.
/// Implementations must be idempotent — safe to call on every startup.
/// </summary>
public interface ISchemaInitializer
{
    /// <summary>
    /// Runs all DDL statements idempotently, then verifies that every expected
    /// table is present. Returns a <see cref="SchemaInitResult"/> with the
    /// verified table count and a list of any missing tables.
    /// </summary>
    Task<SchemaInitResult> InitializeAsync();
}
