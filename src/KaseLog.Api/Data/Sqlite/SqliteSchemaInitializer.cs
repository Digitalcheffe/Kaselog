using Dapper;

namespace KaseLog.Api.Data.Sqlite;

public sealed class SqliteSchemaInitializer : ISchemaInitializer
{
    private readonly IDbConnectionFactory _factory;

    public SqliteSchemaInitializer(IDbConnectionFactory factory)
    {
        _factory = factory;
    }

    public async Task InitializeAsync()
    {
        using var connection = await _factory.OpenAsync();

        foreach (var sql in SchemaDdl)
        {
            await connection.ExecuteAsync(sql);
        }
    }

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
        """
        CREATE VIRTUAL TABLE IF NOT EXISTS kaselog_search USING fts5(
          log_id    UNINDEXED,
          kase_id   UNINDEXED,
          kase_title,
          title,
          content
        )
        """,

        // ── FTS5 sync triggers ───────────────────────────────────────────────
        // One FTS row per Log, always reflecting the most recent LogVersion.
        // INSERT: replace existing FTS entry with the new version's content.
        """
        CREATE TRIGGER IF NOT EXISTS fts_logversion_insert
        AFTER INSERT ON LogVersions
        BEGIN
          DELETE FROM kaselog_search WHERE log_id = NEW.LogId;
          INSERT INTO kaselog_search(log_id, kase_id, kase_title, title, content)
          SELECT NEW.LogId, l.KaseId, k.Title, l.Title, NEW.Content
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
          DELETE FROM kaselog_search WHERE log_id = NEW.LogId;
          INSERT INTO kaselog_search(log_id, kase_id, kase_title, title, content)
          SELECT NEW.LogId, l.KaseId, k.Title, l.Title, NEW.Content
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
          DELETE FROM kaselog_search WHERE log_id = OLD.LogId;
          INSERT INTO kaselog_search(log_id, kase_id, kase_title, title, content)
          SELECT lv.LogId, l.KaseId, k.Title, l.Title, lv.Content
          FROM LogVersions lv
          JOIN Logs l ON l.Id = lv.LogId
          JOIN Kases k ON k.Id = l.KaseId
          WHERE lv.LogId = OLD.LogId
          ORDER BY lv.CreatedAt DESC
          LIMIT 1;
        END
        """,
    ];
}
