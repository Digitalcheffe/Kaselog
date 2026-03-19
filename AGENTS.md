# KaseLog — Agent Briefing

You are building **KaseLog**, a self-hosted personal kase-and-log system.

Before implementing any feature, read this document completely. All design and implementation decisions must align with the principles defined here.

KaseLog starts with a narrow purpose and a strong foundation. The first job is to build an excellent kase-and-log experience that is fast, clean, reliable, and easy to self-host.

---

## What KaseLog Is

KaseLog is a private ops journal for the solo technical operator.

It is not a PKM. It is not a team wiki. It is not a runbook automation tool. It is not a second brain.

KaseLog is built around a single mental model: you open a Kase when something needs attention, and you log against it as the work unfolds. That is the entire product.

KaseLog is designed for people who want a private, simple, searchable system they control themselves. It also maps cleanly onto AI project workflows — a Kase is a project, Logs are session summaries or context snapshots, and the timeline gives the arc of a conversation or research thread over time.

---

## Product Philosophy

KaseLog begins with a simple model: **Kases contain Logs**.

A **Kase** is the organizing container. It groups related information together around a topic, issue, project, system, incident, or line of thought.

A **Log** is the actual entry the user writes. Logs are markdown documents captured over time inside a Kase.

Future capabilities may grow from this foundation over time, but the quality of creating, editing, reading, organizing, and retrieving Logs must remain the center of the product.

The goal is to build a self-hosted KaseLog application that feels polished, dependable, and pleasant to use every day.

---

## Initial Product Goal

The first version of KaseLog focuses on a complete kase-and-log workflow:

1. Create Kases
2. View Kases (timeline view)
3. Create Logs inside a Kase
4. Edit Logs (full editor view)
5. View Logs
6. Delete Logs
7. Search Logs
8. Tag Logs
9. Version history per Log

This phase is about getting the foundation right. Future additions should only be introduced after the kase and log experience is strong.

---

## Core Concept

A **Kase** is the primary organizational unit.

Each Kase contains:

* title
* optional description
* created timestamp
* updated timestamp

A **Log** is a markdown document stored within a Kase.

Each Log contains:

* KaseId
* title
* short description (shown as preview on the timeline)
* markdown content (stored in LogVersions)
* tags
* autosave setting (boolean, default true)
* created timestamp
* updated timestamp

Kases must be easy to create and browse.

Logs must be easy to create, fast to edit, and easy to find.

---

## Technology Stack

| Layer       | Choice                                                             | Reason                                                                      |
| ----------- | ------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| Backend     | ASP.NET Core Web API                                               | Stable, fast, strong ecosystem                                              |
| Data Access | Dapper                                                             | Lightweight, explicit SQL control, minimal abstraction                      |
| Database    | SQLite first; provider-based support for PostgreSQL and SQL Server | Start simple with SQLite while allowing additional database providers later |
| Search      | Provider-based full text search                                    | Use the native full text capabilities of the configured database provider   |
| Frontend    | React + Vite + TypeScript                                          | Fast modern UI                                                              |
| Editor      | Tiptap (MIT) — StarterKit + targeted extensions                    | Headless, full UI control, MIT license permits commercial use and sale      |
| Styling     | Tailwind CSS                                                       | Lightweight and flexible                                                    |
| Container   | Single Docker container                                            | Simple deployment                                                           |

Do not introduce extra services or infrastructure unless the document is updated to require them.

KaseLog must run as a single container by default, with SQLite as the default database.

The application should be designed with a provider-based data access layer so additional relational database platforms can be supported later without rewriting the application layer. Initial development and verification should target SQLite first.

### Editor: Tiptap

Tiptap is built on ProseMirror (MIT). The core editor and all extensions used by KaseLog are MIT licensed with no commercial restrictions. Selling a product built on Tiptap OSS requires no license purchase and no Tiptap account. Tiptap Platform (cloud collaboration, AI, managed documents) is paid SaaS — KaseLog uses none of it.

Tiptap is headless: it handles all editing logic while KaseLog owns the UI completely. ProseMirror primitives are accessible directly when Tiptap extensions are insufficient.

**Extensions used by KaseLog (all MIT, no Tiptap account required):**

Nodes:
* StarterKit (headings H1–H6, paragraphs, bold, italic, inline code, code blocks, blockquotes, horizontal rules, bullet lists, ordered lists, hard breaks, undo/redo history)
* Code block with lowlight (syntax highlighting across languages)
* Task list + task item (checkbox items)
* Table, table row, table cell, table header
* Image (paste, drag-drop, and upload — see Image Handling)
* Details / collapsible blocks
* Emoji
* Mathematics / LaTeX (inline and block)

Marks:
* Link
* Underline
* Strikethrough
* Highlight
* Subscript
* Superscript
* Text color
* Background color
* Text align
* Font size

Functionality:
* Placeholder
* Character count
* Drag handle (block reordering)
* Dropcursor
* File handler (paste and drop routing)
* Focus management
* Gap cursor
* Invisible characters
* List keymap
* Selection
* Trailing node
* Typography (smart quotes, em dashes)
* Unique ID (per node)
* BubbleMenu (inline selection toolbar)
* FloatingMenu (slash command trigger)
* Markdown shortcuts (## → heading, ``` → code block, etc.)

Do not use any Tiptap extension that requires a Tiptap account, cloud plan, or paid subscription. All extensions above are MIT licensed and free with no account requirement.

**Structural toolbar — pinned at top of editor canvas:**

Contains block-level insert actions only. Groups separated by dividers:

* Text structure: H1, H2, H3
* Lists: bullet list, ordered list, task list
* Blocks: code block, blockquote, collapsible, math
* Insert: table, image, horizontal rule, emoji
* Alignment: left, center, right
* History: undo, redo

**BubbleMenu — appears on text selection only:**

Contains inline formatting only. Disappears when selection is cleared:

* Bold, italic, underline, strikethrough
* Link, inline code, highlight
* Subscript, superscript
* Text color, background color

The top bar contains navigation chrome only. No editor controls belong in the top bar.

If the editor experience is weak, it should be replaced rather than worked around.

### Image Handling

Images are stored as flat files on disk. Each upload generates a unique identifier that is used as the filename. Images are never deduplicated — each upload is independent regardless of content.

**UID scheme:** 40-character alphanumeric string, cryptographically random, uppercase letters and digits. Generated server-side on upload. Example: `A3F9K2M7RX4B9NPQ2WYH6JDCT8VE1SKL0F5GZ3U`

**Storage path:** `/data/images/{uid}.{ext}` — flat directory, no subdirectories, no date folders.

**API endpoint:** `GET /api/images/{uid}` — serves the image file directly. The frontend never needs to know the filesystem path.

**Upload flow:**
1. User triggers upload via toolbar button, clipboard paste, or drag-drop onto canvas
2. File is sent to `POST /api/images`
3. Server generates UID, saves file to `/data/images/{uid}.{ext}`, returns `{ uid, url }`
4. Tiptap Image node is inserted with `src` set to `/api/images/{uid}`

**In the document:** Tiptap stores the API URL as the image src attribute. Markdown serialization uses standard `![alt](/api/images/{uid})` format.

**Image resizing:** Implemented as a custom Tiptap node view wrapping the Image extension. When an image is selected, resize handles appear at all four corners and four edge midpoints using the accent color. Dragging any handle resizes the image. Aspect ratio is locked by default. Width and height are stored as node attributes. A size tooltip shows current pixel dimensions while dragging.

---

## UI Layout

KaseLog uses a two-panel layout. There is no three-column split and no persistent mode toggle.

The canonical layout reference is the HTML artifact set. Refer to these files for exact layout, spacing, component positioning, and interaction behavior. Do not rely on prose descriptions alone when implementing UI — open the artifacts:

* `kaselog-timeline.html` — Kase view with timeline
* `kaselog-editor.html` — Log view with editor, edge tab, settings panel, save button
* `kaselog-settings.html` — Log settings panel detail and theme/accent switcher
* `kaselog-search-quick.html` — Quick search overlay
* `kaselog-search-advanced.html` — Advanced search page with composable filters

### Left navigation

Persistent across all views. Contains:

* KaseLog logo and tagline
* New Kase button
* Kase list with log count per Kase (scrollable)
* Search button — pinned to the bottom of the nav, outside the scrollable Kase list, always visible regardless of list length

The search button is the entry point for all search. Clicking it opens the quick search overlay. The search button label reads "Search logs..." to communicate scope immediately.

### Top bar

48px height. Navigation chrome only. No editor controls, no settings icon.

**Kase view (timeline):**
`[Kase title] [log count pill] [spacer] [+ New Log] [avatar]`

**Log view (editor):**
`[← Kase name] [/] [Log title] [spacer] [vN · history pill] [saved Xs ago] [Save button — autosave off only] [+ New Log] [avatar]`

The Save button is only rendered in the Log view top bar and only when autosave is off for that Log. When autosave is on the Save button is absent — the save status text ("saved Xs ago") communicates state instead. When autosave is off the save status text shows "unsaved changes" in a warning color until the user saves.

The avatar opens the user profile panel (theme, accent, account info). Future admin and user management will be accessed from the profile panel. There is no settings icon in the top bar.

### Main panel — Kase view (timeline)

The Kase timeline is the primary view. It shows all Logs in a Kase in reverse-chronological order (newest at top) as a vertical timeline with a spine line and dots.

Each timeline entry shows:

* Title (clickable, navigates to Log view)
* Version badge (e.g. v3, monospaced, subtle)
* Timestamp (relative for recent, absolute for older)
* Short description (first line of content if description field is empty)
* Tags (colored pills)

Clicking any entry navigates to the Log view for that Log. New Log creates a blank Log and immediately opens it in Log view.

### Main panel — Log view (editor)

Full canvas editor. No competing panels. Tiptap editor fills all available space with a max-width of 680px centered on the canvas.

The Log title is an editable field at the top of the canvas (large, prominent). Below the title: timestamp, Kase name, version indicator — all small and muted.

Back navigation: clicking the back arrow with Kase name in the top bar returns to the Kase timeline.

### Log settings panel

The settings panel is a Log view only feature. It does not exist in the Kase timeline view.

**Trigger:** A small tab is permanently fixed to the right edge of the screen in Log view. The tab shows a ‹ arrow and three vertical dots. Clicking it slides the settings panel in from the right. When the panel is open the tab migrates to the left edge of the panel showing a › arrow — clicking it closes the panel. The tab is always visible, always in the same position relative to the right edge.

The editor canvas compresses slightly when the panel is open but remains fully usable.

**Panel sections in order:**

1. Title (editable input)
2. Short description (editable input — shown as preview on timeline)
3. Tags (pill display with remove; add tag input)
4. Divider
5. Autosave toggle (on/off per Log, default on; shows status text)
6. Divider
7. Version history (list of versions with restore; named checkpoint button)
8. Divider
9. Info (created, last edited, Kase — read only)
10. Delete this log (destructive, red, requires confirmation)

### Search

Search is a global app-level action. It is not context-specific.

**Entry point:** The pinned search button at the bottom of the left nav opens the quick search overlay.

**Quick search overlay:**
Appears over the current view. Contains a full-text search input and composable filter pills. Filters are typeahead dropdowns — the user types to narrow available options, not checkboxes. Available filters:

* Kase (typeahead dropdown — type to find a Kase by name)
* Tag (typeahead dropdown — type to find a tag; multiple tags can be added as separate pills)
* Date range (from / to date inputs)

Selected filters appear as colored pills in the filter row. Each pill is dismissible. Results show below the filter row with match highlighting in content previews. An "Advanced search →" link at the bottom of the overlay navigates to /search with current query and filters preserved.

**Advanced search page (/search):**
Full-page search with the same filter system. The search input lives in the top bar. Filter pills sit in a secondary row below. Results are paginated cards showing title, Kase, timestamp, content preview with match highlighting, and tags.

Search queries run against: log titles, log content (current version), log descriptions, and tag names. Tags and Kases are also independently filterable without a text query.

Version history is per-Log. It is not a Kase-level concept.

### Autosave behavior

When autosave is on (default): the system saves a new version automatically on idle (2 seconds after the user stops typing) and on navigation away. The version count increments silently. The top bar shows saved time.

When autosave is off: no background saves occur. The user saves explicitly with cmd-S or a visible save button. A version is created only on explicit save. Suitable for Logs the user treats as finished documents.

### Named checkpoints

Available regardless of autosave state. The user can save a named checkpoint at any time from the Log settings panel with an optional label. Named checkpoints are visually distinct from autosave versions in the history list (amber badge vs no badge).

### Version restore

Selecting a version in the settings panel shows a preview. Restoring creates a new version (does not overwrite history). The restored content becomes the current version.

---

## Theme and Appearance

KaseLog supports light and dark themes and a user-selected accent color. These are set per-user in the profile panel (avatar → appearance).

**Themes:** Light, Dark.

**Accent colors (five presets):**

* Teal (default) — `#1D9E75`
* Blue — `#378ADD`
* Purple — `#7F77DD`
* Coral — `#D85A30`
* Amber — `#BA7517`

The accent color applies to: timeline dots, active nav state, toggle states, tag colors, version current badge, image resize handles, and any other primary interactive element.

All accent colors are implemented via a single CSS custom property (`--accent`) so the entire UI responds to a single variable change. Each accent also defines light and dark variants for background fills and text (`--accent-light`, `--accent-text`) that automatically adapt to the active theme.

---

## Project Structure

```text
kaselog/
+-- src/
|   +-- KaseLog.Api/
|   |   +-- Controllers/
|   |   +-- Services/
|   |   +-- Data/
|   |   +-- Program.cs
|   +-- kaselog-ui/
|       +-- src/
|       |   +-- components/
|       |   +-- pages/
|       |   +-- hooks/
|       |   +-- api/
|       |   +-- main.tsx
|       +-- vite.config.ts
+-- docker/
|   +-- Dockerfile
|   +-- docker-compose.yml
+-- AGENTS.md
```

---

## Database Strategy

KaseLog starts with **SQLite as the default and primary supported database**.

The data access layer should be isolated so that other database providers, such as **PostgreSQL** and **SQL Server**, can be introduced later.

This does not mean every SQL statement must be forced into a fake universal format. It means the application should separate:

* core Kase and Log workflows
* provider-specific data access
* provider-specific search implementation
* provider-specific schema initialization

The application layer should depend on interfaces and services, not direct database-specific behavior.

---

## Data Model

The system revolves around Kases, Logs, LogVersions, Tags, and LogTags.

```text
Kases
  Id (GUID)
  Title
  Description
  CreatedAt
  UpdatedAt

Logs
  Id (GUID)
  KaseId (GUID FK -> Kases)
  Title
  Description (short preview text, nullable)
  AutosaveEnabled (boolean, default true)
  CreatedAt
  UpdatedAt

LogVersions
  Id (GUID)
  LogId (GUID FK -> Logs)
  Content (markdown text)
  Label (nullable, set for named checkpoints)
  IsAutosave (boolean)
  CreatedAt

Tags
  Id (GUID)
  Name
  CreatedAt

LogTags
  LogId (GUID FK -> Logs)
  TagId (GUID FK -> Tags)
```

The current content of a Log is always the most recent LogVersion row for that LogId ordered by CreatedAt descending. The Logs table does not store content directly. Content lives in LogVersions.

Search is implemented with a provider-specific full text search strategy.

For the initial build, SQLite uses FTS5.

```sql
CREATE VIRTUAL TABLE kaselog_search USING fts5(
  log_id,
  kase_id,
  kase_title,
  title,
  content
);
```

The search index must update automatically whenever Logs are created, updated, or deleted.

---

## API Design

All endpoints live under /api.

### Kases

```text
GET    /api/kases
POST   /api/kases
GET    /api/kases/{id}
PUT    /api/kases/{id}
DELETE /api/kases/{id}
```

### Logs

```text
GET    /api/kases/{kaseId}/logs
POST   /api/kases/{kaseId}/logs
GET    /api/logs/{id}
PUT    /api/logs/{id}
DELETE /api/logs/{id}
```

### Log Versions

```text
GET    /api/logs/{logId}/versions
POST   /api/logs/{logId}/versions
GET    /api/logs/{logId}/versions/{versionId}
POST   /api/logs/{logId}/versions/{versionId}/restore
```

### Images

```text
POST   /api/images
GET    /api/images/{uid}
DELETE /api/images/{uid}
```

`POST /api/images` accepts multipart form data, generates a 40-character alphanumeric UID, stores the file at `/data/images/{uid}.{ext}`, and returns `{ uid, url }`.

### Tags

```text
GET    /api/tags
POST   /api/logs/{logId}/tags
DELETE /api/logs/{logId}/tags/{tagId}
```

### Search

```text
GET /api/search?q={query}
GET /api/search?q={query}&tag={tag}&tag={tag}
GET /api/search?q={query}&kaseId={kaseId}
GET /api/search?q={query}&kaseId={kaseId}&tag={tag}&from={date}&to={date}
```

Search returns matching Logs using the configured provider's search implementation. For the initial build, this is SQLite FTS5. All filter parameters are optional and composable. Multiple tag parameters are treated as AND.

---

## Frontend Pages

```text
/                    Kase list (all Kases)
/kases/{id}          Kase view, timeline of Logs
/logs/{id}           Log view, full editor
/search              Search results
```

The UI should prioritize speed, readability, minimalism, and clean kase and log workflows. Avoid dashboard clutter and unnecessary navigation layers.

---

## Performance Goals

KaseLog should feel immediate.

Targets:

* Kase open under 50ms in normal local use
* Log open under 50ms in normal local use
* Search results under 100ms for typical datasets
* Log save under 50ms in normal local use

SQLite is expected to be sufficient for this phase.

---

## Deployment

KaseLog runs inside a **single Docker container**.

The container includes:

* ASP.NET Core API
* React frontend served as static files
* SQLite database on a mounted volume

Database path: /data/kaselog.db

---

## Environment Variables

```text
KASELOG_PORT=5000
KASELOG_DB_PROVIDER=sqlite
KASELOG_DATA_PATH=/data/kaselog.db
KASELOG_CONNECTION_STRING=
```

---

## Coding Standards

### C#

* nullable reference types enabled
* async/await throughout
* no synchronous DB access
* prefer clear service boundaries over unnecessary abstraction

### TypeScript

* strict mode enabled
* no any
* functional React components only

### API

Responses use a consistent envelope shape:

```json
{
  "data": {},
  "error": null,
  "meta": {}
}
```

Errors use RFC 7807 Problem Details format.

---

## Design Principles

When implementing KaseLog:

1. Prefer simplicity over flexibility
2. Prefer clarity over abstraction
3. Prefer speed over feature breadth
4. Build only what the product currently needs
5. Protect the quality of the kase and log experience

---

## Testing Standards

KaseLog uses xUnit for backend unit and integration tests. React Testing
Library for frontend component and integration tests.

### Backend testing

Test project: `tests/KaseLog.Api.Tests`

Use an in-memory SQLite database for all tests. Do not use the production
database path in tests. Each test class should set up a fresh database.

Required coverage areas:

**Schema and data access:**
- Schema initializes on a fresh database without errors
- All tables and the FTS5 index exist after initialization
- Foreign key constraints cascade correctly on delete
- IDs are valid GUIDs, timestamps are valid ISO 8601 UTC

**API endpoints:**
- Happy path for every endpoint (correct status code and response shape)
- 404 returned for unknown IDs on all GET, PUT, DELETE endpoints
- 400 returned for validation failures with field-level error details
- Envelope shape `{ data, error, meta }` present on all responses
- Problem Details format on all error responses

**Business logic:**
- Creating a Log creates an initial empty LogVersion in the same transaction
- Current Log content is always the most recent LogVersion
- FTS5 index updates when LogVersions are inserted, updated, or deleted
- Tag names normalized to lowercase, no duplicates created on re-use
- Image UIDs are exactly 40 characters, alphanumeric uppercase
- Autosave version and named checkpoint version are distinguishable
- Version restore creates a new version, does not mutate history

**Performance targets (measured in tests):**
- Kase list with 100 Kases returns under 50ms
- Log fetch with 50 versions returns under 50ms
- FTS5 search across 1000 Logs returns under 100ms

### Frontend testing

Use React Testing Library with mocked API responses (MSW or vi.fn()).

Required coverage areas:

**Components:**
- Kase list renders correctly with data and in empty state
- Timeline renders entries with correct title, version badge, tags, timestamp
- Log editor renders with title and content from current version
- Settings panel opens and closes on edge tab click
- Autosave toggle shows/hides Save button in top bar
- Search overlay opens, updates results on input, closes on Escape
- Theme toggle updates data-theme on body
- Accent picker updates --accent CSS variable

**User flows:**
- Create Kase → navigate to timeline
- Create Log → navigate to editor
- Edit Log title → persists on blur
- Add tag → tag appears in settings panel and timeline
- Save named checkpoint → version appears in history list
- Restore version → new version created with restored content
- Delete Log → navigate back to Kase timeline
- Search → results appear → click result → navigate to Log

### Running tests

```bash
# Backend
cd tests/KaseLog.Api.Tests
dotnet test

# Frontend
cd src/kaselog-ui
npm test
```

All tests must pass before any change is considered complete.

---

## Definition of Done

A change is complete when:

1. The implementation works end to end in the running Docker container
2. The API and UI are aligned — no endpoint called by the frontend is missing
3. All backend unit and integration tests pass
4. All frontend tests pass
5. The Docker build succeeds with no errors or warnings
6. The container starts cleanly on a fresh volume without manual steps
7. GET /health returns 200
8. The change improves or preserves the kase and log experience

---

## Development Rule

Do not expand the product casually.

New capabilities should only be introduced after the kase and log foundation is strong and this document has been updated accordingly.

AGENTS.md is the source of truth for the product direction.
