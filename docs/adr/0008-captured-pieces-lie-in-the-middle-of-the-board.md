# Captured pieces lie in the middle of the board

A capture used to be the one thing that happened on the board and left no mark on it. The piece that moves arrives — it travels in, and it keeps a ring until the next move — but the piece it took simply stopped being drawn, between one paint and the next, with nothing at the point it left and nothing said about it anywhere. Against the computer that is the half of its move a player never sees, because they are watching the piece that moved.

A capture now leaves two marks, and neither of them is an animation.

The point the piece was taken from keeps a **ghost**: the outline of the piece that stood there, in that piece's own ink, on the point it left. It lives exactly as long as the last-move ring does — both belong to the same move, and the next arrival replaces both — so the board says *this arrived here, that left there* about one move and then forgets the whole of it. A ghost that outlived the ring would start reading as a state of the board rather than as news about a move.

The captured piece itself goes to a **heap in the middle of the board**. Nine Men's Morris never uses the centre: d4 is a hole in the board and the square around it is the one part of the drawing that holds nothing. That is where the pieces go on a wooden board on a table, and it is where they go here. Each side has its own heap and each heap holds one colour — a side's own pieces, the ones it has lost. Piling them as the capturer's trophies was the first shape tried and was rejected: a heap of them measures how much of a side is gone, and a side runs out of pieces in two ways at once, so splitting its losses onto the far side of the board from its hand measures the same thing from the wrong end.

The piece travels from its point to its heap when it is taken — the same `travelledFrom` arithmetic the arrival animation already uses, in the same coordinate space, because the heap never leaves the viewBox. Like the arrival's, that animation is the lesser half: `prefers-reduced-motion` turns it off and leaves the ghost and the heap exactly where they are.

Trophies are drawn flat — no dome, no shadow, a plain disc with a hairline ring — where a piece on the board is a lit dome standing on it. The board's pieces stand up and catch the light; the taken ones lie face-down in a pile. That distinction survives being small, which is the whole requirement: on the narrowest screen the site supports a trophy is about fifteen pixels across.

## Considered options

**Columns of pieces flanking the board** was the shape asked for, and the measurements killed it. Below 60rem the board is the full width of the screen and the gutter comes out of the board specifically so a target clears the 44px a fingertip needs (ADR-0007); a column beside the board is width off every one of the 24 targets. At 393px a viewBox widened enough to hold two columns would draw targets at 42px.

**Strips above and below the board** survives a portrait phone and nothing else. The room around the board was measured at eight screens: a Pixel 5 leaves 222px of unused height and a tall phone 303px, but the 320px phone leaves 12px, a 768px tablet leaves 20px, and a landscape phone, a short desktop and a wide desktop leave none at all — those last three leave 531px, 442px and 496px of unused *width* instead. `preserveAspectRatio` scales to whichever axis is tighter, and the tight axis is not the same axis on every screen, so no single viewBox holds a tray on all of them. The room is real and it is not in one place.

**Trays as DOM elements that follow the room** — stacked on a phone, columns on a desktop, gone on the two screens with neither — is the option that would work everywhere, and it is the fallback if the middle turns out too cluttered to read. It was not taken because it costs a breakpoint, costs the flight animation its coordinate space (the piece would have to cross out of the SVG into the document, which means measuring rather than arithmetic), and spends height off the board on exactly the screens ADR-0007 says have none to spare. The middle of the board is the same answer on all eight screens and costs nothing from that budget.

**Showing the pieces in hand in the heaps too** was rejected on the measurements as well. The centre is clear of drawn ink in about 150 of the board's 720 units, which is 66px on the narrowest phone. Two heaps of up to sixteen discs fit there only as crumbs; two heaps of at most seven fit comfortably. The pieces in hand already have a representation that works — the numeral beside the board — and captured pieces had none at all, which is the thing this changes. The free space goes to the thing with no other home.

## Consequences

The session grows one recorded field and one derived one. `Recorded.lastCapture` is set wherever `lastArrival` is and cleared the same way, because the two are halves of one move; it carries the side as well as the point, since the ghost is drawn in the ink of the piece that was taken and the board no longer holds it to ask. `GameState.captured` is *derived* rather than accumulated — a side's losses are the nine it started with, less its hand, less what it holds on the board — which is what makes a Review free: `lookingBackAt` already replaces the position and the hand, so the heaps rewind with the board without a second tally to keep in step. A Takeback is the same mechanism and needs nothing of its own.

The board announces the capture. The status region reads out that a piece was taken and from where, which it never did before: it said a capture was *owed* and never that one had been *taken*. A player working the board by keyboard had the identical problem the ghost solves for a player watching it, and the ink alone would have left them with none of it. The point's own accessible name carries the ghost too, so a point a piece was just taken from says so when focus reaches it.

Later interface work maintains this. The heaps are drawn off `GameState.captured` and never off a count of their own; a mark at a vacated point is a shape and not a colour, as every mark on this board is (ADR-0006); and the middle of the board is now spoken for, so anything else that wants to live there is competing with this rather than finding it empty.

`tests/e2e/capture.spec.ts` holds the acceptance: a capture leaves a ghost at the point it took from, the ghost dies with the next move, the heap grows on the side that lost the piece, a review rewinds both, and the reduced-motion board still carries every one of those marks with no animation at all.
