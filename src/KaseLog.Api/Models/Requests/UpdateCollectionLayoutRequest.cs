using System.ComponentModel.DataAnnotations;

namespace KaseLog.Api.Models.Requests;

public sealed class UpdateCollectionLayoutRequest
{
    [Required]
    public required string Layout { get; init; }
}
