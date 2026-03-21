namespace KaseLog.Api.Models;

public sealed class TimelineEntryResponse
{
    // ── Common ────────────────────────────────────────────────────────────────
    public required string EntityType { get; init; }
    public required Guid   Id         { get; init; }
    public required DateTime CreatedAt { get; init; }
    public required DateTime UpdatedAt { get; init; }

    // ── Log-specific (null for collection_item) ───────────────────────────────
    public string?              Title        { get; init; }
    public string?              Description  { get; init; }
    public int?                 VersionCount { get; init; }
    public IReadOnlyList<string>? Tags       { get; init; }

    // ── Collection item-specific (null for log) ───────────────────────────────
    public Guid?   CollectionId    { get; init; }
    public string? CollectionTitle { get; init; }
    public string? CollectionColor { get; init; }
    public Guid?   KaseId         { get; init; }
    public string? ItemTitle      { get; init; }
    public IReadOnlyList<TimelineSummaryField>? SummaryFields { get; init; }
}
