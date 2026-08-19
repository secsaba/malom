# The page is one screen, and the panel folds away on a phone

The page is exactly as tall as the viewport and never scrolls, at any width. The board and the state of play stand in a column of their own; everything else — what teaching has to say, the move list, the summary, the settings and the setup — is the Panel. On a screen at least 60rem wide the panel stands beside the board and is always open. Below that there is only room for one column, so the panel folds down to a handle at the foot of the screen and opens above it when the player asks, taking its share of the height out of the board and giving it back on the way out. Nothing is ever scrolled away to make room for anything else: what cannot fit shrinks, or scrolls inside itself.

The board is drawn to fit whatever box it is given, so one rule serves every screen. Its ground is a shape inside the drawing rather than the element's background (`GROUND_CORNER` in `src/ui/board-layout.ts`), which is what lets the box be the wrong shape without the board looking it: the drawing centres itself and the room left over stays the page's. In one column the board is uncapped and reaches both edges of the screen — the gutter comes out of the board rather than out of the finger, which is what keeps a point a fingertip wide on the narrowest phone still sold. Beside a panel it stops at 32rem and the room goes to the panel instead.

Three things are never in the panel. The board and the Status are what the game is played on. The Blunder warning is the third and the one that had to be argued: it is a question the player has to answer before the move they committed to is played, and a question behind a handle is a board holding still for no visible reason. It lives in `src/ui/BlunderWarning.tsx`, beside the board, and `src/ui/Teaching.tsx` keeps only what a player goes looking for.

## Considered options

Opening the panel over the board, as a bottom sheet usually does, was the first shape tried. It keeps the board at full size behind the sheet, which is worth nothing: the part of the board the sheet covers is the part the player cannot see either way, and a sheet that overlays needs a scrim, a scroll lock and a way out of both. The panel takes its share of the height instead, and the board is redrawn smaller for as long as it is open.

Forcing the panel open while the engine checks a move was the other way to keep the blunder warning visible. It was rejected: with the warning switched on, every committed move is checked, so the panel would open and shut on every move of the game. Moving the question out of the panel answers the same problem once, at the cost of nothing.

Asking the window how wide it is from inside a component — `matchMedia` and a piece of state — was rejected in favour of the breakpoint living only in the stylesheet. The panel is the same panel at every width, and a component that held a second opinion about which layout it was in would have its own way of being wrong about it.

## Consequences

Later interface work maintains this. A new block on the page belongs in the panel unless the game cannot go on without it being seen, and anything that grows without bound — a list, a summary — scrolls inside itself rather than making the page taller. `tests/e2e/responsive.spec.ts` holds the acceptance: the board fills the width of a phone and stays whole on it, the page scrolls in neither direction at any width from 320px up, every point's target comes out at least 44px across, a move is played by tapping twice on a touchscreen, and the panel stands beside the board with no handle at all once there is room for two columns.

The cost is that a very short window clips rather than scrolls. The panel's contents scroll inside themselves and the board shrinks first, so what a player can reach is everything they could reach before; what suffers is the board, which is drawn small before anything is cut off. A page that could scroll instead would trade that for a board that can be scrolled off the screen, which is the thing this decision exists to prevent.

The panel's own state — open or folded away — is not a Setting and is not written down. It says which of two things the player is looking at now, not how they like the game set up, and a phone that came back from a reload with the panel open would come back with the board half the size they left it.
