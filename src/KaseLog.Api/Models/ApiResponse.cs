namespace KaseLog.Api.Models;

public sealed class ApiResponse<T>
{
    public T? Data { get; init; }
    public object? Error { get; init; }
    public object? Meta { get; init; }

    public static ApiResponse<T> Success(T data) => new() { Data = data };

    public static ApiResponse<T> Failure(
        string type,
        string title,
        int status,
        string? detail = null,
        object? errors = null)
        => new()
        {
            Error = new
            {
                type,
                title,
                status,
                detail,
                errors,
            },
        };

    public static ApiResponse<T> NotFound(string detail)
        => Failure(
            "https://tools.ietf.org/html/rfc7807",
            "Not Found",
            404,
            detail);
}
