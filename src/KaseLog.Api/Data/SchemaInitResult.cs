namespace KaseLog.Api.Data;

/// <summary>
/// Result returned by <see cref="ISchemaInitializer.InitializeAsync"/> after schema
/// DDL runs and all expected tables are verified.
/// </summary>
public sealed record SchemaInitResult(int TableCount, IReadOnlyList<string> MissingTables)
{
    /// <summary>True when all expected tables are present.</summary>
    public bool IsOk => MissingTables.Count == 0;
}
