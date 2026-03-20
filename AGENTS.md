# KaseLog — Agent Briefing

You are building **KaseLog**, a self-hosted personal kase-and-log system.

Before implementing any feature, read this document completely. All design and implementation decisions must align with the principles defined here.

KaseLog starts with a narrow purpose and a strong foundation. The first job is to build an excellent kase-and-log experience that is fast, clean, reliable, and easy to self-host. Collections extend that foundation — they do not replace it.

---

## What KaseLog Is

KaseLog is a private ops journal for the solo technical operator.

It is not a PKM. It is not a team wiki. It is not a runbook automation tool. It is not a second brain.

KaseLog is built around two mental models that work together:

1. You open a **Kase** when something needs attention and log against it as the work unfolds.
2. You create a **Collection** when you need to track a set of things that share the same structure.

Both live in the same application. Both can be linked. The timeline is where they meet.

KaseLog is designed for people who want a private, simple, searchable system they control themselves. It maps cleanly onto both technical operations (Kases for incidents, projects, research threads) and personal inventory needs (Collections for gear, media, anything with consistent fields).

---

## Product Philosophy

KaseLog has three first-class concepts: **Kases**, **Logs**, and **Collections**.

A **Kase** is the organizing container for narrative work. It groups related Logs around a topic, issue, project, system, incident, or line of thought.

A **Log** is the actual entry the user writes. Logs are markdown documents captured over time inside a Kase.

A **Collection** is a typed inventory. It has a user-defined schema (fields) and a user-designed layout. Each item in a Collection is a structured record. Collection items can be optionally linked to a Kase and appear on the Kase timeline alongside Logs.

The quality of creating, editing, reading, organizing, and retrieving Logs must remain the center of the product. Collections extend that without competing with it.

The goal is to build a self-hosted KaseLog application that feels polished, dependable, and pleasant to use every day.

---

## Product Goals

### Phase 1 — Kase and Log foundation (complete)

1. Create Kases
2. View Kases (timeline view)
3. Create Logs inside a Kase
4. Edit Logs (full editor view)
5. View Logs
6. Delete Logs
7. Search Logs
8. Tag Logs
9. Version history per Log

### Phase 2 — Collections (current)

1. Create Collections with user-defined schemas
2. Design Collection item layout (2-column grid designer)
3. Add Collection items via generated entry form
4. View Collection items in a filterable, sortable list
5. Link Collection items to Kases
6. Collection items appear on the Kase timeline alongside Logs
7. Search across both Logs and Collection items

---

## Core Concepts

### Kase

The primary organizational unit for narrative work.

Each Kase contains:
* title
* optional description
* created timestamp
* updated timestamp

### Log

A markdown document stored within a Kase.

Each Log contains:
* KaseId
* title
* short description (shown as preview on the timeline)
* markdown content (stored in LogVersions)
* tags
* autosave setting (boolean, default true)
* created timestamp
* updated timestamp

### Collection

A typed inventory with a user-defined schema and layout.

Each Collection contains:
* title
* color (one of five accent presets — used as the Collection's dot color in the nav)
* schema (ordered list of fields — see Field Types)
* layout (2-column grid arrangement of fields and layout elements)
* created timestamp
* updated timestamp

### Collection Item

A structured record inside a Collection.

Each Collection Item contains:
* CollectionId (FK)
* KaseId (nullable FK — optional link to a Kase)
* field values (JSON, keyed by field ID)
* created timestamp
* updated timestamp

When a Collection Item is linked to a Kase via KaseId, it appears on the Kase timeline as a structured inline card alongside Logs.

---

## Field Types

The following field types are supported in Collection schemas:

| Type       | Description                              | List column | Searchable |
|------------|------------------------------------------|-------------|------------|
| text       | Single line text                         | yes         | yes        |
| multiline  | Multi-line paragraph text                | no          | yes        |
| number     | Integer or decimal                       | yes         | no         |
| date       | Calendar date                            | yes         | no         |
| select     | Single value from predefined options     | yes         | yes        |
| rating     | 1–5 star rating                         | yes         | no         |
| url        | Link                                     | yes         | no         |
| boolean    | Yes / No toggle                          | yes         | no         |
| image      | Photo or cover art (stored as flat file) | thumbnail   | no         |

Each field has:
* id (GUID)
* name (user-defined label)
* type (from table above)
* required (boolean)
* showInList (boolean — controls whether the field appears as a column in the Collection list view)
* options (array of strings — select type only)
* sortOrder (integer — display order in schema)

---

## Collection Layout Designer

The layout designer is a separate mode accessed via "Edit schema" from the Collection list view. It navigates to `/collections/:id/design`.

The designer has two tabs:

**Schema tab** — define fields. Add, remove, rename, change type, configure select options, toggle required and showInList per field.

**Layout tab** — arrange fields on a 2-column grid canvas. The canvas has a fixed 2-column structure with up to 50 rows. Fields snap to grid cells. A field can span 1 column (half width) or 2 columns (full width). A field can span multiple rows (tall). Layout elements (Divider, Section label) are canvas-only — they carry no data and do not appear in the list view or search results.

**Layout elements:**
* Divider — a horizontal rule with optional text label. Always full width.
* Section label — a small uppercase group heading. Always full width.

The layout produced by the designer directly drives the Collection item entry form and item detail view. Whatever the designer produces is exactly what users see when adding or editing items — no drift between design and reality.

The layout is stored as a JSON array of rows. Each row contains two cell slots. A cell is either null (empty), a field reference (`{ kind: "field", fieldId, span }`), or a layout element (`{ kind: "divider"|"label", label, span }`). Span of 2 means the item occupies both columns in that row.

---

## Collection Item Entry and View

Collection items have two modes: **edit mode** and **view mode**.

**Edit mode** — the schema-driven form rendered according to the designer layout. Each field type renders as the appropriate input control. Required fields are marked with an asterisk. Saving validates required fields. After a successful save the view transitions to view mode.

**View mode** — the same layout with inputs replaced by clean read-only displays. Borders and backgrounds drop away. The Edit button returns to edit mode.

The Kase link selector is always present at the bottom of both modes — a simple dropdown to optionally attach the item to a Kase.

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

Do not introduce extra services or infrastructure unless this document is updated to require them.

KaseLog must run as a single container by default, with SQLite as the default database.

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

Do not use any Tiptap extension that requires a Tiptap account, cloud plan, or paid subscription.

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

### Image Handling

Images are stored as flat files on disk. Each upload generates a unique identifier. Images are never deduplicated.

**UID scheme:** 40-character alphanumeric string, cryptographically random, uppercase letters and digits.

**Storage path:** `/data/images/{uid}.{ext}` — flat directory, no subdirectories.

**API endpoint:** `GET /api/images/{uid}` — serves the image file directly.

**Upload flow:**
1. User triggers upload via toolbar button, clipboard paste, drag-drop, or image field in Collection item form
2. File is sent to `POST /api/images`
3. Server generates UID, saves file to `/data/images/{uid}.{ext}`, returns `{ uid, url }`
4. The image URL is stored as the field value for image-type Collection fields, or inserted as a Tiptap Image node in Log content

---

## UI Layout

KaseLog uses a two-panel layout. There is no three-column split and no persistent mode toggle.

The canonical layout reference is the HTML artifact set. Refer to these files for exact layout, spacing, component positioning, and interaction behavior. Do not rely on prose descriptions alone when implementing UI — open the artifacts:

* `kaselog-timeline.html` — Kase view with timeline
* `kaselog-editor.html` — Log view with editor, edge tab, settings panel, save button
* `kaselog-settings.html` — Log settings panel detail and theme/accent switcher
* `kaselog-search-quick.html` — Quick search overlay
* `kaselog-search-advanced.html` — Advanced search page with composable filters
* `kaselog-nav-collections.html` — Updated left nav with accordion Kases and Collections sections
* `kaselog-new-content-modal.html` — New Log or Add Collection Item picker modal
* `kaselog-collection-list.html` — Collection list view with filters, column visibility, sorting
* `kaselog-mixed-timeline.html` — Kase timeline with mixed Log and Collection item entries
* `kaselog-collection-designer.html` — Collection schema builder and layout designer
* `kaselog-collection-item-entry.html` — Collection item entry form and view mode

### Left navigation

Persistent across all views. Contains:

* KaseLog logo and tagline
* Two accordion sections: **Kases** and **Collections**
* Each section has a header with a collapse/expand arrow (▾ expanded, ▸ collapsed) and a `+ new` button that remains visible even when collapsed
* Each section shows the 5 most recent items with a `+ N more` link to the full list page
* Collections show a color dot matching the Collection's accent color
* Search button — pinned to the bottom of the nav, always visible regardless of section collapse state

The `+ new` button on the Kases section creates a new Kase. The `+ new` button on the Collections section creates a new Collection (opens the designer at a blank state).

The search button opens the quick search overlay. The label reads "Search logs..." to communicate scope immediately.

### Top bar

48px height. Navigation chrome only. No editor controls, no settings icon.

**Kase view (timeline):**
`[Kase title] [entry count pill] [spacer] [+ New] [avatar]`

The `+ New` button in Kase view opens the new content modal — a picker for New Log or Add Collection Item.

**Log view (editor):**
`[← Kase name] [/] [Log title] [spacer] [vN · history pill] [saved Xs ago] [Save button — autosave off only] [+ New] [avatar]`

**Collection list view:**
`[Collection dot] [Collection title] [item count pill] [spacer] [Edit schema] [+ Add item] [avatar]`

**Collection designer:**
`[← Collections] [/] [Collection title — Designer] [spacer] [Save collection]`

**Collection item entry/view:**
`[← Collection name] [/] [Collection dot] [Collection name] [/] [Item title or "New item"] [spacer] [Edit / View mode toggle] [avatar]`

The Save button in Log view is only rendered when autosave is off for that Log.
The avatar opens the user profile panel (theme, accent, account info).

### Main panel — Kase view (timeline)

The Kase timeline shows all Logs and linked Collection items in reverse-chronological order as a vertical timeline with a spine line and dots.

**Log entries** show:
* Title (clickable, navigates to Log view)
* `log` type badge
* Version badge (e.g. v3, monospaced, subtle)
* Timestamp
* Short description
* Tags

**Collection item entries** show:
* `collection item` type badge
* Timestamp
* An inline structured card containing: Collection color dot, Collection name, item title (first text/select field), and key field values as a compact summary row

Log dots are filled with the accent color. Collection item dots are square and dimmed to visually distinguish them without competing with Logs.

Clicking a Log entry navigates to the Log view. Clicking a Collection item entry navigates to the Collection item view.

The `+ New` button opens a modal with two choices: New Log and Add Collection Item. New Log shows a title and description form. Add Collection Item shows a Collection picker then navigates to the item entry form.

### Main panel — Collection list view

A filterable, sortable list of all items in a Collection.

**Filter bar (below top bar):**
* Text search input — searches across all text, multiline, and select field values
* Dynamic field filter pills — one pill per filterable field (select and boolean types), pulled from the schema. Each pill opens a typeahead dropdown of that field's values
* Active filters turn the pill teal and show a "X of N" count
* "Clear" link removes all active filters
* Columns button — opens a panel listing all schema fields with on/off toggles. Title field is always visible (locked). Hidden columns show a badge count on the button. "Show all" resets visibility

**Table:**
* Column headers match visible fields, clickable for sort (↑/↓)
* Each row is a Collection item — clicking navigates to the item view
* Status badges, star ratings, and image thumbnails render inline

### Main panel — Collection designer

Two-tab interface at `/collections/:id/design`.

**Schema tab:**
Left panel lists all fields (drag handle, type icon, name, type label, delete button). Right panel is the field editor for the selected field: name input, type display with change option, select options list (for select type), Required toggle, Show in list toggle.

**Layout tab:**
Left panel is the field palette — all defined fields listed with placed/unplaced state. Layout elements (Divider, Section label) at the bottom. Right panel is the 2-column canvas — drag fields from palette to drop cells. Hover a placed tile to reveal remove (×) and span controls (Full width / Half width). Add Row button extends the canvas.

### Main panel — Collection item entry and view

A form driven by the Collection schema and layout. Renders the designer layout with real inputs in edit mode and clean read-only displays in view mode. Mode toggle is in the top bar and in the mode bar below the top bar. Kase link selector always present at the bottom.

### Log settings panel

Unchanged from Phase 1. Log view only. Edge tab trigger. Sections: title, description, tags, autosave toggle, version history, info, delete.

### Search

Search is a global app-level action.

**Quick search overlay** — opens from pinned search button. Text input, composable filter pills (Kase, Tag, Date range, Collection). Results show two groups: Logs and Collection items. Match highlighting in both. "Advanced search →" link at bottom.

**Advanced search page (/search)** — full-page search with same filter system. Results are paginated cards. Log cards show title, Kase, timestamp, content preview, tags. Collection item cards show Collection name with dot, item title, key field values, timestamp, linked Kase if any.

Search queries run against: log titles, log content, log descriptions, tag names, Collection item text/multiline/select field values, and Collection names.

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

The accent color applies to: timeline dots, active nav state, toggle states, tag colors, version current badge, image resize handles, Collection item type badge, active filter pills, and any other primary interactive element.

Collection color dots in the nav use whichever accent preset is assigned to that Collection. This is independent of the user's global accent preference.

All accent colors are implemented via a single CSS custom property (`--accent`) so the entire UI responds to a single variable change.

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
+-- PROMPTS.md
```

---

## Database Strategy

KaseLog starts with **SQLite as the default and primary supported database**.

The data access layer should be isolated so that other database providers, such as **PostgreSQL** and **SQL Server**, can be introduced later.

The application layer should depend on interfaces and services, not direct database-specific behavior.

---

## Data Model

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

Collections
  Id (GUID)
  Title
  Color (text — one of: teal, blue, purple, coral, amber)
  CreatedAt
  UpdatedAt

CollectionFields
  Id (GUID)
  CollectionId (GUID FK -> Collections ON DELETE CASCADE)
  Name
  Type (text | multiline | number | date | select | rating | url | boolean | image)
  Required (boolean, default false)
  ShowInList (boolean, default true)
  Options (JSON text — array of strings, select type only, nullable)
  SortOrder (integer)

CollectionLayout
  Id (GUID)
  CollectionId (GUID FK -> Collections ON DELETE CASCADE UNIQUE)
  Layout (JSON text — array of row objects, see layout format)

CollectionItems
  Id (GUID)
  CollectionId (GUID FK -> Collections ON DELETE CASCADE)
  KaseId (GUID FK -> Kases ON DELETE SET NULL, nullable)
  FieldValues (JSON text — object keyed by CollectionField.Id)
  CreatedAt
  UpdatedAt
```

**Layout JSON format:**
```json
[
  {
    "cells": [
      { "kind": "field", "fieldId": "...", "span": 2 },
      null
    ]
  },
  {
    "cells": [
      { "kind": "field", "fieldId": "...", "span": 1 },
      { "kind": "field", "fieldId": "...", "span": 1 }
    ]
  },
  {
    "cells": [
      { "kind": "divider", "label": "Details", "span": 2 },
      null
    ]
  }
]
```

**Search index — extended for Collections:**

```sql
CREATE VIRTUAL TABLE kaselog_search USING fts5(
  entity_id UNINDEXED,
  entity_type UNINDEXED,
  kase_id UNINDEXED,
  kase_title,
  collection_id UNINDEXED,
  collection_title,
  title,
  content
);
```

`entity_type` is either `log` or `collection_item`. For logs, `title` is the Log title and `content` is the current LogVersion content. For collection items, `title` is the value of the first text or select field and `content` is the concatenation of all text, multiline, and select field values. The index updates via SQLite triggers on LogVersion insert/delete and CollectionItem insert/update/delete.

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

### Tags

```text
GET    /api/tags
POST   /api/logs/{logId}/tags
DELETE /api/logs/{logId}/tags/{tagId}
```

### Collections

```text
GET    /api/collections
POST   /api/collections
GET    /api/collections/{id}
PUT    /api/collections/{id}
DELETE /api/collections/{id}
```

### Collection Fields

```text
GET    /api/collections/{id}/fields
POST   /api/collections/{id}/fields
PUT    /api/collections/{id}/fields/{fieldId}
DELETE /api/collections/{id}/fields/{fieldId}
PUT    /api/collections/{id}/fields/reorder
```

`PUT /api/collections/{id}/fields/reorder` accepts an ordered array of field IDs and updates SortOrder for all fields in a single transaction.

### Collection Layout

```text
GET    /api/collections/{id}/layout
PUT    /api/collections/{id}/layout
```

`PUT /api/collections/{id}/layout` accepts the full layout JSON and replaces the existing layout in a single operation.

### Collection Items

```text
GET    /api/collections/{id}/items
POST   /api/collections/{id}/items
GET    /api/items/{id}
PUT    /api/items/{id}
DELETE /api/items/{id}
```

`GET /api/collections/{id}/items` supports query parameters:
* `q` — full-text search
* `kaseId` — filter by linked Kase
* `field[fieldId]=value` — filter by field value (composable, multiple allowed)
* `sort=fieldId` — sort by field value
* `dir=asc|desc` — sort direction
* `page` and `pageSize` — pagination

### Kase Timeline

```text
GET    /api/kases/{id}/timeline
```

Returns a reverse-chronological merged list of Logs and Collection items linked to this Kase. Each entry includes an `entityType` field (`log` or `collection_item`) so the frontend can render them differently. Pagination supported.

### Search

```text
GET /api/search?q={query}
GET /api/search?q={query}&type=log|collection_item
GET /api/search?q={query}&kaseId={kaseId}
GET /api/search?q={query}&collectionId={collectionId}
GET /api/search?q={query}&tag={tag}&from={date}&to={date}
```

Returns matched Logs and Collection items. Results grouped by entityType in the response. All parameters optional and composable.

---

## Frontend Pages

```text
/                          Kase list (all Kases)
/kases/{id}                Kase view, mixed timeline
/logs/{id}                 Log view, full editor
/collections               All Collections list
/collections/{id}          Collection list view — items, filters, column picker
/collections/{id}/design   Collection designer — schema and layout tabs
/items/{id}                Collection item entry and view
/search                    Search results
```

---

## Performance Goals

KaseLog should feel immediate.

Targets:
* Kase open under 50ms
* Log open under 50ms
* Collection list with 500 items under 100ms
* Collection item open under 50ms
* Search results (logs + collection items) under 100ms
* Log save under 50ms
* Collection item save under 50ms

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
6. Collections extend the foundation — they do not complicate it

---

## Testing Standards

KaseLog uses xUnit for backend unit and integration tests. React Testing Library for frontend component and integration tests.

### Backend testing

Test project: `tests/KaseLog.Api.Tests`

Use an in-memory SQLite database for all tests. Each test class sets up a fresh database.

Required coverage areas include all Phase 1 coverage plus:

**Collections schema and data access:**
- Collections table, CollectionFields, CollectionLayout, CollectionItems all initialize correctly
- Foreign key cascades: deleting a Collection removes all fields, layout, and items
- CollectionItem.KaseId SET NULL on Kase delete
- Field reorder updates SortOrder correctly for all affected fields
- Layout JSON stored and retrieved without mutation

**Collections API:**
- CRUD happy path for Collections, Fields, Items
- Field reorder endpoint updates all SortOrder values in one transaction
- Layout PUT replaces full layout atomically
- GET /api/collections/{id}/items filters by field value correctly
- GET /api/kases/{id}/timeline returns mixed Logs and Collection items in reverse-chronological order
- entityType field present on all timeline entries

**Collections business logic:**
- CollectionItem FieldValues validated against schema on create and update
- Required fields enforced — 400 returned if missing
- Image field values store the image UID, not the raw file
- FTS5 index updated on CollectionItem create, update, delete
- Search returns both logs and collection_items with correct entityType

**Performance targets:**
- Collection list with 500 items under 100ms
- Timeline with 200 mixed entries under 100ms
- Search across 1000 logs + 500 collection items under 100ms

### Frontend testing

Required coverage areas include all Phase 1 coverage plus:

**Collections components:**
- Nav accordion expands and collapses Kases and Collections independently
- Collection list renders items with correct field values
- Filter pills generated from schema fields
- Column picker toggles visibility, title always locked
- Designer schema tab: add field, edit field, delete field
- Designer layout tab: drag field to cell, remove tile, toggle full/half width
- Item entry form renders all field types correctly from schema and layout
- Required field validation highlights missing fields on save attempt
- View mode renders read-only layout, Edit button returns to edit mode
- New content modal shows Log and Collection Item options

**Collections user flows:**
- Create Collection → navigate to designer → define fields → arrange layout → save
- Add item → fill form → save → view mode
- Link item to Kase → item appears on Kase timeline
- Filter Collection list by field value → results narrow
- Hide column → column disappears from list header and rows
- Search → results show both logs and collection items → click item → navigate to item view
- Delete Collection → removed from nav and collections page

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

New capabilities should only be introduced after the current foundation is strong and this document has been updated accordingly.

AGENTS.md is the source of truth for the product direction.
