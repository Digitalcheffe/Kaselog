namespace KaseLog.Api.Models.Requests;

public sealed class CreateVersionRequest
{
    public string Content { get; init; } = string.Empty;
    public string? Label { get; init; }
    public bool IsAutosave { get; init; } = true;
}
