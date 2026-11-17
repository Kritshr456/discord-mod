# Changelog

## 1.1.0

- Add an optional page to `/history`, with three cases per page and a total count.
- Keep older cases accessible without truncating a ten-case reply.
- Test page boundaries, guild/member isolation and command definitions.
- Expand `npm run check` to syntax-check source, browser code, tests and scripts.

### Upgrade

Re-register guild commands with `node --env-file=.env src/deploy.js`, then restart the bot. Existing SQLite data is preserved.
