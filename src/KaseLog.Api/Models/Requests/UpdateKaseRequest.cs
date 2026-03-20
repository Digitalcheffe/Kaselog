using System.ComponentModel.DataAnnotations;

namespace KaseLog.Api.Models.Requests;

public sealed class UpdateKaseRequest
{
    [Required]
    [StringLength(200, MinimumLength = 1)]
    public string Title { get; init; } = string.Empty;

    [StringLength(1000)]
    public string? Description { get; init; }
}
