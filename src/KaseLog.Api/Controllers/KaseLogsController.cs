using KaseLog.Api.Data;
using KaseLog.Api.Models;
using KaseLog.Api.Models.Requests;
using Microsoft.AspNetCore.Mvc;

namespace KaseLog.Api.Controllers;

/// <summary>Operations for Logs scoped to a specific Kase.</summary>
[ApiController]
[Route("api/kases/{kaseId:guid}/logs")]
[Produces("application/json")]
public sealed class KaseLogsController : ControllerBase
{
    private readonly ILogRepository _logs;
    private readonly IKaseRepository _kases;

    /// <summary>Initialises a new instance of <see cref="KaseLogsController"/>.</summary>
    public KaseLogsController(ILogRepository logs, IKaseRepository kases)
    {
        _logs = logs;
        _kases = kases;
    }

    /// <summary>Returns all Logs belonging to a Kase.</summary>
    /// <param name="kaseId">The GUID of the parent Kase.</param>
    /// <returns>A list of Logs for the Kase, newest first.</returns>
    [HttpGet]
    [ProducesResponseType(typeof(ApiResponse<IEnumerable<LogResponse>>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<IEnumerable<LogResponse>>), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetByKase(Guid kaseId)
    {
        var kase = await _kases.GetByIdAsync(kaseId);
        if (kase is null)
            return NotFound(ApiResponse<IEnumerable<LogResponse>>.NotFound($"Kase with ID '{kaseId}' was not found."));

        var logs = await _logs.GetByKaseIdAsync(kaseId);
        return Ok(ApiResponse<IEnumerable<LogResponse>>.Success(logs));
    }

    /// <summary>Creates a new Log inside a Kase.</summary>
    /// <remarks>
    /// Creates the Log and its initial empty <c>LogVersion</c> in a single atomic transaction.
    /// The FTS5 search index is updated in the same transaction.
    /// </remarks>
    /// <param name="kaseId">The GUID of the parent Kase.</param>
    /// <param name="request">Title, optional description, and autosave preference for the new Log.</param>
    /// <returns>The newly created Log including its initial content and version count.</returns>
    [HttpPost]
    [ProducesResponseType(typeof(ApiResponse<LogResponse>), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ApiResponse<LogResponse>), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse<LogResponse>), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Create(Guid kaseId, [FromBody] CreateLogRequest request)
    {
        var log = await _logs.CreateAsync(kaseId, request.Title, request.Description, request.AutosaveEnabled);
        if (log is null)
            return NotFound(ApiResponse<LogResponse>.NotFound($"Kase with ID '{kaseId}' was not found."));

        return CreatedAtAction("GetById", "Logs", new { id = log.Id },
            ApiResponse<LogResponse>.Success(log));
    }
}
