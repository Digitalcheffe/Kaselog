using System.Text.Json;

namespace KaseLog.Api.Models;

public sealed class CollectionItemResponse
{
    public required Guid Id { get; init; }
    public required Guid CollectionId { get; init; }
    public Guid? KaseId { get; init; }
    public required JsonElement FieldValues { get; init; }
    public required DateTime CreatedAt { get; init; }
    public required DateTime UpdatedAt { get; init; }
}
