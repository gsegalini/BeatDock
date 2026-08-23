# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

BeatDock is a Discord music bot built with Node.js 22+, discord.js v14, and Lavalink v4 (via lavalink-client). Pure JavaScript (no TypeScript). No database — all state is in-memory. Docker-first deployment.

## Commands

```bash
npm start                # Start the bot (node src/index.js)
npm run docker:build     # Build Docker image
npm run docker:up        # Start with Docker Compose
npm run docker:down      # Stop Docker services
npm run docker:logs      # Tail Docker logs
```

There are no tests or linter configured. CI only runs `node --check src/**/*.js` for syntax validation.

## Architecture

**Entry point:** `src/index.js` — bootstraps the Discord client, Lavalink, loads commands/events, sets up graceful shutdown.

**Key modules:**

- `src/commands/` — Each file exports `{ data: SlashCommandBuilder, execute(interaction) }`. Auto-loaded by the command handler. Commands are auto-deployed to Discord on startup.
- `src/events/` — Each file exports `{ name, once, execute(...args) }`. Discord event handlers (ready, interactionCreate, voiceStateUpdate, etc.).
- `src/handlers/` — Dynamic loaders that scan `commands/` and `events/` directories.
- `src/interactions/` — Handlers for component interactions (buttons, select menus). Routed by `customId` prefix in `interactionCreate` (e.g., `player:skip`, `search:next:sessionId`, `filter:preset:name`).
- `src/utils/` — Core business logic:
  - `PlayerController.js` — Creates/updates the now-playing embed and action buttons
  - `PlayerActions.js` — Queue manipulation (shuffle, clear, jump, back)
  - `LavalinkConnectionManager.js` — Connection state, reconnection with exponential backoff, health checks
  - `PublicNodeProvider.js` — Fetches/rotates free public Lavalink servers (fallback when no local Lavalink configured)
  - `searchSessions.js` — Manages search result sessions with 30-min expiry
  - `embeds.js` — Builders for Discord rich embeds
  - `interactionHelpers.js` — Shared validations (voice channel, Lavalink availability)
  - `logger.js` — Structured colored logging with levels (debug/info/warn/error)
- `src/locales/` — i18n JSON files (en, es, it, tr). Accessed via `client.t(key, ...args)`.
- `src/LanguageManager.js` — Loads translations, falls back to English for missing keys.

**Player lifecycle:** One player per guild. Lavalink handles audio streaming to voice channels. Bot listens for track events (`trackStart`, `trackEnd`, `queueEnd`, `trackStuck`, `trackError`). Auto-disconnects on empty queue or empty voice channel (configurable timeouts).

## Conventions

- **Commit style:** Conventional Commits — `feat(module): description`, `fix(module): description`, `docs: description`, `chore: description`.
- **No TypeScript, no build step.** Files run directly with Node.js.
- **Configuration** is via `.env` file (see `.env.example`). Only `TOKEN` is required.
- **Translations:** When adding user-facing strings, add keys to all locale files in `src/locales/`. Use `{0}`, `{1}` for parameter substitution.
