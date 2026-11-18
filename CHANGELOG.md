# Changelog

## 1.2.1

- Deliver the configured moderation log even when the private success reply fails.
- Keep notification failures separate from the completed moderation action.
- Add notification failure and disabled-log regression coverage.

## 1.2.0

- Add guild-scoped moderation activity summaries with configurable lookback periods.
- Back up, restart and re-register commands after upgrading. New note tables are created automatically; original cases are preserved.

- Add append-only, guild-scoped case notes with private paginated retrieval and runtime permission checks.

## 1.1.0

- Add an optional page to `/history`, with three cases per page and a total count.
- Keep older cases accessible without truncating a ten-case reply.
- Test page boundaries, guild/member isolation and command definitions.
- Expand `npm run check` to syntax-check source, browser code, tests and scripts.

### Upgrade

Re-register guild commands with `node --env-file=.env src/deploy.js`, then restart the bot. Existing SQLite data is preserved.
