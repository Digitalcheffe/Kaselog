using System.ComponentModel.DataAnnotations;

namespace KaseLog.Api.Models.Requests;

public sealed class UpdateUserRequest
{
    public string? FirstName { get; init; }
    public string? LastName { get; init; }
    public string? Email { get; init; }

    [Required]
    public required string Theme { get; init; }

    [Required]
    public required string Accent { get; init; }
}
