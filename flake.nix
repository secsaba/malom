{
  description = "Malom — development environment for the Nine Men's Morris teaching game";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-26.05";
  };

  outputs =
    { self, nixpkgs }:
    let
      # The maintainer's machine is aarch64-darwin; GitHub Actions runners are
      # x86_64-linux. aarch64-linux is carried along for ARM runners. x86_64-darwin
      # is left out: nixpkgs 26.05 is the last release to support it.
      systems = [
        "aarch64-darwin"
        "aarch64-linux"
        "x86_64-linux"
      ];

      forAllSystems = f: nixpkgs.lib.genAttrs systems (system: f nixpkgs.legacyPackages.${system});

      # The version the README's table promises. Asserted below rather than read
      # off the package, so moving the nixpkgs pin fails the check instead of
      # silently leaving the README stale.
      nodeVersion = "24.18.1";

      # Everything the repo assumes is on PATH. Vite, Vitest and Playwright
      # arrive as npm dependencies of the app itself; this list is only the
      # toolchain underneath them.
      toolchain = pkgs: [
        pkgs.nodejs_24
        pkgs.pnpm
        pkgs.git
        pkgs.gh
      ];
    in
    {
      devShells = forAllSystems (pkgs: {
        default = pkgs.mkShell {
          name = "malom";
          packages = toolchain pkgs;

          # Playwright downloads its own browsers into ~/.cache/ms-playwright
          # rather than taking them from nixpkgs, so the browser binaries always
          # match the @playwright/test version in package.json. See README.
          shellHook = ''
            export PLAYWRIGHT_BROWSERS_PATH="''${PLAYWRIGHT_BROWSERS_PATH:-$HOME/.cache/ms-playwright}"
          '';
        };
      });

      # `nix flake check` builds this, so a broken shell fails the check rather
      # than only failing the next time someone enters it.
      checks = forAllSystems (pkgs: {
        toolchain = pkgs.runCommand "malom-toolchain" { nativeBuildInputs = toolchain pkgs; } ''
          export HOME="$TMPDIR"
          test "$(node --version)" = "v${nodeVersion}"
          pnpm --version
          git --version
          gh --version
          touch "$out"
        '';
      });
    };
}
