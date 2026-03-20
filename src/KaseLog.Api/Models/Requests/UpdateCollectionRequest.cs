using System.ComponentModel.DataAnnotations;

namespace KaseLog.Api.Models.Requests;

public sealed class UpdateCollectionRequest
{
    [Required, MaxLength(200)]
    public required string Title { get; init; }

    public string Color { get; init; } = "teal";
}
