using System.ComponentModel.DataAnnotations;

namespace KaseLog.Api.Models.Requests;

public sealed class CreateCollectionFieldRequest
{
    [Required, MaxLength(100)]
    public required string Name { get; init; }

    [Required]
    public required string Type { get; init; }

    public bool Required { get; init; }
    public bool ShowInList { get; init; } = true;
    public string[]? Options { get; init; }
    public int SortOrder { get; init; }
}
