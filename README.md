<div align="center">

  <h1>🧭 <code>infra-destinations</code> 📜</h1>

  <p>
    <strong>Backend API service for the SCEA Destinations GDO platform (Quest Manager, Activity Board, Central Dispatch, and cross-game quest tracking) in PlayStation Home.</strong>
  </p>

  <p>
    <a href="https://github.com/DestinationHome/infra-destinations/actions/workflows/lint.yml"><img src="https://img.shields.io/github/actions/workflow/status/DestinationHome/infra-destinations/lint.yml?branch=main&style=flat-square&label=lint" alt="Lint Status"></a>
    <a href="https://github.com/DestinationHome/infra-destinations/actions/workflows/docker.yml"><img src="https://img.shields.io/github/actions/workflow/status/DestinationHome/infra-destinations/docker.yml?branch=main&style=flat-square&label=build" alt="Build Status"></a>
    <a href="https://github.com/DestinationHome/infra-destinations/pkgs/container/infra-destinations"><img src="https://img.shields.io/badge/docker-ghcr.io-blue?style=flat-square&logo=docker" alt="Docker Image"></a>
    <a href="#license"><img src="https://img.shields.io/badge/license-AGPLv3-blue?style=flat-square" alt="License"></a>
  </p>

</div>

---

## 🌟 Authors

- [@zeph](https://github.com/ZephyrCodesStuff)

## 🚧 Supported Platform Features & Endpoints

- [x] **Publisher Registry (`/publisher/*`)**
  - Publisher discovery, names, IDs, and token authentication (e.g. Publisher 12 = RC Rally).
- [x] **Space Quests & Catalogs (`/user/space/*`)**
  - Space-specific quest catalogs, metadata, loyalty, and start conditions.
  - Completed quest status and task reconstruction (`<task id="1"><status>c</status></task>`).
  - Scene entry metrics (visited count & cumulative time spent per space).
- [x] **Quest Groups & Tasks (`/user/group/*`)**
  - Group descriptions, space mappings (`destinations_indie`, etc.), and exit logic blocks.
- [x] **Game Telemetry & Bit-Compression (`/user/game/*`)**
  - Per-game stats, track lap times, custom vehicle loadouts, and 64-bit BigInt compressed objective/parts bitmasks.
- [x] **Central Dispatch Manager (`/user/sync/*`)**
  - Central Dispatch (CDM) periodic player stats and quest synchronization handler.
- [x] **Leaderboards (`/leaderboard/*`)**
  - Global and space leaderboards with ascending/descending sorting for race and activity times.

## 🌠 Features

- ⚡ **Bun & Hono**: Ultra-fast HTTP engine written in TypeScript.
- 💾 **SQLite Persistence**: Powered by [Drizzle ORM](https://orm.drizzle.team) and `bun:sqlite` with auto-initializing publisher-agnostic tables.
- 📜 **Fast XML Builders**: Robust XML generation via `fast-xml-parser` with structured responses matching original SCEA Destinations schema.
- 🪵 **Observability**: LogLayer, Pino pretty logging, and OpenTelemetry OTLP tracing / log exporting.

---

## 🌐 Required Domains

Route the following domains through your DNS / reverse proxy to this container (default port `30088`):

| Domain | Protocol | Purpose |
| :--- | :--- | :--- |
| `destinations.destinationhome.live` | HTTP | Destinations GDO endpoints (`/publisher/*`, `/user/space/*`, `/user/game/*`, `/user/group/*`, `/user/sync/*`, `/leaderboard/*`) |

---

## 🧰 Getting Started

### Quick Local Run

1. **Install dependencies:**
   ```bash
   bun install
   ```

2. **Start the development server:**
   ```bash
   bun run dev
   ```

3. **Run unit tests & linting:**
   ```bash
   bun test
   bun run lint
   ```

---

### Docker Deployment

Run with Docker Compose:

```bash
docker compose up -d
```

The service will start listening on port `30088`.

---

## 📄 License

This project is licensed under the GNU Affero General Public License v3.0 - see the [LICENSE](LICENSE) file for details.
