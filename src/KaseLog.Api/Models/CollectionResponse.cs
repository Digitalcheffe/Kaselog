namespace KaseLog.Api.Models;

public sealed class CollectionResponse
{
    public required Guid Id { get; init; }
    public required string Title { get; init; }
    public required string Color { get; init; }
    public required int ItemCount { get; init; }
    public required DateTime CreatedAt { get; init; }
    public required DateTime UpdatedAt { get; init; }
}
