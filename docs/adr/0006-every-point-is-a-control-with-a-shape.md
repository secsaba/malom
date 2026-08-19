# Every point is a control, and every state of one has a shape

Each of the board's 24 points is a button: it is in the tab order, it takes Enter and Space, and it carries an accessible name giving its coordinate and its state. Everything else the board draws — the lines, the pieces, the rings, the coordinate labels — is hidden from assistive technology, because all of it is one of those states said again in ink. The marks and the words come off one `PointState` in `src/ui/point-state.ts`, so the board cannot draw a state it does not say.

Every state also carries a shape and not only a colour: a dashed ring on a point the side to move may act on, a solid ring round the piece picked up, the hint's own ring outside the piece where nothing else is drawn, and a small ring inside the piece that moved last. The two sides are told apart by lightness — a cream dome and a near-black one — and never by hue. Movement is only ever the second way something is said: the piece that moved last is marked as well as animated, and `prefers-reduced-motion` turns the animation off and leaves the mark.

## Considered options

Roving focus with arrow keys is the usual ARIA pattern for a grid and would be fewer keystrokes than tabbing to the far corner. It was not taken: the board is drawn on a 7×7 grid with 25 holes in it, so arrowing across one is a guess about which point the player meant, and the guess would live in the interface rather than in the rules. Tab guesses about nothing, and the board's own order — up each file, files left to right — is the order the engine already lists its points in.

Giving the two sides different shapes as well as different lightness was considered and rejected. It would undo the domed, ringless pieces that separate a piece from the board's structure, and lightness is not a hue: a cream piece and a near-black one are the one distinction no colour vision is needed for.

Announcing a point as "your piece" or "the opponent's" was rejected too. Two people share one device, so whose piece a bábu is changes with whose turn it is, and a point that answered differently depending on who was listening would be the only thing on the board that did.

## Consequences

Later interface work maintains this rather than re-adding it. A new state of a point means a field on `PointState`, a word in the strings module, and a mark that is a shape — a colour alone is not a state the board is allowed to have. A new control on the board is a control and not a shape with a click handler. `tests/e2e/keyboard.spec.ts` plays a move and its capture with Tab and Enter alone and never with `locator.focus()`, so focus the test uses is focus a player could have reached; `tests/e2e/board.spec.ts` holds the reduced-motion and shape checks.

The cost is 24 tab stops before the rest of the page. That is the price of the board being reachable at all without a pointer, and it is paid by every player rather than only the one who needs it — a skip link would buy it back, and is worth revisiting if the page ever grows controls a player reaches for more often than the board.
