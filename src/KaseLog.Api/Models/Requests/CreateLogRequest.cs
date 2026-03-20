using System.ComponentModel.DataAnnotations;

namespace KaseLog.Api.Models.Requests;

public sealed class CreateLogRequest
{
    [Required]
    [StringLength(200, MinimumLength = 1)]
    public string Title { get; init; } = string.Empty;

    [StringLength(500)]
    public string? Description { get; init; }

    public bool AutosaveEnabled { get; init; } = true;
}
