using KaseLog.Api.Data;
using KaseLog.Api.Models;
using KaseLog.Api.Models.Requests;
using Microsoft.AspNetCore.Mvc;

namespace KaseLog.Api.Controllers;

/// <summary>Individual Collection item endpoints: GET, PUT, DELETE /api/items/{id}.</summary>
[ApiController]
[Route("api/items")]
[Produces("application/json")]
public sealed class CollectionItemsController : ControllerBase
{
    private readonly ICollectionRepository _collections;

    public CollectionItemsController(ICollectionRepository collections) => _collections = collections;

    /// <summary>Returns a Collection item by ID.</summary>
    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(ApiResponse<CollectionItemResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetItem(Guid id)
    {
        var item = await _collections.GetItemAsync(id);
        if (item is null)
            return NotFound(ApiResponse<CollectionItemResponse>.NotFound($"Item '{id}' was not found."));
        return Ok(ApiResponse<CollectionItemResponse>.Success(item));
    }

    /// <summary>Updates a Collection item's field values and optional Kase link.</summary>
    [HttpPut("{id:guid}")]
    [ProducesResponseType(typeof(ApiResponse<CollectionItemResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateItem(Guid id, [FromBody] UpdateCollectionItemRequest request)
    {
        try
        {
            var item = await _collections.UpdateItemAsync(id, request);
            if (item is null)
                return NotFound(ApiResponse<CollectionItemResponse>.NotFound($"Item '{id}' was not found."));
            return Ok(ApiResponse<CollectionItemResponse>.Success(item));
        }
        catch (CollectionItemValidationException ex)
        {
            return BadRequest(ApiResponse<CollectionItemResponse>.Failure(
                "https://tools.ietf.org/html/rfc7807",
                "Validation failed", 400,
                "One or more required fields are missing or empty.",
                ex.FieldErrors));
        }
    }

    /// <summary>Deletes a Collection item.</summary>
    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteItem(Guid id)
    {
        var deleted = await _collections.DeleteItemAsync(id);
        if (!deleted)
            return NotFound(ApiResponse<CollectionItemResponse>.NotFound($"Item '{id}' was not found."));
        return NoContent();
    }
}
