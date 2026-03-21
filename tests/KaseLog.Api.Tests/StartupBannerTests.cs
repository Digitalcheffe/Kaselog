using KaseLog.Api;
using KaseLog.Api.Data;
using KaseLog.Api.Data.Sqlite;
using Microsoft.Data.Sqlite;
using Xunit;

namespace KaseLog.Api.Tests;

/// <summary>
/// Unit tests for <see cref="StartupBanner"/> and <see cref="SqliteSchemaInitializer"/>
/// schema verification logic.
/// </summary>
public sealed class StartupBannerTests : IAsyncDisposable
{
    // ── Shared schema fixture ─────────────────────────────────────────────────

    private readonly SqliteConnection _keepAlive;
    private readonly SqliteConnectionFactory _factory;

    public StartupBannerTests()
    {
        var name = $"banner_test_{Guid.NewGuid():N}";
        var cs   = $"Data Source={name};Mode=Memory;Cache=Shared";
        _keepAlive = new SqliteConnection(cs);
        _keepAlive.Open();
        _factory = new SqliteConnectionFactory(cs);
    }

    public async ValueTask DisposeAsync() => await _keepAlive.DisposeAsync();

    // ── Helpers ───────────────────────────────────────────────────────────────

    private static StartupContext HealthyContext(
        SchemaInitResult? schema = null,
        SeedStatus seed = SeedStatus.Skipped) =>
        new(
            Version:      "1.0.0",
            Port:         "5000",
            DatabasePath: "/data/kaselog.db",
            DbProvider:   "sqlite",
            Schema:       schema ?? new SchemaInitResult(10, []),
            ImagesDir:    "/data/images",
            ImagesStatus: "12 files",
            ImagesFailed: false,
            Seed:         seed,
            StartedAt:    new DateTime(2026, 3, 21, 2, 27, 5, DateTimeKind.Utc)
        );

    // ── Banner content tests ───────────────────────────────────────────────────

    [Fact]
    public void Build_HealthyContext_ContainsReady()
    {
        var banner = StartupBanner.Build(HealthyContext());
        Assert.Contains("ready", banner);
        Assert.DoesNotContain("STARTUP FAILED", banner);
    }

    [Fact]
    public void Build_MissingTables_ContainsStartupFailed()
    {
        var schema = new SchemaInitResult(8, ["LogVersions", "Tags"]);
        var banner = StartupBanner.Build(HealthyContext(schema));
        Assert.Contains("STARTUP FAILED", banner);
    }

    [Fact]
    public void Build_MissingTables_ListsMissingTableNames()
    {
        var schema = new SchemaInitResult(8, ["LogVersions", "Tags"]);
        var banner = StartupBanner.Build(HealthyContext(schema));
        Assert.Contains("MISSING: LogVersions, Tags", banner);
    }

    [Fact]
    public void Build_ImagesFailed_ContainsStartupFailed()
    {
        var ctx = HealthyContext() with { ImagesFailed = true, ImagesStatus = "ERROR — not writable" };
        var banner = StartupBanner.Build(ctx);
        Assert.Contains("STARTUP FAILED", banner);
    }

    [Fact]
    public void Build_HealthyContext_ContainsTableCount()
    {
        var banner = StartupBanner.Build(HealthyContext());
        Assert.Contains("10 tables verified", banner);
    }

    [Fact]
    public void Build_HealthyContext_ContainsPortAndDatabase()
    {
        var banner = StartupBanner.Build(HealthyContext());
        Assert.Contains("5000", banner);
        Assert.Contains("/data/kaselog.db", banner);
        Assert.Contains("[sqlite]", banner);
    }

    [Fact]
    public void Build_HealthyContext_ContainsImagesStatus()
    {
        var banner = StartupBanner.Build(HealthyContext());
        Assert.Contains("/data/images", banner);
        Assert.Contains("12 files", banner);
    }

    [Fact]
    public void Build_HealthyContext_ContainsStartedTimestamp()
    {
        var banner = StartupBanner.Build(HealthyContext());
        Assert.Contains("2026-03-21 02:27:05 UTC", banner);
    }

    [Fact]
    public void Build_SeedInserted_ShowsFirstRun()
    {
        var banner = StartupBanner.Build(HealthyContext(seed: SeedStatus.Inserted));
        Assert.Contains("inserted — first run", banner);
    }

    [Fact]
    public void Build_SeedSkipped_ShowsSkipped()
    {
        var banner = StartupBanner.Build(HealthyContext(seed: SeedStatus.Skipped));
        Assert.Contains("skipped — data exists", banner);
    }

    [Fact]
    public void Build_SeedError_ShowsError()
    {
        var banner = StartupBanner.Build(HealthyContext(seed: SeedStatus.Error));
        Assert.Contains("ERROR — see logs above", banner);
    }

    // ── SchemaInitResult tests ─────────────────────────────────────────────────

    [Fact]
    public void SchemaInitResult_IsOk_WhenNoMissingTables()
    {
        var result = new SchemaInitResult(10, []);
        Assert.True(result.IsOk);
    }

    [Fact]
    public void SchemaInitResult_IsNotOk_WhenTablesMissing()
    {
        var result = new SchemaInitResult(8, ["LogVersions", "Tags"]);
        Assert.False(result.IsOk);
    }

    // ── SqliteSchemaInitializer integration tests ──────────────────────────────

    [Fact]
    public async Task SchemaInit_FreshDatabase_IsOk()
    {
        var init   = new SqliteSchemaInitializer(_factory);
        var result = await init.InitializeAsync();
        Assert.True(result.IsOk);
        Assert.Empty(result.MissingTables);
    }

    [Fact]
    public async Task SchemaInit_FreshDatabase_ReturnsExpectedTableCount()
    {
        var init   = new SqliteSchemaInitializer(_factory);
        var result = await init.InitializeAsync();
        // 10 expected tables: Kases, Logs, LogVersions, Tags, LogTags,
        // Collections, CollectionFields, CollectionLayout, CollectionItems, kaselog_search
        Assert.Equal(10, result.TableCount);
    }

    [Fact]
    public async Task SchemaInit_IsIdempotent_SecondCallStillOk()
    {
        var init = new SqliteSchemaInitializer(_factory);
        await init.InitializeAsync();
        var result = await init.InitializeAsync();
        Assert.True(result.IsOk);
    }
}
