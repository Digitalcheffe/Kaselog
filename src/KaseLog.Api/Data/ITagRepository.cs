using KaseLog.Api.Models;

namespace KaseLog.Api.Data;

public interface ITagRepository
{
    Task<IEnumerable<TagDto>> GetAllAsync();
    Task<TagDto?> AddToLogAsync(Guid logId, string tagName);
    Task<bool> RemoveFromLogAsync(Guid logId, Guid tagId);
}
