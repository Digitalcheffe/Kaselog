using KaseLog.Api.Models;

namespace KaseLog.Api.Data;

public interface IKaseRepository
{
    Task<IEnumerable<KaseResponse>> GetAllAsync();
    Task<KaseResponse?> GetByIdAsync(Guid id);
    Task<KaseResponse> CreateAsync(string title, string? description);
    Task<KaseResponse?> UpdateAsync(Guid id, string title, string? description);
    Task<bool> DeleteAsync(Guid id);
}
