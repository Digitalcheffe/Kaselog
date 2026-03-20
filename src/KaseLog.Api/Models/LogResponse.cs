namespace KaseLog.Api.Models;

public sealed class LogResponse
{
    public Guid Id { get; init; }
    public Guid KaseId { get; init; }
    public string Title { get; init; } = string.Empty;
    public string? Description { get; init; }
    public bool AutosaveEnabled { get; init; }
    public string Content { get; init; } = string.Empty;
    public int VersionCount { get; init; }
    public IReadOnlyList<TagDto> Tags { get; init; } = [];
    public DateTime CreatedAt { get; init; }
    public DateTime UpdatedAt { get; init; }
}
