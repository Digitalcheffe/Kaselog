using KaseLog.Api.Models;
using Microsoft.AspNetCore.Mvc;

namespace KaseLog.Api.Controllers;

/// <summary>Image upload and retrieval endpoints.</summary>
[ApiController]
[Route("api/images")]
public sealed class ImagesController : ControllerBase
{
    private readonly string _imagesDir;
    private static readonly char[] _uidChars =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789".ToCharArray();

    /// <summary>Initialises a new instance of <see cref="ImagesController"/>.</summary>
    public ImagesController(ImageStorageOptions options)
    {
        _imagesDir = options.ImagesDirectory;
    }

    /// <summary>Uploads an image and returns its UID and serving URL.</summary>
    /// <param name="file">The image file to upload.</param>
    /// <returns>The generated UID and URL for the uploaded image.</returns>
    [HttpPost]
    [ProducesResponseType(typeof(ApiResponse<ImageUploadResponse>), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Upload(IFormFile file)
    {
        if (file is null || file.Length == 0)
            return BadRequest(new { error = new { detail = "No file provided." } });

        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (string.IsNullOrEmpty(ext)) ext = ".bin";

        var uid = GenerateUid();
        var fileName = $"{uid}{ext}";
        var filePath = Path.Combine(_imagesDir, fileName);

        Directory.CreateDirectory(_imagesDir);

        await using var stream = System.IO.File.Create(filePath);
        await file.CopyToAsync(stream);

        var response = new ImageUploadResponse
        {
            Uid = uid,
            Url = $"/api/images/{uid}",
        };

        return StatusCode(StatusCodes.Status201Created,
            ApiResponse<ImageUploadResponse>.Success(response));
    }

    /// <summary>Serves an uploaded image by its UID.</summary>
    /// <param name="uid">The 40-character UID of the image.</param>
    /// <returns>The image file, or 404 if not found.</returns>
    [HttpGet("{uid}")]
    public IActionResult GetImage(string uid)
    {
        // Search for any file matching uid.* in the images directory
        var files = Directory.Exists(_imagesDir)
            ? Directory.GetFiles(_imagesDir, $"{uid}.*")
            : [];

        if (files.Length == 0)
            return NotFound();

        var filePath = files[0];
        var ext = Path.GetExtension(filePath).TrimStart('.').ToLowerInvariant();
        var contentType = ext switch
        {
            "jpg" or "jpeg" => "image/jpeg",
            "png" => "image/png",
            "gif" => "image/gif",
            "webp" => "image/webp",
            "svg" => "image/svg+xml",
            _ => "application/octet-stream",
        };

        return PhysicalFile(filePath, contentType);
    }

    /// <summary>Deletes an uploaded image by its UID.</summary>
    /// <param name="uid">The 40-character UID of the image.</param>
    /// <returns>204 No Content, or 404 if not found.</returns>
    [HttpDelete("{uid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public IActionResult DeleteImage(string uid)
    {
        var files = Directory.Exists(_imagesDir)
            ? Directory.GetFiles(_imagesDir, $"{uid}.*")
            : [];

        if (files.Length == 0)
            return NotFound();

        System.IO.File.Delete(files[0]);
        return NoContent();
    }

    private static string GenerateUid()
    {
        var bytes = new byte[40];
        System.Security.Cryptography.RandomNumberGenerator.Fill(bytes);
        var uid = new char[40];
        for (int i = 0; i < 40; i++)
            uid[i] = _uidChars[bytes[i] % _uidChars.Length];
        return new string(uid);
    }
}

