namespace KaseLog.Api.Models;

public sealed class CollectionFieldResponse
{
    public required Guid Id { get; init; }
    public required Guid CollectionId { get; init; }
    public required string Name { get; init; }
    public required string Type { get; init; }
    public required bool Required { get; init; }
    public required bool ShowInList { get; init; }
    public string[]? Options { get; init; }
    public required int SortOrder { get; init; }
}
