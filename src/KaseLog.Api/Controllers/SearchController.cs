using KaseLog.Api.Data;
using KaseLog.Api.Models;
using Microsoft.AspNetCore.Mvc;

namespace KaseLog.Api.Controllers;

/// <summary>Full-text and filtered search across all Logs.</summary>
[ApiController]
[Route("api/search")]
[Produces("application/json")]
public sealed class SearchController : ControllerBase
{
    private readonly ISearchRepository _search;

    /// <summary>Initialises a new instance of <see cref="SearchController"/>.</summary>
    public SearchController(ISearchRepository search) => _search = search;

    /// <summary>Search logs and collection items by query and/or composable filters.</summary>
    /// <param name="q">Full-text query string.</param>
    /// <param name="kaseId">Filter to a specific Kase by ID.</param>
    /// <param name="collectionId">Filter to a specific Collection by ID.</param>
    /// <param name="type">Restrict to entity type: 'log' or 'collection_item'.</param>
    /// <param name="tag">One or more tag names (AND logic, logs only).</param>
    /// <param name="from">Include only results updated on or after this date (ISO 8601).</param>
    /// <param name="to">Include only results updated on or before this date (ISO 8601).</param>
    /// <returns>Matching results ordered by relevance or recency.</returns>
    [HttpGet]
    [ProducesResponseType(typeof(ApiResponse<IEnumerable<SearchResultDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> Search(
        [FromQuery] string? q,
        [FromQuery] string? kaseId,
        [FromQuery] string? collectionId,
        [FromQuery] string? type,
        [FromQuery(Name = "tag")] string[] tag,
        [FromQuery] string? from,
        [FromQuery] string? to)
    {
        DateTime? fromDate = null;
        DateTime? toDate = null;

        if (!string.IsNullOrWhiteSpace(from))
        {
            if (!DateTime.TryParse(from, out var fd))
                return BadRequest(ApiResponse<IEnumerable<SearchResultDto>>.Failure(
                    "https://tools.ietf.org/html/rfc7807",
                    "Invalid parameter",
                    400,
                    "The 'from' parameter is not a valid date."));
            fromDate = fd;
        }

        if (!string.IsNullOrWhiteSpace(to))
        {
            if (!DateTime.TryParse(to, out var td))
                return BadRequest(ApiResponse<IEnumerable<SearchResultDto>>.Failure(
                    "https://tools.ietf.org/html/rfc7807",
                    "Invalid parameter",
                    400,
                    "The 'to' parameter is not a valid date."));
            toDate = td;
        }

        var results = await _search.SearchAsync(q, kaseId, collectionId, type, tag, fromDate, toDate);
        return Ok(ApiResponse<IEnumerable<SearchResultDto>>.Success(results));
    }
}
