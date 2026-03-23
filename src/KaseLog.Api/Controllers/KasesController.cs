using KaseLog.Api.Data;
using KaseLog.Api.Models;
using KaseLog.Api.Models.Requests;
using KaseLog.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace KaseLog.Api.Controllers;

/// <summary>CRUD operations for Kases.</summary>
[ApiController]
[Route("api/kases")]
[Produces("application/json")]
public sealed class KasesController : ControllerBase
{
    private readonly IKaseRepository _kases;
    private readonly IKaseExportService _export;
    private readonly ILogger<KasesController> _logger;

    /// <summary>Initialises a new instance of <see cref="KasesController"/>.</summary>
    public KasesController(IKaseRepository kases, IKaseExportService export, ILogger<KasesController> logger)
    {
        _kases  = kases;
        _export = export;
        _logger = logger;
    }

    /// <summary>Returns all Kases.</summary>
    /// <returns>A list of every Kase in the system, pinned first then by latest log activity.</returns>
    [HttpGet]
    [ProducesResponseType(typeof(ApiResponse<IEnumerable<KaseResponse>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAll()
    {
        var kases = await _kases.GetAllAsync();
        return Ok(ApiResponse<IEnumerable<KaseResponse>>.Success(kases));
    }

    /// <summary>Creates a new Kase.</summary>
    /// <param name="request">Title and optional description for the new Kase.</param>
    /// <returns>The newly created Kase.</returns>
    [HttpPost]
    [ProducesResponseType(typeof(ApiResponse<KaseResponse>), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ApiResponse<KaseResponse>), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Create([FromBody] CreateKaseRequest request)
    {
        var kase = await _kases.CreateAsync(request.Title, request.Description);
        _logger.LogInformation("[KASE] Created kase {Id} — {Title}", kase.Id, kase.Title);
        return CreatedAtAction(nameof(GetById), new { id = kase.Id },
            ApiResponse<KaseResponse>.Success(kase));
    }

    /// <summary>Returns a single Kase by ID.</summary>
    /// <param name="id">The GUID of the Kase to retrieve.</param>
    /// <returns>The Kase, or 404 if not found.</returns>
    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(ApiResponse<KaseResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<KaseResponse>), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetById(Guid id)
    {
        var kase = await _kases.GetByIdAsync(id);
        if (kase is null)
            return NotFound(ApiResponse<KaseResponse>.NotFound($"Kase with ID '{id}' was not found."));
        return Ok(ApiResponse<KaseResponse>.Success(kase));
    }

    /// <summary>Updates an existing Kase, including optional IsPinned flag.</summary>
    /// <param name="id">The GUID of the Kase to update.</param>
    /// <param name="request">Updated title, optional description, and optional IsPinned.</param>
    /// <returns>The updated Kase, or 404 if not found.</returns>
    [HttpPut("{id:guid}")]
    [ProducesResponseType(typeof(ApiResponse<KaseResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<KaseResponse>), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse<KaseResponse>), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateKaseRequest request)
    {
        var kase = await _kases.UpdateAsync(id, request.Title, request.Description, request.IsPinned);
        if (kase is null)
            return NotFound(ApiResponse<KaseResponse>.NotFound($"Kase with ID '{id}' was not found."));
        _logger.LogInformation("[KASE] Updated kase {Id} — {Title}", id, kase.Title);
        return Ok(ApiResponse<KaseResponse>.Success(kase));
    }

    /// <summary>Deletes a Kase and all its Logs.</summary>
    /// <param name="id">The GUID of the Kase to delete.</param>
    /// <returns>204 No Content on success, or 404 if not found.</returns>
    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ApiResponse<KaseResponse>), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(Guid id)
    {
        var deleted = await _kases.DeleteAsync(id);
        if (!deleted)
            return NotFound(ApiResponse<KaseResponse>.NotFound($"Kase with ID '{id}' was not found."));
        _logger.LogInformation("[KASE] Deleted kase {Id}", id);
        return NoContent();
    }

    /// <summary>Pins a Kase so it appears at the top of all Kase lists.</summary>
    [HttpPost("{id:guid}/pin")]
    [ProducesResponseType(typeof(ApiResponse<KaseResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<KaseResponse>), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Pin(Guid id)
    {
        var kase = await _kases.SetPinnedAsync(id, pinned: true);
        if (kase is null)
            return NotFound(ApiResponse<KaseResponse>.NotFound($"Kase with ID '{id}' was not found."));
        _logger.LogInformation("[KASE] Pinned kase {Id}", id);
        return Ok(ApiResponse<KaseResponse>.Success(kase));
    }

    /// <summary>Unpins a Kase.</summary>
    [HttpPost("{id:guid}/unpin")]
    [ProducesResponseType(typeof(ApiResponse<KaseResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<KaseResponse>), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Unpin(Guid id)
    {
        var kase = await _kases.SetPinnedAsync(id, pinned: false);
        if (kase is null)
            return NotFound(ApiResponse<KaseResponse>.NotFound($"Kase with ID '{id}' was not found."));
        _logger.LogInformation("[KASE] Unpinned kase {Id}", id);
        return Ok(ApiResponse<KaseResponse>.Success(kase));
    }

    /// <summary>Returns Logs and linked Collection items for a Kase in reverse-chronological order.</summary>
    [HttpGet("{id:guid}/timeline")]
    [ProducesResponseType(typeof(ApiResponse<IEnumerable<TimelineEntryResponse>>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetTimeline(
        Guid id,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50)
    {
        var kase = await _kases.GetByIdAsync(id);
        if (kase is null)
            return NotFound(ApiResponse<IEnumerable<TimelineEntryResponse>>.NotFound(
                $"Kase with ID '{id}' was not found."));

        var entries = await _kases.GetTimelineAsync(id, Math.Max(1, page), Math.Clamp(pageSize, 1, 200));
        return Ok(ApiResponse<IEnumerable<TimelineEntryResponse>>.Success(entries));
    }

    /// <summary>Exports a Kase as a Markdown or PDF file download.</summary>
    /// <param name="id">The GUID of the Kase to export.</param>
    /// <param name="format">Export format: <c>markdown</c> or <c>pdf</c>.</param>
    /// <returns>The file as a download, or 404 if the Kase is not found.</returns>
    [HttpGet("{id:guid}/export")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Export(Guid id, [FromQuery] string format = "markdown")
    {
        var fmt = format.ToLowerInvariant();

        if (fmt != "markdown" && fmt != "pdf")
        {
            return BadRequest(ApiResponse<object>.Failure(
                "https://tools.ietf.org/html/rfc7807",
                "Bad Request", 400,
                "Invalid format. Supported values: markdown, pdf."));
        }

        var result = fmt == "pdf"
            ? await _export.ExportPdfAsync(id)
            : await _export.ExportMarkdownAsync(id);

        if (result is null)
            return NotFound(ApiResponse<object>.NotFound($"Kase with ID '{id}' was not found."));

        _logger.LogInformation("[KASE] Exported kase {Id} as {Format}", id, format);

        return File(result.Content, result.ContentType, fileDownloadName: result.FileName);
    }
}
