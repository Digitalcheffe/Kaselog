using System.ComponentModel.DataAnnotations;

namespace KaseLog.Api.Models.Requests;

/// <summary>Request body for adding a tag to a Log.</summary>
public sealed class CreateTagRequest
{
    /// <summary>The tag name. Will be normalised to lowercase.</summary>
    [Required]
    [MaxLength(100)]
    public string Name { get; init; } = string.Empty;
}
