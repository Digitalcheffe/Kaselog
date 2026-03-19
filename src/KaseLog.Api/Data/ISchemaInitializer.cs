namespace KaseLog.Api.Data;

/// <summary>
/// Initializes the database schema on first run.
/// Implementations must be idempotent — safe to call on every startup.
/// </summary>
public interface ISchemaInitializer
{
    Task InitializeAsync();
}
