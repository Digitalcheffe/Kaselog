namespace KaseLog.Api.Models;

public sealed class KaseResponse
{
    public Guid Id { get; init; }
    public string Title { get; init; } = string.Empty;
    public string? Description { get; init; }
    public int LogCount { get; init; }
    public bool IsPinned { get; init; }
    public string? LatestLogTitle { get; init; }
    public string? LatestLogPreview { get; init; }
    public DateTime? LatestLogUpdatedAt { get; init; }
    public DateTime CreatedAt { get; init; }
    public DateTime UpdatedAt { get; init; }
}
