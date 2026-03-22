using KaseLog.Api.Models;

namespace KaseLog.Api.Data;

public interface ISearchRepository
{
    Task<IEnumerable<SearchResultDto>> SearchAsync(
        string? q,
        string? kaseId,
        string? collectionId,
        string? type,
        IReadOnlyList<string> tags,
        DateTime? from,
        DateTime? to);
}
