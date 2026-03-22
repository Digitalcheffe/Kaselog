using System.Text.Json;

namespace KaseLog.Api.Models;

public sealed class CollectionItemHistoryResponse
{
    public required Guid Id { get; init; }
    public required Guid CollectionItemId { get; init; }
    public required JsonElement FieldValues { get; init; }
    public required string ChangeSummary { get; init; }
    public required DateTime CreatedAt { get; init; }
}
