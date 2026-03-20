using System.Text;
using System.Text.Json;
using Dapper;
using KaseLog.Api.Models;
using KaseLog.Api.Models.Requests;

namespace KaseLog.Api.Data.Sqlite;

public sealed class SqliteCollectionRepository : ICollectionRepository
{
    private readonly IDbConnectionFactory _db;

    private static readonly HashSet<string> ValidColors =
        ["teal", "blue", "purple", "coral", "amber"];

    private static readonly HashSet<string> ValidFieldTypes =
        ["text", "multiline", "number", "date", "select", "rating", "url", "boolean", "image"];

    public SqliteCollectionRepository(IDbConnectionFactory db) => _db = db;

    // ── Collections ───────────────────────────────────────────────────────────

    public async Task<IEnumerable<CollectionResponse>> GetAllAsync()
    {
        using var conn = await _db.OpenAsync();
        var rows = await conn.QueryAsync<CollectionRow>("""
            SELECT Id, Title, Color, CreatedAt, UpdatedAt
            FROM Collections
            ORDER BY UpdatedAt DESC
            """);
        return rows.Select(MapCollection);
    }

    public async Task<CollectionResponse?> GetByIdAsync(Guid id)
    {
        using var conn = await _db.OpenAsync();
        var row = await conn.QuerySingleOrDefaultAsync<CollectionRow>("""
            SELECT Id, Title, Color, CreatedAt, UpdatedAt
            FROM Collections WHERE Id = @Id
            """, new { Id = id.ToString() });
        return row is null ? null : MapCollection(row);
    }

    public async Task<CollectionResponse> CreateAsync(CreateCollectionRequest request)
    {
        var color = NormalizeColor(request.Color);
        var id  = Guid.NewGuid();
        var now = DateTime.UtcNow;
        var nowStr = now.ToString("O");

        using var conn = await _db.OpenAsync();
        await conn.ExecuteAsync("""
            INSERT INTO Collections(Id, Title, Color, CreatedAt, UpdatedAt)
            VALUES (@Id, @Title, @Color, @Now, @Now)
            """,
            new { Id = id.ToString(), request.Title, Color = color, Now = nowStr });

        return new CollectionResponse
        {
            Id        = id,
            Title     = request.Title,
            Color     = color,
            CreatedAt = now,
            UpdatedAt = now,
        };
    }

    public async Task<CollectionResponse?> UpdateAsync(Guid id, UpdateCollectionRequest request)
    {
        var color  = NormalizeColor(request.Color);
        var nowStr = DateTime.UtcNow.ToString("O");

        using var conn = await _db.OpenAsync();
        var affected = await conn.ExecuteAsync("""
            UPDATE Collections SET Title = @Title, Color = @Color, UpdatedAt = @Now
            WHERE Id = @Id
            """,
            new { Id = id.ToString(), request.Title, Color = color, Now = nowStr });

        if (affected == 0) return null;
        return await GetByIdAsync(id);
    }

    public async Task<bool> DeleteAsync(Guid id)
    {
        using var conn = await _db.OpenAsync();
        var affected = await conn.ExecuteAsync(
            "DELETE FROM Collections WHERE Id = @Id",
            new { Id = id.ToString() });
        return affected > 0;
    }

    // ── Fields ────────────────────────────────────────────────────────────────

    public async Task<IEnumerable<CollectionFieldResponse>> GetFieldsAsync(Guid collectionId)
    {
        using var conn = await _db.OpenAsync();
        var rows = await conn.QueryAsync<FieldRow>("""
            SELECT Id, CollectionId, Name, Type, Required, ShowInList, Options, SortOrder
            FROM CollectionFields
            WHERE CollectionId = @CollectionId
            ORDER BY SortOrder
            """, new { CollectionId = collectionId.ToString() });
        return rows.Select(MapField);
    }

    public async Task<CollectionFieldResponse> AddFieldAsync(Guid collectionId, CreateCollectionFieldRequest request)
    {
        var type = NormalizeFieldType(request.Type);
        var id   = Guid.NewGuid();

        using var conn = await _db.OpenAsync();
        await conn.ExecuteAsync("""
            INSERT INTO CollectionFields(Id, CollectionId, Name, Type, Required, ShowInList, Options, SortOrder)
            VALUES (@Id, @CollectionId, @Name, @Type, @Required, @ShowInList, @Options, @SortOrder)
            """,
            new
            {
                Id           = id.ToString(),
                CollectionId = collectionId.ToString(),
                request.Name,
                Type         = type,
                Required     = request.Required ? 1 : 0,
                ShowInList   = request.ShowInList ? 1 : 0,
                Options      = request.Options is null ? null : JsonSerializer.Serialize(request.Options),
                request.SortOrder,
            });

        return new CollectionFieldResponse
        {
            Id           = id,
            CollectionId = collectionId,
            Name         = request.Name,
            Type         = type,
            Required     = request.Required,
            ShowInList   = request.ShowInList,
            Options      = request.Options,
            SortOrder    = request.SortOrder,
        };
    }

    public async Task<CollectionFieldResponse?> UpdateFieldAsync(
        Guid collectionId, Guid fieldId, UpdateCollectionFieldRequest request)
    {
        var type = NormalizeFieldType(request.Type);

        using var conn = await _db.OpenAsync();
        var affected = await conn.ExecuteAsync("""
            UPDATE CollectionFields
            SET Name = @Name, Type = @Type, Required = @Required,
                ShowInList = @ShowInList, Options = @Options
            WHERE Id = @Id AND CollectionId = @CollectionId
            """,
            new
            {
                Id           = fieldId.ToString(),
                CollectionId = collectionId.ToString(),
                request.Name,
                Type         = type,
                Required     = request.Required ? 1 : 0,
                ShowInList   = request.ShowInList ? 1 : 0,
                Options      = request.Options is null ? null : JsonSerializer.Serialize(request.Options),
            });

        if (affected == 0) return null;

        var row = await conn.QuerySingleOrDefaultAsync<FieldRow>("""
            SELECT Id, CollectionId, Name, Type, Required, ShowInList, Options, SortOrder
            FROM CollectionFields WHERE Id = @Id
            """, new { Id = fieldId.ToString() });

        return row is null ? null : MapField(row);
    }

    public async Task<bool> DeleteFieldAsync(Guid collectionId, Guid fieldId)
    {
        using var conn = await _db.OpenAsync();
        var affected = await conn.ExecuteAsync(
            "DELETE FROM CollectionFields WHERE Id = @Id AND CollectionId = @CollectionId",
            new { Id = fieldId.ToString(), CollectionId = collectionId.ToString() });
        return affected > 0;
    }

    public async Task<bool> ReorderFieldsAsync(Guid collectionId, IReadOnlyList<Guid> fieldIds)
    {
        using var conn = await _db.OpenAsync();

        // Verify collection exists
        var exists = await conn.ExecuteScalarAsync<long>(
            "SELECT count(*) FROM Collections WHERE Id = @Id",
            new { Id = collectionId.ToString() });
        if (exists == 0) return false;

        using var tx = conn.BeginTransaction();
        for (var i = 0; i < fieldIds.Count; i++)
        {
            await conn.ExecuteAsync(
                "UPDATE CollectionFields SET SortOrder = @Sort WHERE Id = @Id AND CollectionId = @CollectionId",
                new { Sort = i, Id = fieldIds[i].ToString(), CollectionId = collectionId.ToString() },
                tx);
        }
        tx.Commit();
        return true;
    }

    // ── Layout ────────────────────────────────────────────────────────────────

    public async Task<CollectionLayoutResponse?> GetLayoutAsync(Guid collectionId)
    {
        using var conn = await _db.OpenAsync();
        var layout = await conn.ExecuteScalarAsync<string?>(
            "SELECT Layout FROM CollectionLayout WHERE CollectionId = @CollectionId",
            new { CollectionId = collectionId.ToString() });
        if (layout is null) return null;

        return new CollectionLayoutResponse
        {
            CollectionId = collectionId,
            Layout       = layout,
        };
    }

    public async Task<CollectionLayoutResponse> UpsertLayoutAsync(Guid collectionId, string layout)
    {
        using var conn = await _db.OpenAsync();

        // Use INSERT OR REPLACE (same effect as ON CONFLICT upsert here since
        // we always supply all columns; the trigger fires correctly).
        await conn.ExecuteAsync("""
            INSERT INTO CollectionLayout(Id, CollectionId, Layout)
            VALUES (@Id, @CollectionId, @Layout)
            ON CONFLICT(CollectionId) DO UPDATE SET Layout = excluded.Layout
            """,
            new
            {
                Id           = Guid.NewGuid().ToString(),
                CollectionId = collectionId.ToString(),
                Layout       = layout,
            });

        return new CollectionLayoutResponse
        {
            CollectionId = collectionId,
            Layout       = layout,
        };
    }

    // ── Items ─────────────────────────────────────────────────────────────────

    public async Task<IEnumerable<CollectionItemResponse>> GetItemsAsync(
        Guid collectionId,
        string? q,
        Guid? kaseId,
        IReadOnlyDictionary<string, string> fieldFilters,
        string? sortFieldId,
        bool sortAsc,
        int page,
        int pageSize)
    {
        using var conn = await _db.OpenAsync();

        var sql = new StringBuilder("""
            SELECT Id, CollectionId, KaseId, FieldValues, CreatedAt, UpdatedAt
            FROM CollectionItems
            WHERE CollectionId = @CollectionId
            """);
        var p = new DynamicParameters();
        p.Add("CollectionId", collectionId.ToString());

        if (!string.IsNullOrWhiteSpace(q))
        {
            sql.AppendLine(" AND FieldValues LIKE @q");
            p.Add("q", $"%{q}%");
        }

        if (kaseId.HasValue)
        {
            sql.AppendLine(" AND KaseId = @KaseId");
            p.Add("KaseId", kaseId.Value.ToString());
        }

        foreach (var (fieldId, value) in fieldFilters)
        {
            // Validate fieldId is a GUID to prevent injection
            if (!Guid.TryParse(fieldId, out _)) continue;
            var paramName = $"fv_{fieldId.Replace("-", "")}";
            sql.AppendLine($" AND json_extract(FieldValues, '$.{fieldId}') = @{paramName}");
            p.Add(paramName, value);
        }

        if (!string.IsNullOrWhiteSpace(sortFieldId) && Guid.TryParse(sortFieldId, out _))
        {
            var dir = sortAsc ? "ASC" : "DESC";
            sql.AppendLine($" ORDER BY CAST(json_extract(FieldValues, '$.{sortFieldId}') AS TEXT) {dir}");
        }
        else
        {
            sql.AppendLine(" ORDER BY CreatedAt DESC");
        }

        sql.AppendLine(" LIMIT @PageSize OFFSET @Offset");
        p.Add("PageSize", pageSize);
        p.Add("Offset", (page - 1) * pageSize);

        var rows = await conn.QueryAsync<ItemRow>(sql.ToString(), p);
        return rows.Select(MapItem);
    }

    public async Task<CollectionItemResponse?> GetItemAsync(Guid id)
    {
        using var conn = await _db.OpenAsync();
        var row = await conn.QuerySingleOrDefaultAsync<ItemRow>("""
            SELECT Id, CollectionId, KaseId, FieldValues, CreatedAt, UpdatedAt
            FROM CollectionItems WHERE Id = @Id
            """, new { Id = id.ToString() });
        return row is null ? null : MapItem(row);
    }

    public async Task<CollectionItemResponse> CreateItemAsync(
        Guid collectionId, CreateCollectionItemRequest request)
    {
        using var conn = await _db.OpenAsync();

        // Validate required fields
        await ValidateItemFieldsAsync(conn, collectionId, request.FieldValues);

        var id     = Guid.NewGuid();
        var now    = DateTime.UtcNow;
        var nowStr = now.ToString("O");
        var fieldValuesJson = JsonSerializer.Serialize(request.FieldValues);

        await conn.ExecuteAsync("""
            INSERT INTO CollectionItems(Id, CollectionId, KaseId, FieldValues, CreatedAt, UpdatedAt)
            VALUES (@Id, @CollectionId, @KaseId, @FieldValues, @Now, @Now)
            """,
            new
            {
                Id           = id.ToString(),
                CollectionId = collectionId.ToString(),
                KaseId       = request.KaseId?.ToString(),
                FieldValues  = fieldValuesJson,
                Now          = nowStr,
            });

        return new CollectionItemResponse
        {
            Id           = id,
            CollectionId = collectionId,
            KaseId       = request.KaseId,
            FieldValues  = JsonDocument.Parse(fieldValuesJson).RootElement.Clone(),
            CreatedAt    = now,
            UpdatedAt    = now,
        };
    }

    public async Task<CollectionItemResponse?> UpdateItemAsync(
        Guid id, UpdateCollectionItemRequest request)
    {
        using var conn = await _db.OpenAsync();

        // Find the item's collection
        var collectionIdStr = await conn.ExecuteScalarAsync<string?>(
            "SELECT CollectionId FROM CollectionItems WHERE Id = @Id",
            new { Id = id.ToString() });
        if (collectionIdStr is null) return null;

        var collectionId = Guid.Parse(collectionIdStr);

        // Validate required fields
        await ValidateItemFieldsAsync(conn, collectionId, request.FieldValues);

        var nowStr          = DateTime.UtcNow.ToString("O");
        var fieldValuesJson = JsonSerializer.Serialize(request.FieldValues);

        var affected = await conn.ExecuteAsync("""
            UPDATE CollectionItems
            SET KaseId = @KaseId, FieldValues = @FieldValues, UpdatedAt = @Now
            WHERE Id = @Id
            """,
            new
            {
                Id          = id.ToString(),
                KaseId      = request.KaseId?.ToString(),
                FieldValues = fieldValuesJson,
                Now         = nowStr,
            });

        if (affected == 0) return null;
        return await GetItemAsync(id);
    }

    public async Task<bool> DeleteItemAsync(Guid id)
    {
        using var conn = await _db.OpenAsync();
        var affected = await conn.ExecuteAsync(
            "DELETE FROM CollectionItems WHERE Id = @Id",
            new { Id = id.ToString() });
        return affected > 0;
    }

    // ── Validation helpers ────────────────────────────────────────────────────

    private static async Task ValidateItemFieldsAsync(
        System.Data.IDbConnection conn,
        Guid collectionId,
        Dictionary<string, JsonElement> fieldValues)
    {
        var requiredFields = await conn.QueryAsync<(string Id, string Name)>("""
            SELECT Id, Name FROM CollectionFields
            WHERE CollectionId = @CollectionId AND Required = 1
            """, new { CollectionId = collectionId.ToString() });

        var errors = new Dictionary<string, string[]>();
        foreach (var (fieldId, fieldName) in requiredFields)
        {
            var missing = !fieldValues.TryGetValue(fieldId, out var element);
            var blank   = !missing && IsBlankElement(element);
            if (missing || blank)
                errors[fieldId] = [$"'{fieldName}' is required."];
        }

        if (errors.Count > 0)
            throw new CollectionItemValidationException(errors);
    }

    private static bool IsBlankElement(JsonElement element)
        => element.ValueKind switch
        {
            JsonValueKind.Null      => true,
            JsonValueKind.Undefined => true,
            JsonValueKind.String    => string.IsNullOrWhiteSpace(element.GetString()),
            _                       => false,
        };

    // ── Mapping ───────────────────────────────────────────────────────────────

    private static CollectionResponse MapCollection(CollectionRow r) => new()
    {
        Id        = Guid.Parse(r.Id),
        Title     = r.Title,
        Color     = r.Color,
        CreatedAt = DateTime.Parse(r.CreatedAt, null, System.Globalization.DateTimeStyles.RoundtripKind),
        UpdatedAt = DateTime.Parse(r.UpdatedAt, null, System.Globalization.DateTimeStyles.RoundtripKind),
    };

    private static CollectionFieldResponse MapField(FieldRow r) => new()
    {
        Id           = Guid.Parse(r.Id),
        CollectionId = Guid.Parse(r.CollectionId),
        Name         = r.Name,
        Type         = r.Type,
        Required     = r.Required != 0,
        ShowInList   = r.ShowInList != 0,
        Options      = r.Options is null ? null : JsonSerializer.Deserialize<string[]>(r.Options),
        SortOrder    = r.SortOrder,
    };

    private static CollectionItemResponse MapItem(ItemRow r) => new()
    {
        Id           = Guid.Parse(r.Id),
        CollectionId = Guid.Parse(r.CollectionId),
        KaseId       = r.KaseId is null ? null : Guid.Parse(r.KaseId),
        FieldValues  = JsonDocument.Parse(r.FieldValues).RootElement.Clone(),
        CreatedAt    = DateTime.Parse(r.CreatedAt, null, System.Globalization.DateTimeStyles.RoundtripKind),
        UpdatedAt    = DateTime.Parse(r.UpdatedAt, null, System.Globalization.DateTimeStyles.RoundtripKind),
    };

    private static string NormalizeColor(string color)
    {
        var lower = color.Trim().ToLowerInvariant();
        return ValidColors.Contains(lower) ? lower : "teal";
    }

    private static string NormalizeFieldType(string type)
    {
        var lower = type.Trim().ToLowerInvariant();
        return ValidFieldTypes.Contains(lower) ? lower : type.ToLowerInvariant();
    }

    // ── Row types ─────────────────────────────────────────────────────────────

    private sealed class CollectionRow
    {
        public string Id        { get; set; } = string.Empty;
        public string Title     { get; set; } = string.Empty;
        public string Color     { get; set; } = "teal";
        public string CreatedAt { get; set; } = string.Empty;
        public string UpdatedAt { get; set; } = string.Empty;
    }

    private sealed class FieldRow
    {
        public string  Id           { get; set; } = string.Empty;
        public string  CollectionId { get; set; } = string.Empty;
        public string  Name         { get; set; } = string.Empty;
        public string  Type         { get; set; } = string.Empty;
        public int     Required     { get; set; }
        public int     ShowInList   { get; set; }
        public string? Options      { get; set; }
        public int     SortOrder    { get; set; }
    }

    private sealed class ItemRow
    {
        public string  Id           { get; set; } = string.Empty;
        public string  CollectionId { get; set; } = string.Empty;
        public string? KaseId       { get; set; }
        public string  FieldValues  { get; set; } = "{}";
        public string  CreatedAt    { get; set; } = string.Empty;
        public string  UpdatedAt    { get; set; } = string.Empty;
    }
}
