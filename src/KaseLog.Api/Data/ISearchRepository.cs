using KaseLog.Api.Models;

namespace KaseLog.Api.Data;

public interface ISearchRepository
{
    Task<IEnumerable<SearchResultDto>> SearchAsync(
        string? q,
        string? kaseId,
        IReadOnlyList<string> tags,
        DateTime? from,
        DateTime? to);
}
