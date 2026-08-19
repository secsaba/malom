# Malom

Nine Men's Morris as a teaching instrument — a hotseat and computer opponent that grade your moves as you play, in Hungarian.

What the game is and what its terms mean is in [`CONTEXT.md`](CONTEXT.md); the decisions behind the design are in [`docs/adr/`](docs/adr/).

The site is at <https://secsaba.github.io/malom/>, deployed from `main` by [the CI workflow](.github/workflows/ci.yml).

## Running it

Everything below assumes you are inside the dev shell (see [Development environment](#development-environment)).

```sh
pnpm install     # once, and whenever pnpm-lock.yaml moves
pnpm dev         # the site on http://localhost:5173/malom/
```

| Command          | What it does                                                     |
| ---------------- | ---------------------------------------------------------------- |
| `pnpm lint`      | ESLint, including the module boundary below                       |
| `pnpm typecheck` | `tsc --noEmit`                                                    |
| `pnpm test`      | The fast suite (Vitest) — everything that needs no browser        |
| `pnpm e2e`       | The browser suite (Playwright) against the production build       |
| `pnpm test:slow` | The slow suite (Vitest) — the engine's strength, played out       |
| `pnpm tune`      | The tuning harnesses — minutes of self-play, and their tables     |
| `pnpm build`     | Typecheck, then the production build into `dist/`                 |
| `pnpm preview`   | Serve `dist/` on http://localhost:4173/malom/                     |

CI runs the first four on every push and pull request, inside this same dev shell. A green run on `main` deploys `dist/` to GitHub Pages.

The last two play games, at the depths the opponent really plays at, so both are minutes rather than milliseconds. `pnpm test:slow` asserts that Mester still beats Kezdő by a wide margin and still scores the empty board as level, and runs in CI on `main` rather than on every pull request. `pnpm tune` is not a check at all: it plays games and prints the tables that settle a number, and is run by hand when one of them is being changed. It holds two harnesses, and either can be run on its own — `pnpm tune -t grades`, `pnpm tune -t mirror`. The gauntlet plays candidate weight sets off against each other; the calibration plays a corpus of novice games and reads the grade's bands off what those moves lost.

Both are worth reading [`docs/tuning/weights.md`](docs/tuning/weights.md) before touching — it records the run that settled the current weights, and why the solved-game draw the engine cannot hold is documented there rather than asserted here. [`docs/tuning/grades.md`](docs/tuning/grades.md) does the same for the grade's bands.

`pnpm e2e` needs a browser the first time — see [Playwright browsers](#playwright-browsers).

## How the code is laid out

```
src/
├── engine/    rules: the board, legal moves, mills, captures, endings, draws
├── ai/        search, evaluation, and the self-play harness the weights were tuned with
├── opponent/  the computer as a player: its four difficulties, and the thread it thinks in
├── teaching/  what the engine has to say about a move: the hint, the grade,
│              the patterns it detected and the reason it gives for them
├── session/   one game, played through intents — what the interface talks to,
│              and the plain data storage keeps a game and the settings as
├── strings/   every user-facing string, Hungarian for now
└── ui/        React components and their geometry
```

`src/ui` talks to `src/session`, which turns taps into the whole moves `src/engine` plays; `src/ai` searches those same moves, so the move the computer chooses and the move a player taps out go through one set of rules rather than two. `src/teaching` asks that same search what it would play, at full strength whatever difficulty the computer is playing at, so the hint a player is given and the move the computer makes can never come from two different opinions ([ADR-0001](docs/adr/0001-one-engine-plays-hints-and-grades.md)). The sentence beside a grade is generated only from a pattern the engine positively detected in the position — never from a plausible-sounding story it cannot substantiate ([ADR-0003](docs/adr/0003-teaching-reasons-come-only-from-detected-patterns.md)); the catalogue of them is closed, and adding one means a detector plus a sentence per language. The dependency never runs the other way, and none of `src/engine`, `src/ai`, `src/opponent`, `src/teaching` or `src/session` may import React, touch the DOM, or read the strings module — that is [ADR-0002](docs/adr/0002-engine-has-no-ui-dependencies.md), and `pnpm lint` fails the build when it is broken. The rule lives in [`eslint.config.js`](eslint.config.js); [`tests/unit/engine-boundary.test.ts`](tests/unit/engine-boundary.test.ts) lints deliberately-bad fixtures to prove it still bites.

A game and the settings survive a reload in the browser's own storage, which is the whole of this app's memory ([ADR-0004](docs/adr/0004-static-site-no-backend.md)). A game is written down as the moves played in it and read back by playing them again, so the rules rebuild the position, the draw counts, the move list and the history a takeback walks — and a stored game whose moves the rules do not allow is turned away rather than restored. `src/session/saved-game.ts` holds the shape and the replay as plain data; `src/ui/storage.ts` is the one place that touches storage.

Each of the board's 24 points is a button rather than a shape with a click handler: it takes focus, it answers Enter and Space, and it announces its coordinate and its state. Every state also carries a shape and not only a colour, the two sides are told apart by lightness rather than by hue, and nothing is said by movement alone — that is [ADR-0006](docs/adr/0006-every-point-is-a-control-with-a-shape.md), and later interface work maintains it rather than re-adding it.

The page is one screen wherever the board fits on one. The board fills the width of a phone, is drawn to fit whatever height is left, and is never drawn below the size at which a point is still a fingertip wide — where the room runs out the page scrolls rather than the board shrinking out from under the finger; everything beside it — teaching, the move list, the summary, the settings — is the panel, which stands next to the board on a screen wide enough for two columns and folds down to a handle on one that is not. Whose turn it is and the question asked before a blunder stay out of it either way, because a question nobody can see is a game that reads as stuck. That is [ADR-0007](docs/adr/0007-the-page-is-one-screen.md), and `tests/e2e/responsive.spec.ts` holds it to it.

The same lint pass rejects user-facing text written into a component, so the strings module stays the one place text lives and the English translation stays a data change.

## Development environment

The toolchain is defined by [`flake.nix`](flake.nix) and pinned by `flake.lock`, so every checkout gets the same versions. No part of it is installed by hand.

You need [Nix](https://nixos.org/download/) with flakes enabled (`experimental-features = nix-command flakes` in `nix.conf`).

**With direnv** — the shell loads on `cd` and unloads on the way out:

```sh
direnv allow
```

**Without direnv** — an explicit subshell:

```sh
nix develop
```

Either way you get:

| Tool    | Version | Why                                       |
| ------- | ------- | ----------------------------------------- |
| Node.js | 24.18.1 | Current LTS; runs Vite, Vitest, Playwright |
| pnpm    | 11.20.0 | The project's package manager             |
| git     | 2.54.0  |                                           |
| gh      | 2.97.0  | The issue tracker is driven through `gh`  |

Check the shell is live with:

```sh
nix develop --command node --version   # v24.18.1
nix flake check                        # builds the toolchain and asserts the pinned Node version
```

`nix flake check` covers `aarch64-darwin` (the maintainer's machine), `x86_64-linux` (GitHub Actions runners) and `aarch64-linux` (ARM runners). It only *builds* the toolchain for the system you run it on; pass `--all-systems` to evaluate the rest.

### Playwright browsers

Playwright downloads its own browsers rather than taking them from nixpkgs, so the binaries always match the `@playwright/test` version in `package.json` — a nixpkgs `playwright-driver.browsers` would pin them separately and drift. Install them once per machine, from inside the shell:

```sh
pnpm exec playwright install          # macOS, and Linux where the system libs are present
pnpm exec playwright install --with-deps   # Ubuntu CI runners
```

They land in `$PLAYWRIGHT_BROWSERS_PATH` (`~/.cache/ms-playwright` unless you set it), which the dev shell exports.

This works on macOS and on ordinary Linux distributions such as the Ubuntu Actions runners. It does *not* work on NixOS, where downloaded binaries won't run against the system linker; a NixOS contributor should point `PLAYWRIGHT_BROWSERS_PATH` at `pkgs.playwright-driver.browsers` instead.

### Changing the toolchain

Edit `flake.nix`, then:

```sh
nix flake update      # move the nixpkgs pin forward
nix flake check       # confirm the shell still builds
```

If the pin moved Node, `nix flake check` fails on purpose: bump `nodeVersion` in `flake.nix` to the new version, then update the table above. The other three tools aren't asserted, so they drift silently — refresh their rows by hand.

Commit `flake.lock` alongside `flake.nix` — an unpinned change isn't reproducible. New files must be `git add`ed before Nix can see them: an untracked `flake.nix` is invisible to flake evaluation.
