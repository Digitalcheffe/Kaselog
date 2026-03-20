using System.ComponentModel.DataAnnotations;

namespace KaseLog.Api.Models.Requests;

public sealed class ReorderFieldsRequest
{
    [Required]
    public required IReadOnlyList<Guid> FieldIds { get; init; }
}
