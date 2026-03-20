using KaseLog.Api.Data;
using KaseLog.Api.Models;
using KaseLog.Api.Models.Requests;
using Microsoft.AspNetCore.Mvc;

namespace KaseLog.Api.Controllers;

/// <summary>Collections CRUD, fields, layout, and items list.</summary>
[ApiController]
[Produces("application/json")]
public sealed class CollectionsController : ControllerBase
{
    private static readonly HashSet<string> ValidColors =
        ["teal", "blue", "purple", "coral", "amber"];

    private static readonly HashSet<string> ValidFieldTypes =
        ["text", "multiline", "number", "date", "select", "rating", "url", "boolean", "image"];

    private readonly ICollectionRepository _collections;

    public CollectionsController(ICollectionRepository collections) => _collections = collections;

    // ── Collections ───────────────────────────────────────────────────────────

    /// <summary>Returns all Collections ordered by most-recently updated.</summary>
    [HttpGet("api/collections")]
    [ProducesResponseType(typeof(ApiResponse<IEnumerable<CollectionResponse>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAll()
    {
        var items = await _collections.GetAllAsync();
        return Ok(ApiResponse<IEnumerable<CollectionResponse>>.Success(items));
    }

    /// <summary>Creates a new Collection.</summary>
    [HttpPost("api/collections")]
    [ProducesResponseType(typeof(ApiResponse<CollectionResponse>), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Create([FromBody] CreateCollectionRequest request)
    {
        if (!ValidColors.Contains(request.Color.Trim().ToLowerInvariant()))
            return BadRequest(ApiResponse<CollectionResponse>.Failure(
                "https://tools.ietf.org/html/rfc7807",
                "Validation failed", 400,
                $"Color must be one of: {string.Join(", ", ValidColors)}."));

        var collection = await _collections.CreateAsync(request);
        return CreatedAtAction(nameof(GetById), new { id = collection.Id },
            ApiResponse<CollectionResponse>.Success(collection));
    }

    /// <summary>Returns a Collection by ID.</summary>
    [HttpGet("api/collections/{id:guid}")]
    [ProducesResponseType(typeof(ApiResponse<CollectionResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetById(Guid id)
    {
        var collection = await _collections.GetByIdAsync(id);
        if (collection is null)
            return NotFound(ApiResponse<CollectionResponse>.NotFound($"Collection '{id}' was not found."));
        return Ok(ApiResponse<CollectionResponse>.Success(collection));
    }

    /// <summary>Updates a Collection's title and color.</summary>
    [HttpPut("api/collections/{id:guid}")]
    [ProducesResponseType(typeof(ApiResponse<CollectionResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateCollectionRequest request)
    {
        if (!ValidColors.Contains(request.Color.Trim().ToLowerInvariant()))
            return BadRequest(ApiResponse<CollectionResponse>.Failure(
                "https://tools.ietf.org/html/rfc7807",
                "Validation failed", 400,
                $"Color must be one of: {string.Join(", ", ValidColors)}."));

        var collection = await _collections.UpdateAsync(id, request);
        if (collection is null)
            return NotFound(ApiResponse<CollectionResponse>.NotFound($"Collection '{id}' was not found."));
        return Ok(ApiResponse<CollectionResponse>.Success(collection));
    }

    /// <summary>Deletes a Collection and all its fields, layout, and items.</summary>
    [HttpDelete("api/collections/{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(Guid id)
    {
        var deleted = await _collections.DeleteAsync(id);
        if (!deleted)
            return NotFound(ApiResponse<CollectionResponse>.NotFound($"Collection '{id}' was not found."));
        return NoContent();
    }

    // ── Fields ────────────────────────────────────────────────────────────────

    /// <summary>Returns all fields for a Collection ordered by SortOrder.</summary>
    [HttpGet("api/collections/{id:guid}/fields")]
    [ProducesResponseType(typeof(ApiResponse<IEnumerable<CollectionFieldResponse>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetFields(Guid id)
    {
        var fields = await _collections.GetFieldsAsync(id);
        return Ok(ApiResponse<IEnumerable<CollectionFieldResponse>>.Success(fields));
    }

    /// <summary>Adds a field to a Collection schema.</summary>
    [HttpPost("api/collections/{id:guid}/fields")]
    [ProducesResponseType(typeof(ApiResponse<CollectionFieldResponse>), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> AddField(Guid id, [FromBody] CreateCollectionFieldRequest request)
    {
        if (!ValidFieldTypes.Contains(request.Type.Trim().ToLowerInvariant()))
            return BadRequest(ApiResponse<CollectionFieldResponse>.Failure(
                "https://tools.ietf.org/html/rfc7807",
                "Validation failed", 400,
                $"Type must be one of: {string.Join(", ", ValidFieldTypes)}."));

        var field = await _collections.AddFieldAsync(id, request);
        return CreatedAtAction(nameof(GetFields), new { id },
            ApiResponse<CollectionFieldResponse>.Success(field));
    }

    /// <summary>Updates a field definition.</summary>
    [HttpPut("api/collections/{id:guid}/fields/{fieldId:guid}")]
    [ProducesResponseType(typeof(ApiResponse<CollectionFieldResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateField(Guid id, Guid fieldId,
        [FromBody] UpdateCollectionFieldRequest request)
    {
        if (!ValidFieldTypes.Contains(request.Type.Trim().ToLowerInvariant()))
            return BadRequest(ApiResponse<CollectionFieldResponse>.Failure(
                "https://tools.ietf.org/html/rfc7807",
                "Validation failed", 400,
                $"Type must be one of: {string.Join(", ", ValidFieldTypes)}."));

        var field = await _collections.UpdateFieldAsync(id, fieldId, request);
        if (field is null)
            return NotFound(ApiResponse<CollectionFieldResponse>.NotFound(
                $"Field '{fieldId}' not found in collection '{id}'."));
        return Ok(ApiResponse<CollectionFieldResponse>.Success(field));
    }

    /// <summary>Deletes a field from a Collection schema.</summary>
    [HttpDelete("api/collections/{id:guid}/fields/{fieldId:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteField(Guid id, Guid fieldId)
    {
        var deleted = await _collections.DeleteFieldAsync(id, fieldId);
        if (!deleted)
            return NotFound(ApiResponse<CollectionFieldResponse>.NotFound(
                $"Field '{fieldId}' not found in collection '{id}'."));
        return NoContent();
    }

    /// <summary>Reorders all fields for a Collection in a single transaction.</summary>
    [HttpPut("api/collections/{id:guid}/fields/reorder")]
    [ProducesResponseType(typeof(ApiResponse<IEnumerable<CollectionFieldResponse>>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> ReorderFields(Guid id, [FromBody] ReorderFieldsRequest request)
    {
        var ok = await _collections.ReorderFieldsAsync(id, request.FieldIds);
        if (!ok)
            return NotFound(ApiResponse<CollectionFieldResponse>.NotFound($"Collection '{id}' was not found."));

        var fields = await _collections.GetFieldsAsync(id);
        return Ok(ApiResponse<IEnumerable<CollectionFieldResponse>>.Success(fields));
    }

    // ── Layout ────────────────────────────────────────────────────────────────

    /// <summary>Returns the layout JSON for a Collection.</summary>
    [HttpGet("api/collections/{id:guid}/layout")]
    [ProducesResponseType(typeof(ApiResponse<CollectionLayoutResponse>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetLayout(Guid id)
    {
        var layout = await _collections.GetLayoutAsync(id) ?? new CollectionLayoutResponse
        {
            CollectionId = id,
            Layout       = "[]",
        };
        return Ok(ApiResponse<CollectionLayoutResponse>.Success(layout));
    }

    /// <summary>Replaces the layout for a Collection atomically.</summary>
    [HttpPut("api/collections/{id:guid}/layout")]
    [ProducesResponseType(typeof(ApiResponse<CollectionLayoutResponse>), StatusCodes.Status200OK)]
    public async Task<IActionResult> UpsertLayout(Guid id, [FromBody] UpdateCollectionLayoutRequest request)
    {
        var layout = await _collections.UpsertLayoutAsync(id, request.Layout);
        return Ok(ApiResponse<CollectionLayoutResponse>.Success(layout));
    }

    // ── Items ─────────────────────────────────────────────────────────────────

    /// <summary>Returns items in a Collection with optional filtering, sorting, and pagination.</summary>
    [HttpGet("api/collections/{id:guid}/items")]
    [ProducesResponseType(typeof(ApiResponse<IEnumerable<CollectionItemResponse>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetItems(
        Guid id,
        [FromQuery] string? q,
        [FromQuery] Guid? kaseId,
        [FromQuery(Name = "field")] Dictionary<string, string>? field,
        [FromQuery] string? sort,
        [FromQuery] string? dir,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50)
    {
        var items = await _collections.GetItemsAsync(
            id,
            q,
            kaseId,
            (IReadOnlyDictionary<string, string>?)field ?? new Dictionary<string, string>(),
            sort,
            !string.Equals(dir, "desc", StringComparison.OrdinalIgnoreCase),
            Math.Max(1, page),
            Math.Clamp(pageSize, 1, 200));

        return Ok(ApiResponse<IEnumerable<CollectionItemResponse>>.Success(items));
    }

    /// <summary>Creates a new Collection item, validating required fields.</summary>
    [HttpPost("api/collections/{id:guid}/items")]
    [ProducesResponseType(typeof(ApiResponse<CollectionItemResponse>), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> CreateItem(Guid id, [FromBody] CreateCollectionItemRequest request)
    {
        // Ensure collection exists
        var collection = await _collections.GetByIdAsync(id);
        if (collection is null)
            return NotFound(ApiResponse<CollectionItemResponse>.NotFound($"Collection '{id}' was not found."));

        try
        {
            var item = await _collections.CreateItemAsync(id, request);
            return CreatedAtAction(nameof(CollectionItemsController.GetItem),
                "CollectionItems", new { id = item.Id },
                ApiResponse<CollectionItemResponse>.Success(item));
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
}
