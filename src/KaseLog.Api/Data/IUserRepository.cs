using KaseLog.Api.Models;
using KaseLog.Api.Models.Requests;

namespace KaseLog.Api.Data;

public interface IUserRepository
{
    Task<UserResponse> GetAsync();
    Task<UserResponse> UpsertAsync(UpdateUserRequest request);
}
