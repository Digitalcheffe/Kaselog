using KaseLog.Api.Data;
using KaseLog.Api.Models;
using KaseLog.Api.Models.Requests;
using Microsoft.AspNetCore.Mvc;

namespace KaseLog.Api.Controllers;

/// <summary>CRUD operations for Logs and their version history.</summary>
[ApiController]
[Route("api/logs")]
[Produces("application/json")]
public sealed class LogsController : ControllerBase
{
    private readonly ILogRepository _logs;
    private readonly ILogger<LogsController> _logger;

    /// <summary>Initialises a new instance of <see cref="LogsController"/>.</summary>
    public LogsController(ILogRepository logs, ILogger<LogsController> logger)
    {
        _logs   = logs;
        _logger = logger;
    }

    // ── Logs ──────────────────────────────────────────────────────────────────

    /// <summary>Returns a single Log by ID.</summary>
    /// <remarks>
    /// The <c>Content</c> field in the response is taken from the most recent
    /// <c>LogVersion</c> for this Log.
    /// </remarks>
    /// <param name="id">The GUID of the Log to retrieve.</param>
    /// <returns>The Log with its current content, or 404 if not found.</returns>
    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(ApiResponse<LogResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<LogResponse>), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetById(Guid id)
    {
        var log = await _logs.GetByIdAsync(id);
        if (log is null)
            return NotFound(ApiResponse<LogResponse>.NotFound($"Log with ID '{id}' was not found."));
        return Ok(ApiResponse<LogResponse>.Success(log));
    }

    /// <summary>Updates the metadata of an existing Log.</summary>
    /// <remarks>
    /// Updates title, description, and autosave preference. Does not create a new
    /// version — use <c>POST /api/logs/{logId}/versions</c> to save content changes.
    /// </remarks>
    /// <param name="id">The GUID of the Log to update.</param>
    /// <param name="request">Updated title, description, and autosave flag.</param>
    /// <returns>The updated Log, or 404 if not found.</returns>
    [HttpPut("{id:guid}")]
    [ProducesResponseType(typeof(ApiResponse<LogResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<LogResponse>), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse<LogResponse>), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateLogRequest request)
    {
        var log = await _logs.UpdateAsync(id, request.Title, request.Description, request.AutosaveEnabled);
        if (log is null)
            return NotFound(ApiResponse<LogResponse>.NotFound($"Log with ID '{id}' was not found."));
        _logger.LogInformation("[LOG] Updated log {Id} — {Title}", id, log.Title);
        return Ok(ApiResponse<LogResponse>.Success(log));
    }

    /// <summary>Pins or unpins a Log.</summary>
    /// <param name="id">The GUID of the Log to pin or unpin.</param>
    /// <param name="request">Body containing the desired IsPinned state.</param>
    /// <returns>The updated Log, or 404 if not found.</returns>
    [HttpPatch("{id:guid}/pin")]
    [ProducesResponseType(typeof(ApiResponse<LogResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<LogResponse>), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> SetPinned(Guid id, [FromBody] PinLogRequest request)
    {
        var log = await _logs.SetPinnedAsync(id, request.IsPinned);
        if (log is null)
            return NotFound(ApiResponse<LogResponse>.NotFound($"Log with ID '{id}' was not found."));
        _logger.LogInformation("[LOG] {Action} log {Id}", request.IsPinned ? "Pinned" : "Unpinned", id);
        return Ok(ApiResponse<LogResponse>.Success(log));
    }

    /// <summary>Deletes a Log and all its versions.</summary>
    /// <param name="id">The GUID of the Log to delete.</param>
    /// <returns>204 No Content on success, or 404 if not found.</returns>
    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ApiResponse<LogResponse>), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(Guid id)
    {
        var deleted = await _logs.DeleteAsync(id);
        if (!deleted)
            return NotFound(ApiResponse<LogResponse>.NotFound($"Log with ID '{id}' was not found."));
        _logger.LogInformation("[LOG] Deleted log {Id}", id);
        return NoContent();
    }

    // ── Log Versions ──────────────────────────────────────────────────────────

    /// <summary>Returns the full version history for a Log.</summary>
    /// <remarks>Versions are returned newest first. The first item is always the current version.</remarks>
    /// <param name="logId">The GUID of the parent Log.</param>
    /// <returns>All versions for the Log, or 404 if the Log does not exist.</returns>
    [HttpGet("{logId:guid}/versions")]
    [ProducesResponseType(typeof(ApiResponse<IEnumerable<LogVersionResponse>>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<IEnumerable<LogVersionResponse>>), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetVersions(Guid logId)
    {
        var log = await _logs.GetByIdAsync(logId);
        if (log is null)
            return NotFound(ApiResponse<IEnumerable<LogVersionResponse>>.NotFound($"Log with ID '{logId}' was not found."));

        var versions = await _logs.GetVersionsAsync(logId);
        return Ok(ApiResponse<IEnumerable<LogVersionResponse>>.Success(versions));
    }

    /// <summary>Saves a new version of a Log's content.</summary>
    /// <remarks>
    /// Set <c>IsAutosave</c> to <c>true</c> for background saves and <c>false</c> for
    /// explicit user saves. Provide a <c>Label</c> to create a named checkpoint —
    /// named checkpoints are visually distinct in the version history UI.
    /// The FTS5 search index is updated in the same transaction.
    /// </remarks>
    /// <param name="logId">The GUID of the Log to version.</param>
    /// <param name="request">
    /// Content (markdown), optional label, and whether this is an autosave.
    /// </param>
    /// <returns>The newly created version, or 404 if the Log does not exist.</returns>
    [HttpPost("{logId:guid}/versions")]
    [ProducesResponseType(typeof(ApiResponse<LogVersionResponse>), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ApiResponse<LogVersionResponse>), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse<LogVersionResponse>), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> AddVersion(Guid logId, [FromBody] CreateVersionRequest request)
    {
        var version = await _logs.AddVersionAsync(logId, request.Content, request.Label, request.IsAutosave);
        if (version is null)
            return NotFound(ApiResponse<LogVersionResponse>.NotFound($"Log with ID '{logId}' was not found."));

        var saveKind = !string.IsNullOrWhiteSpace(request.Label) ? $"checkpoint \"{request.Label}\""
                     : request.IsAutosave                        ? "autosave"
                     :                                             "manual save";
        _logger.LogInformation("[VERSION] Saved version {VersionId} for log {LogId} — {SaveKind}", version.Id, logId, saveKind);

        return CreatedAtAction(nameof(GetVersionById), new { logId, versionId = version.Id },
            ApiResponse<LogVersionResponse>.Success(version));
    }

    /// <summary>Returns a specific version of a Log by version ID.</summary>
    /// <param name="logId">The GUID of the parent Log.</param>
    /// <param name="versionId">The GUID of the version to retrieve.</param>
    /// <returns>The requested version, or 404 if either ID is not found.</returns>
    [HttpGet("{logId:guid}/versions/{versionId:guid}")]
    [ProducesResponseType(typeof(ApiResponse<LogVersionResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<LogVersionResponse>), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetVersionById(Guid logId, Guid versionId)
    {
        var version = await _logs.GetVersionByIdAsync(logId, versionId);
        if (version is null)
            return NotFound(ApiResponse<LogVersionResponse>.NotFound(
                $"Version with ID '{versionId}' was not found for Log '{logId}'."));
        return Ok(ApiResponse<LogVersionResponse>.Success(version));
    }

    /// <summary>Restores a prior version by creating a new version with its content.</summary>
    /// <remarks>
    /// Restore never mutates history. A new <c>LogVersion</c> is inserted with
    /// the restored content, incrementing the version count.
    /// </remarks>
    /// <param name="logId">The GUID of the parent Log.</param>
    /// <param name="versionId">The GUID of the version to restore from.</param>
    /// <returns>The new version created from the restore, or 404 if either ID is not found.</returns>
    [HttpPost("{logId:guid}/versions/{versionId:guid}/restore")]
    [ProducesResponseType(typeof(ApiResponse<LogVersionResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<LogVersionResponse>), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> RestoreVersion(Guid logId, Guid versionId)
    {
        var version = await _logs.RestoreVersionAsync(logId, versionId);
        if (version is null)
            return NotFound(ApiResponse<LogVersionResponse>.NotFound(
                $"Version with ID '{versionId}' was not found for Log '{logId}'."));
        _logger.LogInformation("[VERSION] Restored version {SourceVersionId} for log {LogId} — new version {NewVersionId}", versionId, logId, version.Id);
        return Ok(ApiResponse<LogVersionResponse>.Success(version));
    }
}
