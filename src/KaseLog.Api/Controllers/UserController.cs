using KaseLog.Api.Data;
using KaseLog.Api.Models;
using KaseLog.Api.Models.Requests;
using Microsoft.AspNetCore.Mvc;

namespace KaseLog.Api.Controllers;

/// <summary>User profile — read and update the local user account.</summary>
[ApiController]
[Route("api/user")]
[Produces("application/json")]
public sealed class UserController : ControllerBase
{
    private readonly IUserRepository _users;

    /// <summary>Initialises a new instance of <see cref="UserController"/>.</summary>
    public UserController(IUserRepository users) => _users = users;

    /// <summary>Returns the current user profile.</summary>
    [HttpGet]
    [ProducesResponseType(typeof(ApiResponse<UserResponse>), StatusCodes.Status200OK)]
    public async Task<IActionResult> Get()
    {
        var user = await _users.GetAsync();
        return Ok(ApiResponse<UserResponse>.Success(user));
    }

    /// <summary>Creates or updates the user profile.</summary>
    /// <param name="request">Profile fields and appearance preferences.</param>
    [HttpPut]
    [ProducesResponseType(typeof(ApiResponse<UserResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<UserResponse>), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Update([FromBody] UpdateUserRequest request)
    {
        var user = await _users.UpsertAsync(request);
        return Ok(ApiResponse<UserResponse>.Success(user));
    }
}
