# KaseLog

**A private ops journal for the solo technical operator.**

KaseLog is a self-hosted kase-and-log system built around a single mental model: you open a Kase when something needs attention, and you log against it as the work unfolds. That's it. No second brain. No team wiki. No bloat.

---

## What It Is

KaseLog gives you two first-class tools:

- **Kases** — organizing containers for narrative work. Group related logs around an incident, project, system, or line of thought.
- **Logs** — markdown documents captured over time inside a Kase. The actual writing surface.
- **Collections** — typed inventories with user-defined schemas. Track structured records (gear, media, anything with consistent fields) and link them to Kases so everything shows up on one timeline.

If you've ever lost context because your ops notes lived in five different places, KaseLog is the fix.

---

## Key Features

- **Timeline view** — every Kase has a chronological feed of Logs and Collection items
- **Full markdown editor** — with autosave and per-log version history
- **Collections** — define a schema, design a layout, add items, and optionally attach them to a Kase
- **Unified search** — full-text search across Logs and Collection items with tag, date, and Kase filters
- **Tagging** — tag Logs for fast filtering and retrieval
- **Light/dark theme** — plus five accent color presets
- **Single container** — ASP.NET Core API + React frontend + SQLite, all in one Docker image

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | ASP.NET Core (.NET 8) |
| Frontend | React + TypeScript (Vite) |
| Database | SQLite via Dapper (PostgreSQL/SQL Server extensible) |
| Search | SQLite FTS5 |
| Deployment | Docker (single container) |

---

## Getting Started

### Docker (recommended)

```bash
docker run -d \
  --name kaselog \
  -p 5000:5000 \
  -v kaselog-data:/data \
  kaselog/kaselog:latest
```

Then open [http://localhost:5000](http://localhost:5000).

### Docker Compose

```yaml
services:
  kaselog:
    image: kaselog/kaselog:latest
    ports:
      - "5000:5000"
    volumes:
      - kaselog-data:/data

volumes:
  kaselog-data:
```

```bash
docker compose up -d
```

---

## Configuration

All configuration is via environment variables.

| Variable | Default | Description |
|---|---|---|
| `KASELOG_PORT` | `5000` | Port the app listens on |
| `KASELOG_DB_PROVIDER` | `sqlite` | Database provider |
| `KASELOG_DATA_PATH` | `/data/kaselog.db` | Path to the SQLite database file |
| `KASELOG_CONNECTION_STRING` | _(empty)_ | Override connection string (for non-SQLite providers) |

---

## Project Structure

```
kaselog/
├── src/
│   ├── KaseLog.Api/          # ASP.NET Core backend
│   │   ├── Controllers/
│   │   ├── Services/
│   │   └── Data/
│   └── kaselog-ui/           # React frontend
│       └── src/
│           ├── components/
│           ├── pages/
│           ├── hooks/
│           └── api/
├── docker/
│   ├── Dockerfile
│   └── docker-compose.yml
├── tests/
│   └── KaseLog.Api.Tests/
├── AGENTS.md
└── PROMPTS.md
```

---

## Performance Targets

KaseLog is built to feel immediate on local hardware.

| Operation | Target |
|---|---|
| Kase open | < 50ms |
| Log open | < 50ms |
| Log save | < 50ms |
| Search results | < 100ms |
| Collection list (500 items) | < 100ms |

---

## Development

### Prerequisites

- .NET 8 SDK
- Node.js 20+
- Docker (optional, for container builds)

### Run locally

```bash
# Backend
cd src/KaseLog.Api
dotnet run

# Frontend (separate terminal)
cd src/kaselog-ui
npm install
npm run dev
```

### Run tests

```bash
dotnet test
```

---

## What's Coming

- **Follow-ups** — track action items across Kases from a single view
- **Log markers** — flag entries as decisions, blockers, or resolutions
- **Log templates** — pre-populate the editor from saved structures
- **Kase status and due dates** — open, in progress, resolved, archived with optional deadlines
- **Activity heatmap** — visualize logging activity over time
- **Export** — Kase to markdown or PDF
- **Backup and restore** — one-click archive from within the app
- **Read-only share links** — share a Kase or Log without granting access
- **User management** — multi-user support with roles
- **Mobile and PWA** — optimized interface with installable app support
- **OAuth** — standard authentication support for self-hosted deployments
- **MCP server** — expose KaseLog as an MCP data source for AI assistants. Store conversation summaries as Logs and retrieve them by context in future sessions — turning your journal into a persistent AI memory layer

---

## Philosophy

> Prefer simplicity over flexibility. Prefer clarity over abstraction. Build only what the product currently needs.

KaseLog doesn't try to be everything. It tries to be excellent at one thing: giving you a fast, clean, searchable private journal that you actually control.

---

## License

MIT
