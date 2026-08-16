# A static site with no backend

The whole game ships as static files: React and TypeScript built by Vite, served from GitHub Pages, with the search running in a Web Worker in the player's browser. There is no server, no account system, and no database. Two-player games are hotseat — both players share one device — and settings and the game in progress live in `localStorage`.

## Considered options

Online play between two devices was the obvious alternative and was deliberately deferred. It requires a server, room and reconnect handling, and server-side rule validation (a client that owns the rules can be made to cheat), which is roughly as much work again as the game itself. The teaching goal that motivates this project is served entirely by the local engine, so online play buys nothing for it.

## Consequences

Running costs are zero and the game works offline, but the engine is fully visible to anyone who opens the console — acceptable, because there is nothing to protect without accounts or rankings. The decision is reversible only in one direction cheaply: because the engine is pure TypeScript with no UI dependencies (ADR-0002), the rules can be reused server-side later. What would not survive an online build is the assumption that one browser holds the single authoritative game state, which is baked into the UI layer and into the `localStorage` persistence.
