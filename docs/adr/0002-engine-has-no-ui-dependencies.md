# The rules engine and search have no UI dependencies

`src/engine` (rules, legal moves, mill and capture logic, phase transitions, draw conditions) and `src/ai` (search and evaluation) import nothing from React, the DOM, or the strings module. They are pure TypeScript over plain data. `src/ui` depends on them; they never depend on it. A lint rule fails the build if that direction is violated.

`src/session` — the game session facade, which is the only thing `src/ui` addresses — sits on the engine's side of that boundary and under the same lint rule. It is the module the interface is most tempted to let leak: it is where a Hungarian sentence or a `localStorage` call would feel natural. It returns the phase, the pending capture and the legal points as data instead.

## Consequences

The rules are unit-testable without rendering anything, and the search can run inside a Web Worker without dragging UI code across the boundary — the reason it can stay responsive at high difficulty. It also means the engine cannot produce user-facing text: it returns patterns and evaluations as data, and `src/ui` turns those into Hungarian or English sentences. The lint rule is the load-bearing part of this decision. Without enforcement the boundary erodes on the first convenient import, and by then the worker and the tests have both quietly broken.
