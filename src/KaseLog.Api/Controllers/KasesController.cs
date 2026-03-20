using KaseLog.Api.Data;
using KaseLog.Api.Models;
using KaseLog.Api.Models.Requests;
using Microsoft.AspNetCore.Mvc;

namespace KaseLog.Api.Controllers;

[ApiController]
[Route("api/kases")]
public sealed class KasesController : ControllerBase
{
    private readonly IKaseRepository _kases;

    public KasesController(IKaseRepository kases) => _kases = kases;

    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var kases = await _kases.GetAllAsync();
        return Ok(ApiResponse<IEnumerable<KaseResponse>>.Success(kases));
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateKaseRequest request)
    {
        var kase = await _kases.CreateAsync(request.Title, request.Description);
        return CreatedAtAction(nameof(GetById), new { id = kase.Id },
            ApiResponse<KaseResponse>.Success(kase));
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var kase = await _kases.GetByIdAsync(id);
        if (kase is null)
            return NotFound(ApiResponse<KaseResponse>.NotFound($"Kase with ID '{id}' was not found."));
        return Ok(ApiResponse<KaseResponse>.Success(kase));
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateKaseRequest request)
    {
        var kase = await _kases.UpdateAsync(id, request.Title, request.Description);
        if (kase is null)
            return NotFound(ApiResponse<KaseResponse>.NotFound($"Kase with ID '{id}' was not found."));
        return Ok(ApiResponse<KaseResponse>.Success(kase));
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var deleted = await _kases.DeleteAsync(id);
        if (!deleted)
            return NotFound(ApiResponse<KaseResponse>.NotFound($"Kase with ID '{id}' was not found."));
        return NoContent();
    }
}
