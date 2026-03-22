namespace KaseLog.Api.Models;

public sealed class UserResponse
{
    public required string Id { get; init; }
    public string? FirstName { get; init; }
    public string? LastName { get; init; }
    public string? Email { get; init; }
    public required string Theme { get; init; }
    public required string Accent { get; init; }
    public required string FontSize { get; init; }
    public required string CreatedAt { get; init; }
    public required string UpdatedAt { get; init; }
}
