namespace KaseLog.Api.Data;

/// <summary>
/// Inserts first-run documentation data when the database is empty.
/// Safe to call on every startup — skips silently when data already exists.
/// </summary>
public interface ISeedInitializer
{
    /// <summary>
    /// Checks whether the database is empty (zero Kases) and, if so, inserts
    /// the welcome Kase with documentation Logs in a single transaction.
    /// Returns a <see cref="SeedStatus"/> indicating what happened.
    /// </summary>
    Task<SeedStatus> SeedAsync();
}
