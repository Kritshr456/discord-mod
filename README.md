# discord-mod

A Discord moderation bot that keeps a SQLite case history even when a Discord
action fails. Warnings are recorded locally; timeouts, kicks and bans call Discord.

## Run

Use Node.js 22.13 or newer (Node 24 recommended).

```sh
npm ci
cp .env.example .env
# Fill in DISCORD_TOKEN, CLIENT_ID and GUILD_ID
node --env-file=.env src/deploy.js
node --env-file=.env src/index.js
```

Create a bot application in the Discord Developer Portal. Invite it with the
`bot` and `applications.commands` scopes and Moderate Members, Kick Members,
Ban Members, View Channels and Send Messages permissions. Place its role above
the members it will moderate. No privileged gateway intents are needed.
Commands register only in GUILD_ID; run deploy separately for each server.
Never grant Administrator just to work around role placement.

## Commands

- `/warn member reason`: save a warning without a DM or role change.
- `/timeout member reason minutes`: timeout for 1 minute through 28 days.
- `/untimeout member reason`, `/kick member reason`, `/ban member reason`.
- `/history member`: ten most recent cases, including failed or pending actions.
- `/case id`: inspect a case in the current server.
- `/mod-config channel`: set the log channel; omit channel to disable delivery.

Replies are private. Every moderation action checks the moderator's permissions,
the bot's permissions and both role hierarchies. The owner, the bot and the
acting moderator cannot be targeted. Commands only target current guild members.
Reasons are limited to 400 characters; user mentions never trigger notifications.
Log delivery failure does not undo a completed action.

## Data and operations

`DATABASE_PATH` defaults to `./data/app.sqlite`. It contains Discord IDs, reasons,
actions, timestamps and log-channel settings. Restrict filesystem access and back
up the database with SQLite's backup tooling or stop the process before copying
the database and its WAL files. Establish a retention policy with server staff;
case deletion and automated retention are not included in v1.

Run one process per database. Concurrent actions on the same member are serialized
within the process. A crash after Discord accepts an action can leave a `pending`
case: check Discord's audit log before retrying. Discord and SQLite cannot share
an atomic transaction. No automated spam detection or message-content collection
is included.

```sh
npm test
npm run check
npm audit --omit=dev
```

Tests use temporary in-memory databases and fake member permissions. They cover
case isolation, failed actions, validation, settings and hierarchy checks.
A live test server and bot token are required to verify gateway/API behavior;
never run destructive moderation smoke tests in a real community.
