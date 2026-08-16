# Malom

A web implementation of Nine Men's Morris built to turn a novice into a strong player: two people can play on one device, or one person can play the computer with a teaching mode that suggests moves and grades the ones already played.

The canonical language below is **English** — it is the language of the code and of these docs. The default user interface language is **Hungarian**, so each term also records the Hungarian surface form used in the strings module. Those two must not drift: if a concept is renamed here, its Hungarian string is renamed with it.

Hungarian forms are taken from published Hungarian rule texts where one exists. The few marked _(coined)_ have no established Hungarian term and were invented for this project.

## Rules and board

**Board**:
The surface the game is played on: 24 points joined by 16 lines, drawn as three nested squares with a spoke joining the middle of each of their sides.
_Hungarian_: malomtábla
_Avoid_: grid, table

**Point**:
One of the 24 positions on the board where a piece can stand.
_Hungarian_: csomópont
_Avoid_: node, square, cell, spot

**Coordinate**:
A point's name: a **file** letter a–g and a **rank** digit 1–7, read off the 7×7 grid the board is drawn on. Files run left to right, ranks bottom to top, so the outer square's corners are a1, g1, a7 and g7 and the empty middle is d4. Coordinates are notation rather than language — they read the same in Hungarian and in English — so they are the one piece of visible text that does not come from the strings module.
_Hungarian_: koordináta (there is no Hungarian surface form for _file_ and _rank_: nothing shows those words, only the letters and digits themselves)
_Avoid_: address, square name — and for _file_, the Hungarian **vonal**, which is already taken by Line

**Line**:
A set of three points that lie in a straight row on the board — the only shape a mill can occupy. There are 16 of them.
_Hungarian_: vonal
_Avoid_: row, triple

**Intersection**:
A point with four neighbours. The four of them are the most valuable points on the board.
_Hungarian_: kereszteződés
_Avoid_: junction, crossroads

**Piece**:
One of a player's nine playing tokens.
_Hungarian_: bábu
_Avoid_: bean, man, stone, counter, token — and in Hungarian, korong and figura, both of which appear in rule texts but are less general than bábu

**Piece in hand**:
A piece a player has not yet placed. A player leaves the placing phase when they have none left.
_Hungarian_: le nem rakott bábu _(coined)_
_Avoid_: reserve, pool, unplaced piece

**Mill**:
Three pieces of one colour occupying a line. Closing one entitles the player to a capture.
_Hungarian_: malom
_Avoid_: row, three-in-a-row

**Potential mill**:
A line holding two pieces of one colour with its third point empty — one move away from a mill.
_Hungarian_: nyitott malom _(coined)_
_Avoid_: half mill, open mill, mill threat

**Fork**:
Two potential mills sharing a piece, so the opponent can only block one of them.
_Hungarian_: kettős fenyegetés
_Avoid_: double mill, double threat — and in Hungarian, **kettős malom**, which in common usage means closing two mills with one move, a different thing entirely

**Running mill**:
A mill positioned so that one piece can step out and back again, closing the mill on every second move.
_Hungarian_: csikicsuki
_Avoid_: double mill, swinging mill, open-and-shut mill — and in Hungarian, csukogatás and the hyphenated csiki-csuki, both attested but not the form this project uses

**Capture**:
Removing one opponent piece, earned by closing a mill. A piece inside a mill may only be captured when every opponent piece is inside a mill.
_Hungarian_: levétel (verb: levesz)
_Avoid_: take, remove, kill, eat — and in Hungarian, ütés, which belongs to chess and draughts, not to malom

**Blocked**:
Describes a piece with no adjacent empty point, or a player with no legal move at all — the latter loses the game.
_Hungarian_: beszorult
_Avoid_: stuck, trapped, immobilised

**Placing phase**:
The opening stage, in which players alternately put their nine pieces onto empty points.
_Hungarian_: lerakás
_Avoid_: phase one, opening, drop phase

**Moving phase**:
The stage after both players have placed all nine pieces, in which a piece slides to an adjacent empty point.
_Hungarian_: lépegetés
_Avoid_: phase two, midgame, sliding phase

**Flying phase**:
The state a player enters on being reduced to three pieces, in which their pieces may jump to any empty point. Reaching two pieces loses the game.
_Hungarian_: ugrálás
_Avoid_: phase three, endgame, jumping phase

**Move**:
One player's complete turn, including the capture it may earn.
_Hungarian_: lépés
_Avoid_: turn, ply, action

**Arrival**:
Half a move: a piece coming to rest on a point, whether out of a hand or off another point, before the capture the mill it closed may earn. The rules have no use for the halves — a move is played whole — but an interface does, because a player taps the destination and then taps the piece to take, and between the two taps an arrival is where the game stands.
_Hungarian_: none — nothing in the interface words it; the board shows the piece where it landed
_Avoid_: drop, landing, placement — the last of those being one kind of arrival rather than the word for both

**Selection**:
The piece a player has picked up and not yet moved. Picking one up commits to nothing: tapping away from its destinations puts it down again, so a selection is part of the rules rather than of any one interface.
_Hungarian_: none — nothing in the interface words it; the board shows it
_Avoid_: active piece, held piece, highlight

**Position**:
Which side, if any, stands on each of the 24 points. It is the board and nothing else: whose turn it is, the phase and the pieces in hand are asked alongside it rather than being part of it — though a draw by repetition needs all four to agree before it counts two positions as the same one.
_Hungarian_: állás
_Avoid_: state, board state, layout

**Result**:
How a game ended: which player won and which of the two endings ended it — the loser reduced to two pieces, or blocked — or, where neither player could win it, that it was drawn. Both endings are named after the state the loser was left in rather than after the winning move. A game still being played has no result.
_Hungarian_: eredmény
_Avoid_: outcome, verdict, score — and _reason_ for the ending, a word this glossary keeps for the sentence behind a grade

**Draw**:
A game that ends with no winner, on one of two conditions: the same position coming up for the third time, or fifty moves by each player without a capture. Neither is a question a single position can answer, so both are counted as the game is played.
_Hungarian_: döntetlen
_Avoid_: tie, stalemate — the second belonging to chess, where it names a position this game decides by blocking instead

**Quiet move**:
A move that captures nothing, and so takes the game one closer to the fifty each player is allowed. A placement starts the count again in the way a capture does: a piece coming out of a hand is progress, and the fifty are fifty of the moving phase's own.
_Hungarian_: none — nothing in the interface words it; only the draw it ends in is shown
_Avoid_: idle move, empty move, non-capturing move

## Playing the computer

**Engine**:
The component that searches positions and evaluates them. The same one plays the computer's moves, produces hints, and grades human moves.
_Avoid_: AI, bot, solver

**Opponent**:
The computer as a player, configured at one of four difficulties.
_Hungarian_: gép
_Avoid_: computer player, CPU, bot

**Difficulty**:
How strongly the opponent plays — a combination of how deeply it searches and how often it deliberately picks a weaker move.
_Hungarian_: nehézség (Kezdő, Haladó, Erős, Mester)
_Avoid_: level, strength, skill

## Teaching

**Teaching mode**:
The setting that switches on hints, grading, and takebacks. It is independent of who the players are, so two humans can also play with it on.
_Hungarian_: tanulómód
_Avoid_: tutorial, coach mode, practice mode

**Hint**:
The engine's preferred move, shown on the board because the player asked for it.
_Hungarian_: tipp
_Avoid_: suggestion, tip, advice

**Grade**:
The verdict attached to a move once played, on a five-step scale from Best to Blunder.
_Hungarian_: értékelés (Legjobb, Jó, Pontatlan, Hiba, Súlyos hiba)
_Avoid_: score, rating, mark

**Eval loss**:
How much worse the played move is than the engine's preferred move. The grade is derived from it.
_Avoid_: delta, centipawn loss, error margin

**Pattern**:
A named tactical feature the engine can positively detect — a fork created, a mill let through, a piece left blocked. Patterns are the only permitted source of a reason.
_Hungarian_: mintázat
_Avoid_: motif, insight, concept

**Reason**:
The plain-language sentence explaining a grade, generated from the patterns that fired. Where no pattern fires, the reason says only what the evaluation supports.
_Hungarian_: indoklás
_Avoid_: explanation, commentary, analysis

**Blunder warning**:
The optional, off-by-default intervention that asks for confirmation before a player commits a move graded as a blunder.
_Hungarian_: figyelmeztetés hiba előtt
_Avoid_: alert, nag, safety net

**Takeback**:
Returning the game to the player's previous decision point so they can try a different move.
_Hungarian_: visszalépés
_Avoid_: undo, rewind, retry
