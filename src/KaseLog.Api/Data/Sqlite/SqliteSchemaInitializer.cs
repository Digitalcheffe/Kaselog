using Dapper;

namespace KaseLog.Api.Data.Sqlite;

public sealed class SqliteSchemaInitializer : ISchemaInitializer
{
    // Tables the banner verifies after DDL runs.
    // Users is intentionally omitted — it is an implementation detail, not a
    // core data table listed in the spec.
    private static readonly string[] ExpectedTables =
    [
        "Kases",
        "Logs",
        "LogVersions",
        "Tags",
        "LogTags",
        "Collections",
        "CollectionFields",
        "CollectionLayout",
        "CollectionItems",
        "CollectionItemHistory",
        "kaselog_search",
    ];

    private readonly IDbConnectionFactory _factory;

    public SqliteSchemaInitializer(IDbConnectionFactory factory)
    {
        _factory = factory;
    }

    public async Task<SchemaInitResult> InitializeAsync()
    {
        using var connection = await _factory.OpenAsync();

        foreach (var sql in SchemaDdl)
        {
            await connection.ExecuteAsync(sql);
        }

        // Run migrations safely — each is try-catched individually since the column may already exist
        foreach (var sql in MigrationsDdl)
        {
            try { await connection.ExecuteAsync(sql); }
            catch { /* expected if column was already created by fresh-install DDL */ }
        }

        // Verify every expected table exists after DDL.
        var present = (await connection.QueryAsync<string>(
            "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'"))
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        var missing = ExpectedTables
            .Where(t => !present.Contains(t))
            .ToList();

        return new SchemaInitResult(ExpectedTables.Length - missing.Count, missing);
    }

    // Migration DDL applied after the main schema. Each statement is wrapped in
    // an individual try-catch so that columns added by a fresh-install CREATE TABLE
    // do not cause failures on existing databases where ALTER TABLE would duplicate them.
    private static readonly string[] MigrationsDdl =
    [
        "ALTER TABLE Users ADD COLUMN FontSize TEXT NOT NULL DEFAULT 'medium'",
        "ALTER TABLE Kases ADD COLUMN IsPinned INTEGER NOT NULL DEFAULT 0",
        "ALTER TABLE Logs ADD COLUMN IsPinned INTEGER NOT NULL DEFAULT 0",
    ];

    // Each entry is a single DDL statement executed independently so that
    // triggers (which contain internal semicolons) are unambiguous.
    private static readonly string[] SchemaDdl =
    [
        // ── Tables ──────────────────────────────────────────────────────────
        """
        CREATE TABLE IF NOT EXISTS Kases (
          Id          TEXT PRIMARY KEY,
          Title       TEXT NOT NULL,
          Description TEXT,
          IsPinned    INTEGER NOT NULL DEFAULT 0,
          CreatedAt   TEXT NOT NULL,
          UpdatedAt   TEXT NOT NULL
        )
        """,

        """
        CREATE TABLE IF NOT EXISTS Logs (
          Id              TEXT PRIMARY KEY,
          KaseId          TEXT NOT NULL REFERENCES Kases(Id) ON DELETE CASCADE,
          Title           TEXT NOT NULL,
          Description     TEXT,
          AutosaveEnabled INTEGER NOT NULL DEFAULT 1,
          IsPinned        INTEGER NOT NULL DEFAULT 0,
          CreatedAt       TEXT NOT NULL,
          UpdatedAt       TEXT NOT NULL
        )
        """,

        """
        CREATE TABLE IF NOT EXISTS LogVersions (
          Id         TEXT PRIMARY KEY,
          LogId      TEXT NOT NULL REFERENCES Logs(Id) ON DELETE CASCADE,
          Content    TEXT NOT NULL,
          Label      TEXT,
          IsAutosave INTEGER NOT NULL DEFAULT 1,
          CreatedAt  TEXT NOT NULL
        )
        """,

        """
        CREATE TABLE IF NOT EXISTS Tags (
          Id        TEXT PRIMARY KEY,
          Name      TEXT NOT NULL UNIQUE,
          CreatedAt TEXT NOT NULL
        )
        """,

        """
        CREATE TABLE IF NOT EXISTS LogTags (
          LogId TEXT NOT NULL REFERENCES Logs(Id) ON DELETE CASCADE,
          TagId TEXT NOT NULL REFERENCES Tags(Id) ON DELETE CASCADE,
          PRIMARY KEY (LogId, TagId)
        )
        """,

        // ── FTS5 virtual table ───────────────────────────────────────────────
        // entity_id  — Log.Id or CollectionItem.Id
        // entity_type — 'log' or 'collection_item'
        """
        CREATE VIRTUAL TABLE IF NOT EXISTS kaselog_search USING fts5(
          entity_id        UNINDEXED,
          entity_type      UNINDEXED,
          kase_id          UNINDEXED,
          kase_title,
          collection_id    UNINDEXED,
          collection_title,
          title,
          content
        )
        """,

        // ── Users ────────────────────────────────────────────────────────────
        // Single-user table. Always one row identified by a well-known ID.
        """
        CREATE TABLE IF NOT EXISTS Users (
          Id        TEXT PRIMARY KEY,
          FirstName TEXT,
          LastName  TEXT,
          Email     TEXT,
          Theme     TEXT NOT NULL DEFAULT 'light',
          Accent    TEXT NOT NULL DEFAULT 'teal',
          FontSize  TEXT NOT NULL DEFAULT 'medium',
          CreatedAt TEXT NOT NULL,
          UpdatedAt TEXT NOT NULL
        )
        """,

        // ── Collections tables ───────────────────────────────────────────────
        """
        CREATE TABLE IF NOT EXISTS Collections (
          Id        TEXT PRIMARY KEY,
          Title     TEXT NOT NULL,
          Color     TEXT NOT NULL DEFAULT 'teal',
          CreatedAt TEXT NOT NULL,
          UpdatedAt TEXT NOT NULL
        )
        """,

        """
        CREATE TABLE IF NOT EXISTS CollectionFields (
          Id           TEXT PRIMARY KEY,
          CollectionId TEXT NOT NULL REFERENCES Collections(Id) ON DELETE CASCADE,
          Name         TEXT NOT NULL,
          Type         TEXT NOT NULL,
          Required     INTEGER NOT NULL DEFAULT 0,
          ShowInList   INTEGER NOT NULL DEFAULT 1,
          Options      TEXT,
          SortOrder    INTEGER NOT NULL DEFAULT 0
        )
        """,

        """
        CREATE TABLE IF NOT EXISTS CollectionLayout (
          Id           TEXT PRIMARY KEY,
          CollectionId TEXT NOT NULL UNIQUE REFERENCES Collections(Id) ON DELETE CASCADE,
          Layout       TEXT NOT NULL
        )
        """,

        """
        CREATE TABLE IF NOT EXISTS CollectionItems (
          Id           TEXT PRIMARY KEY,
          CollectionId TEXT NOT NULL REFERENCES Collections(Id) ON DELETE CASCADE,
          KaseId       TEXT REFERENCES Kases(Id) ON DELETE SET NULL,
          FieldValues  TEXT NOT NULL,
          CreatedAt    TEXT NOT NULL,
          UpdatedAt    TEXT NOT NULL
        )
        """,

        """
        CREATE TABLE IF NOT EXISTS CollectionItemHistory (
          Id               TEXT PRIMARY KEY,
          CollectionItemId TEXT NOT NULL REFERENCES CollectionItems(Id) ON DELETE CASCADE,
          FieldValues      TEXT NOT NULL,
          ChangeSummary    TEXT NOT NULL,
          CreatedAt        TEXT NOT NULL
        )
        """,

        // ── FTS5 sync triggers: Logs ─────────────────────────────────────────
        // One FTS row per Log, always reflecting the most recent LogVersion.
        // INSERT: replace existing FTS entry with the new version's content.
        """
        CREATE TRIGGER IF NOT EXISTS fts_logversion_insert
        AFTER INSERT ON LogVersions
        BEGIN
          DELETE FROM kaselog_search WHERE entity_id = NEW.LogId AND entity_type = 'log';
          INSERT INTO kaselog_search(entity_id, entity_type, kase_id, kase_title, collection_id, collection_title, title, content)
          SELECT NEW.LogId, 'log', l.KaseId, k.Title, NULL, NULL, l.Title, NEW.Content
          FROM Logs l
          JOIN Kases k ON k.Id = l.KaseId
          WHERE l.Id = NEW.LogId;
        END
        """,

        // UPDATE: treat like a replacement (LogVersions are normally immutable,
        // but the trigger ensures correctness if content is ever patched).
        """
        CREATE TRIGGER IF NOT EXISTS fts_logversion_update
        AFTER UPDATE ON LogVersions
        BEGIN
          DELETE FROM kaselog_search WHERE entity_id = NEW.LogId AND entity_type = 'log';
          INSERT INTO kaselog_search(entity_id, entity_type, kase_id, kase_title, collection_id, collection_title, title, content)
          SELECT NEW.LogId, 'log', l.KaseId, k.Title, NULL, NULL, l.Title, NEW.Content
          FROM Logs l
          JOIN Kases k ON k.Id = l.KaseId
          WHERE l.Id = NEW.LogId;
        END
        """,

        // DELETE: remove the FTS entry, then re-index the next most-recent
        // remaining version. If no versions remain the FTS entry stays gone.
        """
        CREATE TRIGGER IF NOT EXISTS fts_logversion_delete
        AFTER DELETE ON LogVersions
        BEGIN
          DELETE FROM kaselog_search WHERE entity_id = OLD.LogId AND entity_type = 'log';
          INSERT INTO kaselog_search(entity_id, entity_type, kase_id, kase_title, collection_id, collection_title, title, content)
          SELECT lv.LogId, 'log', l.KaseId, k.Title, NULL, NULL, l.Title, lv.Content
          FROM LogVersions lv
          JOIN Logs l ON l.Id = lv.LogId
          JOIN Kases k ON k.Id = l.KaseId
          WHERE lv.LogId = OLD.LogId
          ORDER BY lv.CreatedAt DESC
          LIMIT 1;
        END
        """,

        // LOG DELETE: SQLite cascade deletes (LogVersions removed via FK) do not
        // fire row-level triggers on the child table. This trigger ensures the FTS
        // entry is always removed when a Log itself is deleted.
        """
        CREATE TRIGGER IF NOT EXISTS fts_log_delete
        AFTER DELETE ON Logs
        BEGIN
          DELETE FROM kaselog_search WHERE entity_id = OLD.Id AND entity_type = 'log';
        END
        """,

        // ── FTS5 sync triggers: CollectionItems ──────────────────────────────
        // title   = value of the first text/select field by SortOrder
        // content = space-separated values of all text/multiline/select fields
        """
        CREATE TRIGGER IF NOT EXISTS fts_collectionitem_insert
        AFTER INSERT ON CollectionItems
        BEGIN
          INSERT INTO kaselog_search(entity_id, entity_type, kase_id, kase_title, collection_id, collection_title, title, content)
          SELECT
            NEW.Id,
            'collection_item',
            NEW.KaseId,
            (SELECT Title FROM Kases WHERE Id = NEW.KaseId),
            NEW.CollectionId,
            c.Title,
            (SELECT json_extract(NEW.FieldValues, '$.' || cf.Id)
             FROM CollectionFields cf
             WHERE cf.CollectionId = NEW.CollectionId
               AND cf.Type IN ('text', 'select')
             ORDER BY cf.SortOrder
             LIMIT 1),
            (SELECT COALESCE(group_concat(COALESCE(json_extract(NEW.FieldValues, '$.' || cf.Id), ''), ' '), '')
             FROM CollectionFields cf
             WHERE cf.CollectionId = NEW.CollectionId
               AND cf.Type IN ('text', 'multiline', 'select'))
          FROM Collections c
          WHERE c.Id = NEW.CollectionId;
        END
        """,

        """
        CREATE TRIGGER IF NOT EXISTS fts_collectionitem_update
        AFTER UPDATE ON CollectionItems
        BEGIN
          DELETE FROM kaselog_search WHERE entity_id = OLD.Id AND entity_type = 'collection_item';
          INSERT INTO kaselog_search(entity_id, entity_type, kase_id, kase_title, collection_id, collection_title, title, content)
          SELECT
            NEW.Id,
            'collection_item',
            NEW.KaseId,
            (SELECT Title FROM Kases WHERE Id = NEW.KaseId),
            NEW.CollectionId,
            c.Title,
            (SELECT json_extract(NEW.FieldValues, '$.' || cf.Id)
             FROM CollectionFields cf
             WHERE cf.CollectionId = NEW.CollectionId
               AND cf.Type IN ('text', 'select')
             ORDER BY cf.SortOrder
             LIMIT 1),
            (SELECT COALESCE(group_concat(COALESCE(json_extract(NEW.FieldValues, '$.' || cf.Id), ''), ' '), '')
             FROM CollectionFields cf
             WHERE cf.CollectionId = NEW.CollectionId
               AND cf.Type IN ('text', 'multiline', 'select'))
          FROM Collections c
          WHERE c.Id = NEW.CollectionId;
        END
        """,

        """
        CREATE TRIGGER IF NOT EXISTS fts_collectionitem_delete
        AFTER DELETE ON CollectionItems
        BEGIN
          DELETE FROM kaselog_search WHERE entity_id = OLD.Id AND entity_type = 'collection_item';
        END
        """,
    ];
}
