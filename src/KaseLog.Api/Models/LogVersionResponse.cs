namespace KaseLog.Api.Models;

public sealed class LogVersionResponse
{
    public Guid Id { get; init; }
    public Guid LogId { get; init; }
    public string Content { get; init; } = string.Empty;
    public string? Label { get; init; }
    public bool IsAutosave { get; init; }
    public DateTime CreatedAt { get; init; }
}
