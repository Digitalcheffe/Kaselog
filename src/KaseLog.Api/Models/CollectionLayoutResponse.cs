namespace KaseLog.Api.Models;

public sealed class CollectionLayoutResponse
{
    public required Guid CollectionId { get; init; }
    public required string Layout { get; init; }
}
