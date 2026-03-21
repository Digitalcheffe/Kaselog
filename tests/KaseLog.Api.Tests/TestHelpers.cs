using KaseLog.Api.Data;

namespace KaseLog.Api.Tests;

/// <summary>No-op seed initializer for controller integration tests that need a clean database.</summary>
internal sealed class NoopSeedInitializer : ISeedInitializer
{
    public Task<SeedStatus> SeedAsync() => Task.FromResult(SeedStatus.Skipped);
}
