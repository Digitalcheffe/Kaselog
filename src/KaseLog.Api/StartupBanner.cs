using KaseLog.Api.Data;

namespace KaseLog.Api;

/// <summary>
/// Builds and prints the startup health banner to stdout.
/// Using Console.WriteLine directly (not ILogger) ensures the banner always
/// appears regardless of log level configuration and renders cleanly in
/// Portainer without a log category prefix.
/// </summary>
public static class StartupBanner
{
    private const string Top    = "════════════════════════════════════════════";
    private const string Divider = "────────────────────────────────────────────";
    private const int    LabelW = 10; // width of the left label column

    /// <summary>
    /// Builds the banner string from the provided startup context.
    /// Returns both the banner text and whether startup succeeded.
    /// </summary>
    public static string Build(StartupContext ctx)
    {
        var status = ctx.Schema.IsOk && !ctx.ImagesFailed
            ? "ready"
            : "STARTUP FAILED";

        var schemaLine = ctx.Schema.IsOk
            ? $"ok  ({ctx.Schema.TableCount} tables verified)"
            : $"MISSING: {string.Join(", ", ctx.Schema.MissingTables)}";

        var seedLine = ctx.Seed switch
        {
            SeedStatus.Inserted => "inserted — first run",
            SeedStatus.Skipped  => "skipped — data exists",
            _                   => "ERROR — see logs above",
        };

        var startedLine = ctx.StartedAt.ToString("yyyy-MM-dd HH:mm:ss") + " UTC";

        var lines = new[]
        {
            Top,
            $"  KaseLog v{ctx.Version,-12} {status}",
            Divider,
            Field("port",     ctx.Port),
            Field("database", $"{ctx.DatabasePath}   [{ctx.DbProvider}]"),
            Field("schema",   schemaLine),
            Field("images",   $"{ctx.ImagesDir}       [{ctx.ImagesStatus}]"),
            Field("seed",     seedLine),
            Field("started",  startedLine),
            Top,
        };

        return string.Join(Environment.NewLine, lines);
    }

    /// <summary>Prints the banner to stdout.</summary>
    public static void Print(StartupContext ctx)
    {
        Console.WriteLine();
        Console.WriteLine(Build(ctx));
        Console.WriteLine();
    }

    private static string Field(string label, string value)
        => $"  {label.PadRight(LabelW)}{value}";
}

/// <summary>All data needed to render the startup banner.</summary>
public sealed record StartupContext(
    string           Version,
    string           Port,
    string           DatabasePath,
    string           DbProvider,
    SchemaInitResult Schema,
    string           ImagesDir,
    string           ImagesStatus,
    bool             ImagesFailed,
    SeedStatus       Seed,
    DateTime         StartedAt
);
