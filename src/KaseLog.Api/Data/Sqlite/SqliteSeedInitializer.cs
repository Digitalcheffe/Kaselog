using Dapper;

namespace KaseLog.Api.Data.Sqlite;

/// <summary>
/// Inserts the first-run welcome Kase and documentation Logs when the database
/// is empty.  All IDs are deterministic so the seed is safe to re-run manually
/// without creating duplicates (INSERT OR IGNORE on Tags / INSERT with known IDs).
/// </summary>
public sealed class SqliteSeedInitializer : ISeedInitializer
{
    // ── Deterministic IDs ────────────────────────────────────────────────────

    private const string KaseId = "00000000-0001-0000-0000-000000000001";

    private const string Log1Id = "00000000-0002-0000-0000-000000000001";
    private const string Log2Id = "00000000-0002-0000-0000-000000000002";
    private const string Log3Id = "00000000-0002-0000-0000-000000000003";
    private const string Log4Id = "00000000-0002-0000-0000-000000000004";
    private const string Log5Id = "00000000-0002-0000-0000-000000000005";

    private const string Ver1Id = "00000000-0003-0000-0000-000000000001";
    private const string Ver2Id = "00000000-0003-0000-0000-000000000002";
    private const string Ver3Id = "00000000-0003-0000-0000-000000000003";
    private const string Ver4Id = "00000000-0003-0000-0000-000000000004";
    private const string Ver5Id = "00000000-0003-0000-0000-000000000005";

    // Tag IDs
    private const string TagDocs     = "00000000-0010-0000-0000-000000000001";
    private const string TagOverview = "00000000-0010-0000-0000-000000000002";
    private const string TagKases    = "00000000-0010-0000-0000-000000000003";
    private const string TagLogs     = "00000000-0010-0000-0000-000000000004";
    private const string TagEditor   = "00000000-0010-0000-0000-000000000005";
    private const string TagSearch   = "00000000-0010-0000-0000-000000000006";
    private const string TagTags     = "00000000-0010-0000-0000-000000000007";
    private const string TagTips     = "00000000-0010-0000-0000-000000000008";

    // ── Seed content ────────────────────────────────────────────────────────

    private static readonly (string Id, string Title, string Description, string[] TagIds, string Content)[] Logs =
    [
        (
            Log1Id,
            "What is KaseLog?",
            "The core mental model explained.",
            [TagDocs, TagOverview],
            """
# What is KaseLog?

KaseLog is a private ops journal for the solo technical operator.

The mental model is simple: **open a Kase when something needs attention,
log against it as the work unfolds.**

## Core concepts

**Kase** — the organizing container. A Kase groups related information
around a topic, issue, project, system, or line of thought. Think of it
as a folder with a timeline.

**Log** — the actual entry you write. Logs are markdown documents captured
over time inside a Kase. Each Log has full version history.

## What KaseLog is not

- Not a team wiki
- Not a project management tool
- Not a second brain or PKM system

KaseLog is for people who want a private, simple, searchable system
they control themselves.
"""
        ),
        (
            Log2Id,
            "Creating and Managing Kases",
            "How to create, browse, and organize Kases.",
            [TagDocs, TagKases],
            """
# Creating and Managing Kases

## Create a Kase

Click **New Kase** in the left navigation. Give it a title and an optional
description. That is all — you can always edit it later.

## Browse Kases

The left navigation lists all your Kases. Each shows the Log count.
Click any Kase to open its timeline.

## Kase timeline

The timeline shows all Logs inside a Kase in reverse chronological order.
Each entry shows the Log title, description preview, tags, version badge,
and timestamp.

## Delete a Kase

Deleting a Kase permanently removes it and all Logs inside it.
This cannot be undone.
"""
        ),
        (
            Log3Id,
            "Writing and Editing Logs",
            "The editor, autosave, version history, and checkpoints.",
            [TagDocs, TagLogs, TagEditor],
            """
# Writing and Editing Logs

## Create a Log

Open a Kase and click **New Log**. Give it a title. The editor opens
immediately — start writing.

## The editor

KaseLog uses a rich markdown editor with:

- **Toolbar** — headings, lists, code blocks, tables, images, and more
- **Bubble menu** — appears on text selection for inline formatting
- **Slash commands** — type `/` to insert blocks quickly
- **Markdown shortcuts** — `##` for headings, ` ``` ` for code blocks

## Autosave

Autosave is on by default. KaseLog saves automatically as you write.
You will see autosave activity in the version history panel.

To disable autosave for a Log, open the settings panel (tab on the right
edge of the editor) and toggle autosave off. A **Save** button will appear
in the top bar — you control when changes are committed.

## Named checkpoints

Save a named checkpoint when you want to mark a meaningful moment in a
Log's history. Open the settings panel and click **Save Checkpoint**.
Give it a label. Named checkpoints appear with an amber badge in the
version history list.

## Version history

Every save — autosave or named checkpoint — creates a version. Open the
settings panel to see the full history. Click any version to preview it.
Click **Restore** to bring that version forward as a new entry without
losing any history.
"""
        ),
        (
            Log4Id,
            "Tags and Search",
            "How to tag Logs and find anything fast.",
            [TagDocs, TagSearch, TagTags],
            """
# Tags and Search

## Tagging Logs

Open a Log and go to the settings panel. Type a tag name and press Enter
to add it. Tags are lowercase and shared across all Logs — reusing a tag
name links to the existing tag.

Tags appear on the Kase timeline so you can see what a Log is about
at a glance.

## Quick search

Click **Search logs...** at the bottom of the left navigation to open
the quick search overlay. Start typing — results appear immediately
using full-text search across all Log content.

## Advanced search

From the quick search overlay, click **Advanced** to open the full search
page. You can filter by:

- **Text query** — searches titles and full Log content
- **Kase** — narrow to a specific Kase
- **Tags** — filter by one or more tags (AND logic)
- **Date range** — from and to dates

All filters are composable. Combine them freely.
"""
        ),
        (
            Log5Id,
            "Tips and Keyboard Shortcuts",
            "Work faster with these shortcuts and habits.",
            [TagDocs, TagTips],
            """
# Tips and Keyboard Shortcuts

## Editor shortcuts

| Action | Shortcut |
|---|---|
| Bold | `Ctrl+B` / `Cmd+B` |
| Italic | `Ctrl+I` / `Cmd+I` |
| Underline | `Ctrl+U` / `Cmd+U` |
| Undo | `Ctrl+Z` / `Cmd+Z` |
| Redo | `Ctrl+Shift+Z` / `Cmd+Shift+Z` |
| Insert code block | ` ``` ` + Enter |
| Insert heading | `##` + Space |
| Insert task list | `[ ]` + Space |

## Slash commands

Type `/` anywhere in the editor to open the block insert menu.
Start typing to filter — `/ code`, `/table`, `/image`, etc.

## Good habits

- **Open a Kase per project or system**, not per task. Let the Logs
  accumulate over time — the timeline becomes a useful history.
- **Use the description field** on each Log for a one-line summary.
  It shows on the timeline so you can scan quickly.
- **Tag consistently**. A small set of consistent tags is more useful
  than many ad-hoc ones.
- **Use named checkpoints** at meaningful milestones — before a big
  change, after a decision, when you close a thread of work.

## Customizing KaseLog

Open the appearance panel via the avatar icon in the top bar.
Choose light or dark theme and pick an accent color.
Preferences are saved locally and persist across reloads.
"""
        ),
    ];

    private static readonly (string Id, string Name)[] Tags =
    [
        (TagDocs,     "docs"),
        (TagOverview, "overview"),
        (TagKases,    "kases"),
        (TagLogs,     "logs"),
        (TagEditor,   "editor"),
        (TagSearch,   "search"),
        (TagTags,     "tags"),
        (TagTips,     "tips"),
    ];

    private static readonly string[] VersionIds = [Ver1Id, Ver2Id, Ver3Id, Ver4Id, Ver5Id];

    // ── Infrastructure ───────────────────────────────────────────────────────

    private readonly IDbConnectionFactory _factory;

    /// <summary>Initializes a new instance of <see cref="SqliteSeedInitializer"/>.</summary>
    public SqliteSeedInitializer(IDbConnectionFactory factory)
    {
        _factory = factory;
    }

    // ── ISeedInitializer ─────────────────────────────────────────────────────

    /// <inheritdoc/>
    public async Task<SeedStatus> SeedAsync()
    {
        using var connection = await _factory.OpenAsync();

        var kaseCount = await connection.ExecuteScalarAsync<long>("SELECT COUNT(*) FROM Kases");
        if (kaseCount > 0)
            return SeedStatus.Skipped;

        using var tx = connection.BeginTransaction();
        try
        {
            var now = DateTime.UtcNow.ToString("O");

            // ── Kase ──────────────────────────────────────────────────────
            await connection.ExecuteAsync("""
                INSERT OR IGNORE INTO Kases(Id, Title, Description, CreatedAt, UpdatedAt)
                VALUES (@Id, @Title, @Description, @Now, @Now)
                """,
                new
                {
                    Id          = KaseId,
                    Title       = "Getting Started with KaseLog",
                    Description = "Everything you need to know to use KaseLog effectively.",
                    Now         = now,
                },
                tx);

            // ── Tags ──────────────────────────────────────────────────────
            foreach (var (tagId, tagName) in Tags)
            {
                await connection.ExecuteAsync("""
                    INSERT OR IGNORE INTO Tags(Id, Name, CreatedAt)
                    VALUES (@Id, @Name, @Now)
                    """,
                    new { Id = tagId, Name = tagName, Now = now },
                    tx);
            }

            // ── Logs, LogVersions (triggers update FTS), LogTags ─────────
            for (int i = 0; i < Logs.Length; i++)
            {
                var (logId, title, description, tagIds, content) = Logs[i];
                var versionId = VersionIds[i];

                // Log — must exist before LogVersion so the FTS trigger can JOIN it
                await connection.ExecuteAsync("""
                    INSERT OR IGNORE INTO Logs(Id, KaseId, Title, Description, AutosaveEnabled, CreatedAt, UpdatedAt)
                    VALUES (@Id, @KaseId, @Title, @Description, 1, @Now, @Now)
                    """,
                    new
                    {
                        Id          = logId,
                        KaseId      = KaseId,
                        Title       = title,
                        Description = description,
                        Now         = now,
                    },
                    tx);

                // LogVersion — the fts_logversion_insert trigger fires here and
                // inserts the FTS row automatically, exactly as at runtime.
                await connection.ExecuteAsync("""
                    INSERT OR IGNORE INTO LogVersions(Id, LogId, Content, Label, IsAutosave, CreatedAt)
                    VALUES (@Id, @LogId, @Content, NULL, 0, @Now)
                    """,
                    new
                    {
                        Id      = versionId,
                        LogId   = logId,
                        Content = content.Trim(),
                        Now     = now,
                    },
                    tx);

                // Tags for this Log
                foreach (var tagId in tagIds)
                {
                    await connection.ExecuteAsync("""
                        INSERT OR IGNORE INTO LogTags(LogId, TagId)
                        VALUES (@LogId, @TagId)
                        """,
                        new { LogId = logId, TagId = tagId },
                        tx);
                }
            }

            tx.Commit();
            return SeedStatus.Inserted;
        }
        catch
        {
            tx.Rollback();
            throw;
        }
    }
}
