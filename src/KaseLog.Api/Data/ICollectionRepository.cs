using KaseLog.Api.Models;
using KaseLog.Api.Models.Requests;

namespace KaseLog.Api.Data;

public interface ICollectionRepository
{
    // ── Collections ───────────────────────────────────────────────────────────
    Task<IEnumerable<CollectionResponse>> GetAllAsync();
    Task<CollectionResponse?> GetByIdAsync(Guid id);
    Task<CollectionResponse> CreateAsync(CreateCollectionRequest request);
    Task<CollectionResponse?> UpdateAsync(Guid id, UpdateCollectionRequest request);
    Task<bool> DeleteAsync(Guid id);

    // ── Fields ────────────────────────────────────────────────────────────────
    Task<IEnumerable<CollectionFieldResponse>> GetFieldsAsync(Guid collectionId);
    Task<CollectionFieldResponse> AddFieldAsync(Guid collectionId, CreateCollectionFieldRequest request);
    Task<CollectionFieldResponse?> UpdateFieldAsync(Guid collectionId, Guid fieldId, UpdateCollectionFieldRequest request);
    Task<bool> DeleteFieldAsync(Guid collectionId, Guid fieldId);

    /// <summary>
    /// Updates SortOrder for all fields in collectionId in a single transaction.
    /// fieldIds must list all field IDs for the collection in the desired order.
    /// Returns false if the collection does not exist.
    /// </summary>
    Task<bool> ReorderFieldsAsync(Guid collectionId, IReadOnlyList<Guid> fieldIds);

    // ── Layout ────────────────────────────────────────────────────────────────
    Task<CollectionLayoutResponse?> GetLayoutAsync(Guid collectionId);
    Task<CollectionLayoutResponse> UpsertLayoutAsync(Guid collectionId, string layout);

    // ── Items ─────────────────────────────────────────────────────────────────
    Task<IEnumerable<CollectionItemResponse>> GetItemsAsync(
        Guid collectionId,
        string? q,
        Guid? kaseId,
        IReadOnlyDictionary<string, string> fieldFilters,
        string? sortFieldId,
        bool sortAsc,
        int page,
        int pageSize);

    Task<CollectionItemResponse?> GetItemAsync(Guid id);

    /// <summary>
    /// Creates a collection item. Throws <see cref="CollectionItemValidationException"/>
    /// if required fields are missing or empty.
    /// </summary>
    Task<CollectionItemResponse> CreateItemAsync(Guid collectionId, CreateCollectionItemRequest request);

    /// <summary>
    /// Updates a collection item. Throws <see cref="CollectionItemValidationException"/>
    /// if required fields are missing or empty.
    /// </summary>
    Task<CollectionItemResponse?> UpdateItemAsync(Guid id, UpdateCollectionItemRequest request);

    Task<bool> DeleteItemAsync(Guid id);

    // ── Item History ──────────────────────────────────────────────────────────

    /// <summary>
    /// Returns history records for an item in newest-first order.
    /// Returns <c>null</c> if no item with <paramref name="itemId"/> exists.
    /// Returns an empty list if the item exists but has no history.
    /// </summary>
    Task<IEnumerable<CollectionItemHistoryResponse>?> GetItemHistoryAsync(Guid itemId);
}
