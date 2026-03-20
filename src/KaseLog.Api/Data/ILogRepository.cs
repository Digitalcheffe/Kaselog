using KaseLog.Api.Models;

namespace KaseLog.Api.Data;

public interface ILogRepository
{
    Task<IEnumerable<LogResponse>> GetByKaseIdAsync(Guid kaseId);
    Task<LogResponse?> GetByIdAsync(Guid id);
    Task<LogResponse?> CreateAsync(Guid kaseId, string title, string? description, bool autosaveEnabled);
    Task<LogResponse?> UpdateAsync(Guid id, string title, string? description, bool autosaveEnabled);
    Task<bool> DeleteAsync(Guid id);
    Task<IEnumerable<LogVersionResponse>> GetVersionsAsync(Guid logId);
    Task<LogVersionResponse?> GetVersionByIdAsync(Guid logId, Guid versionId);
    Task<LogVersionResponse?> AddVersionAsync(Guid logId, string content, string? label, bool isAutosave);
    Task<LogVersionResponse?> RestoreVersionAsync(Guid logId, Guid versionId);
}
