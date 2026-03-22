using KaseLog.Api.Models;

namespace KaseLog.Api.Data;

public interface IKaseRepository
{
    Task<IEnumerable<KaseResponse>> GetAllAsync();
    Task<KaseResponse?> GetByIdAsync(Guid id);
    Task<KaseResponse> CreateAsync(string title, string? description);
    Task<KaseResponse?> UpdateAsync(Guid id, string title, string? description, bool? isPinned = null);
    Task<bool> DeleteAsync(Guid id);
    Task<KaseResponse?> SetPinnedAsync(Guid id, bool pinned);

    /// <summary>
    /// Returns logs and linked collection items for a Kase in reverse-chronological order.
    /// </summary>
    Task<IEnumerable<TimelineEntryResponse>> GetTimelineAsync(Guid kaseId, int page, int pageSize);
}
