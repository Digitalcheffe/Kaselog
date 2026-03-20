namespace KaseLog.Api.Models;

public sealed class SearchResultDto
{
    public required string LogId { get; init; }
    public required string KaseId { get; init; }
    public required string KaseTitle { get; init; }
    public required string Title { get; init; }
    public string Highlight { get; init; } = string.Empty;
    public IReadOnlyList<string> Tags { get; init; } = [];
    public string UpdatedAt { get; init; } = string.Empty;
}
