using KaseLog.Api.Data;
using KaseLog.Api.Models;
using KaseLog.Api.Models.Requests;
using Microsoft.AspNetCore.Mvc;

namespace KaseLog.Api.Controllers;

[ApiController]
[Route("api/kases/{kaseId:guid}/logs")]
public sealed class KaseLogsController : ControllerBase
{
    private readonly ILogRepository _logs;
    private readonly IKaseRepository _kases;

    public KaseLogsController(ILogRepository logs, IKaseRepository kases)
    {
        _logs = logs;
        _kases = kases;
    }

    [HttpGet]
    public async Task<IActionResult> GetByKase(Guid kaseId)
    {
        var kase = await _kases.GetByIdAsync(kaseId);
        if (kase is null)
            return NotFound(ApiResponse<IEnumerable<LogResponse>>.NotFound($"Kase with ID '{kaseId}' was not found."));

        var logs = await _logs.GetByKaseIdAsync(kaseId);
        return Ok(ApiResponse<IEnumerable<LogResponse>>.Success(logs));
    }

    [HttpPost]
    public async Task<IActionResult> Create(Guid kaseId, [FromBody] CreateLogRequest request)
    {
        var log = await _logs.CreateAsync(kaseId, request.Title, request.Description, request.AutosaveEnabled);
        if (log is null)
            return NotFound(ApiResponse<LogResponse>.NotFound($"Kase with ID '{kaseId}' was not found."));

        return CreatedAtAction("GetById", "Logs", new { id = log.Id },
            ApiResponse<LogResponse>.Success(log));
    }
}
