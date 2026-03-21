namespace KaseLog.Api.Data;

/// <summary>Result of a <see cref="ISeedInitializer.SeedAsync"/> call.</summary>
public enum SeedStatus
{
    /// <summary>First-run seed data was inserted successfully.</summary>
    Inserted,

    /// <summary>Database already contained rows — seed was skipped.</summary>
    Skipped,

    /// <summary>Seed transaction failed and was rolled back.</summary>
    Error,
}
