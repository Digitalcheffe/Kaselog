namespace KaseLog.Api.Models;

/// <summary>Returned after a successful image upload.</summary>
public sealed class ImageUploadResponse
{
    /// <summary>
    /// 40-character alphanumeric uppercase UID assigned to this image.
    /// Example: <c>A3F9K2M7RX4B9NPQ2WYH6JDCT8VE1SKL0F5GZ3U</c>
    /// </summary>
    public string Uid { get; init; } = string.Empty;

    /// <summary>
    /// URL to retrieve the image via <c>GET /api/images/{uid}</c>.
    /// </summary>
    public string Url { get; init; } = string.Empty;
}
