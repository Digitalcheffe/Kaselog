using KaseLog.Api.Data;
using KaseLog.Api.Models;
using KaseLog.Api.Models.Requests;
using Microsoft.AspNetCore.Mvc;

namespace KaseLog.Api.Controllers;

[ApiController]
[Route("api/logs")]
public sealed class LogsController : ControllerBase
{
    private readonly ILogRepository _logs;

    public LogsController(ILogRepository logs) => _logs = logs;

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var log = await _logs.GetByIdAsync(id);
        if (log is null)
            return NotFound(ApiResponse<LogResponse>.NotFound($"Log with ID '{id}' was not found."));
        return Ok(ApiResponse<LogResponse>.Success(log));
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateLogRequest request)
    {
        var log = await _logs.UpdateAsync(id, request.Title, request.Description, request.AutosaveEnabled);
        if (log is null)
            return NotFound(ApiResponse<LogResponse>.NotFound($"Log with ID '{id}' was not found."));
        return Ok(ApiResponse<LogResponse>.Success(log));
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var deleted = await _logs.DeleteAsync(id);
        if (!deleted)
            return NotFound(ApiResponse<LogResponse>.NotFound($"Log with ID '{id}' was not found."));
        return NoContent();
    }

    // ── Log Versions ──────────────────────────────────────────────────────────

    [HttpGet("{logId:guid}/versions")]
    public async Task<IActionResult> GetVersions(Guid logId)
    {
        var log = await _logs.GetByIdAsync(logId);
        if (log is null)
            return NotFound(ApiResponse<IEnumerable<LogVersionResponse>>.NotFound($"Log with ID '{logId}' was not found."));

        var versions = await _logs.GetVersionsAsync(logId);
        return Ok(ApiResponse<IEnumerable<LogVersionResponse>>.Success(versions));
    }

    [HttpPost("{logId:guid}/versions")]
    public async Task<IActionResult> AddVersion(Guid logId, [FromBody] CreateVersionRequest request)
    {
        var version = await _logs.AddVersionAsync(logId, request.Content, request.Label, request.IsAutosave);
        if (version is null)
            return NotFound(ApiResponse<LogVersionResponse>.NotFound($"Log with ID '{logId}' was not found."));

        return CreatedAtAction(nameof(GetVersionById), new { logId, versionId = version.Id },
            ApiResponse<LogVersionResponse>.Success(version));
    }

    [HttpGet("{logId:guid}/versions/{versionId:guid}")]
    public async Task<IActionResult> GetVersionById(Guid logId, Guid versionId)
    {
        var version = await _logs.GetVersionByIdAsync(logId, versionId);
        if (version is null)
            return NotFound(ApiResponse<LogVersionResponse>.NotFound(
                $"Version with ID '{versionId}' was not found for Log '{logId}'."));
        return Ok(ApiResponse<LogVersionResponse>.Success(version));
    }

    [HttpPost("{logId:guid}/versions/{versionId:guid}/restore")]
    public async Task<IActionResult> RestoreVersion(Guid logId, Guid versionId)
    {
        var version = await _logs.RestoreVersionAsync(logId, versionId);
        if (version is null)
            return NotFound(ApiResponse<LogVersionResponse>.NotFound(
                $"Version with ID '{versionId}' was not found for Log '{logId}'."));
        return Ok(ApiResponse<LogVersionResponse>.Success(version));
    }
}
