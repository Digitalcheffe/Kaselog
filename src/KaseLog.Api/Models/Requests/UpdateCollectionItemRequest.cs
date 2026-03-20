using System.ComponentModel.DataAnnotations;
using System.Text.Json;

namespace KaseLog.Api.Models.Requests;

public sealed class UpdateCollectionItemRequest
{
    public Guid? KaseId { get; init; }

    [Required]
    public required Dictionary<string, JsonElement> FieldValues { get; init; }
}
