# Malom

Nine Men's Morris as a teaching instrument — a hotseat and computer opponent that grade your moves as you play, in Hungarian.

What the game is and what its terms mean is in [`CONTEXT.md`](CONTEXT.md); the decisions behind the design are in [`docs/adr/`](docs/adr/).

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
