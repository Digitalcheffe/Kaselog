using KaseLog.Api.Data;
using KaseLog.Api.Models;
using KaseLog.Api.Models.Requests;
using Microsoft.AspNetCore.Mvc;

namespace KaseLog.Api.Controllers;

/// <summary>CRUD operations for Kases.</summary>
[ApiController]
[Route("api/kases")]
[Produces("application/json")]
public sealed class KasesController : ControllerBase
{
    private readonly IKaseRepository _kases;

    /// <summary>Initialises a new instance of <see cref="KasesController"/>.</summary>
    public KasesController(IKaseRepository kases) => _kases = kases;

    /// <summary>Returns all Kases.</summary>
    /// <returns>A list of every Kase in the system.</returns>
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

    /// <summary>Updates the title and description of an existing Kase.</summary>
    /// <param name="id">The GUID of the Kase to update.</param>
    /// <param name="request">Updated title and optional description.</param>
    /// <returns>The updated Kase, or 404 if not found.</returns>
    [HttpPut("{id:guid}")]
    [ProducesResponseType(typeof(ApiResponse<KaseResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<KaseResponse>), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse<KaseResponse>), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateKaseRequest request)
    {
        var kase = await _kases.UpdateAsync(id, request.Title, request.Description);
        if (kase is null)
            return NotFound(ApiResponse<KaseResponse>.NotFound($"Kase with ID '{id}' was not found."));
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
        return NoContent();
    }
}
