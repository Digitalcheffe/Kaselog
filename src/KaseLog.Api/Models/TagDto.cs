namespace KaseLog.Api.Models;

/// <summary>Represents a tag that can be applied to a Log.</summary>
public sealed class TagDto
{
    /// <summary>The unique identifier for the tag.</summary>
    public Guid Id { get; init; }

    /// <summary>The normalised (lowercase) tag name.</summary>
    public string Name { get; init; } = string.Empty;

    /// <summary>When the tag was first created.</summary>
    public DateTime CreatedAt { get; init; }
}
