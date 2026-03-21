using KaseLog.Api.Data;
using KaseLog.Api.Models;
using KaseLog.Api.Models.Requests;
using Microsoft.AspNetCore.Mvc;

namespace KaseLog.Api.Controllers;

/// <summary>Tag management endpoints.</summary>
[ApiController]
[Produces("application/json")]
public sealed class TagsController : ControllerBase
{
    private readonly ITagRepository _tags;
    private readonly ILogRepository _logs;
    private readonly ILogger<TagsController> _logger;

    /// <summary>Initialises a new instance of <see cref="TagsController"/>.</summary>
    public TagsController(ITagRepository tags, ILogRepository logs, ILogger<TagsController> logger)
    {
        _tags   = tags;
        _logs   = logs;
        _logger = logger;
    }

    /// <summary>Returns all known tags.</summary>
    [HttpGet("api/tags")]
    [ProducesResponseType(typeof(ApiResponse<IEnumerable<TagDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAll()
    {
        var all = await _tags.GetAllAsync();
        return Ok(ApiResponse<IEnumerable<TagDto>>.Success(all));
    }

    /// <summary>Adds a tag to a Log, creating the tag if it does not already exist.</summary>
    /// <param name="logId">The GUID of the Log.</param>
    /// <param name="request">The tag name to add.</param>
    /// <returns>The tag that was added, or 404 if the Log was not found.</returns>
    [HttpPost("api/logs/{logId:guid}/tags")]
    [ProducesResponseType(typeof(ApiResponse<TagDto>), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ApiResponse<TagDto>), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> AddToLog(Guid logId, [FromBody] CreateTagRequest request)
    {
        var tag = await _tags.AddToLogAsync(logId, request.Name);
        if (tag is null)
            return NotFound(ApiResponse<TagDto>.NotFound($"Log with ID '{logId}' was not found."));
        _logger.LogInformation("[TAG] Added tag '{Name}' ({TagId}) to log {LogId}", tag.Name, tag.Id, logId);
        return CreatedAtAction(nameof(GetAll), ApiResponse<TagDto>.Success(tag));
    }

    /// <summary>Removes a tag association from a Log.</summary>
    /// <param name="logId">The GUID of the Log.</param>
    /// <param name="tagId">The GUID of the tag to remove.</param>
    /// <returns>204 No Content on success, or 404 if the association was not found.</returns>
    [HttpDelete("api/logs/{logId:guid}/tags/{tagId:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ApiResponse<TagDto>), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> RemoveFromLog(Guid logId, Guid tagId)
    {
        var removed = await _tags.RemoveFromLogAsync(logId, tagId);
        if (!removed)
            return NotFound(ApiResponse<TagDto>.NotFound($"Tag association not found."));
        _logger.LogInformation("[TAG] Removed tag {TagId} from log {LogId}", tagId, logId);
        return NoContent();
    }
}
