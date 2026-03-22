namespace KaseLog.Api.Models;

public sealed class SearchResultDto
{
    public required string LogId { get; init; }
    public required string KaseId { get; init; }
    public required string KaseTitle { get; init; }
    public string EntityType { get; init; } = "log";
    public required string Title { get; init; }
    public string Highlight { get; init; } = string.Empty;
    public IReadOnlyList<string> Tags { get; init; } = [];
    public string UpdatedAt { get; init; } = string.Empty;
    // Collection item fields
    public string? CollectionId { get; init; }
    public string? CollectionTitle { get; init; }
    public string? CollectionColor { get; init; }
}
