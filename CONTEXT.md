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

**Rematch**:
Another game against the opponent, started once one has ended, with the sides the other way round. The swap is the point of it: the opening is a different game from each side of it, and a learner who only ever plays one of them has learnt half of it.
_Hungarian_: visszavágó
_Avoid_: replay, again, new game — the last of those being any game started fresh, of which a rematch is the one kind that swaps

**Difficulty**:
How strongly the opponent plays — a combination of how deeply it searches and how often it deliberately picks a weaker move.
_Hungarian_: nehézség (Kezdő, Haladó, Erős, Mester)
_Avoid_: level, strength, skill

**Blunder rate**:
How often a difficulty plays a weaker move on purpose, counted as a share of its moves. It is nought at Mester, which is what makes Mester deterministic: the same position gives the same move.
_Hungarian_: none — nothing in the interface words it; only the difficulty it belongs to is named
_Avoid_: error rate, mistake rate, handicap

**Near-best move**:
One of the few moves the search ranked closest to the one it prefers — a shortlist, bounded both by how many moves may be on it and by how far behind the best one they may be. These are what a difficulty below Mester draws its deliberate mistakes from, weighted so that a nearly-as-good move comes up far more often than a barely-good-enough one. Both bounds are needed and neither is enough alone: the margin is what keeps a mill missed on the list and a piece handed over off it, and the count is what keeps the list short in a flat position — an empty board, where every placement scores within a whisker of every other and a margin alone would admit all 24 of them.
_Hungarian_: none — nothing in the interface words it; the board shows the move
_Avoid_: second-best move, plausible move, reasonable move

## Teaching

**Teaching mode**:
The setting that switches on hints, grading, and takebacks. It is independent of who the players are, so two humans can also play with it on. Where the player has not said either way, who is playing answers for them — off for two people sharing a device, on against the computer — and once they have said, their word carries into every game after it, as a difficulty does.
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

**Band**:
The stretch of eval loss a grade covers. The bands are what turn a number into one of the five words. There is a set of them for each phase rather than one set for the game, because the evaluation's units are not the same size in all three — a piece is worth 8 while pieces are being placed and 300 while they fly — so one set read in all three would mean three different scales wearing the same five words. Each set was placed against a corpus of played games rather than picked by intuition.
_Hungarian_: none — nothing in the interface words it; only the grade it produces is shown
_Avoid_: threshold, bucket, tier, cutoff

**Lost position**:
A position the side to move had already lost before they played anything — hopeless by the evaluation, or seen lost outright by the search. A move played in one is graded no worse than Pontatlan, whatever it lost: the mistake was made further back, and the grade would otherwise point at the wrong move. It is a ceiling and nothing else, so the best move in a lost position is still Legjobb.
_Hungarian_: none — nothing in the interface words it; only the grade it caps is shown
_Avoid_: hopeless position, dead lost, resignable — and _lost game_, which is a game with a result rather than a position still being played

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

## Measuring the engine

Nothing in this section is ever shown to a player, so none of it has a Hungarian surface form. It is the language of the harnesses that settled the engine's numbers — the evaluation's weights and the grade's bands — and of the tests that keep them honest.

**Weight set**:
The whole table of what each evaluation term is worth in each phase — eight terms, three phases, one number each. A weight set is the unit that is measured and shipped: single weights are not compared, because the terms are counted against each other and a number only means something beside the rest of its table.
_Avoid_: parameters, coefficients, config, tuning values

**Self-play**:
The engine playing the engine, with no person and no interface anywhere near it — the only way a question about how strongly it plays can be answered by games rather than by opinion.
_Avoid_: simulation, playout, rollout, auto-play

**Player**:
In self-play, a function from a game to the move it would play, and nothing more. A weight set searching at a given depth is one, and so is a difficulty; the harness cannot tell them apart, which is why the same runner measures both.
_Avoid_: agent, bot, engine instance — the last of those being the whole component rather than one way of asking it a question

**Opening**:
The moves a self-play game is started from, drawn at random rather than chosen, because the strongest players are deterministic and two of them left to themselves play one game over and over. It is not the placing phase: an opening is a handful of moves, and the phase runs to eighteen.
_Avoid_: book, start position, setup

**Match**:
A run of self-play games between two players, each opening played twice with the sides swapped. The swap is what makes it a measurement of the players rather than of the openings.
_Avoid_: tournament, series, run, batch

**Scoreline**:
What a match came to, counted from the challenger's side: wins, draws, losses, and the games that ran on past the harness's move cap without ending. The last of those is reported apart from the rest, because a game nobody finished is not a game nobody won.
_Avoid_: score, record, results table

**Gauntlet**:
The tuning run itself: several candidate weight sets each played, over the same openings, against the set that currently ships. The winner is committed as the default and the table is kept, so the next person to change a weight can see what the last change was measured against.
_Avoid_: sweep, grid search, tournament

**Corpus**:
The played moves a number is settled against: every move one difficulty made over a run of self-play games, each weighed by the engine at full strength exactly as the grader weighs it. It is what a band is placed on, in the way a match is what a weight set is measured by — and it is drawn from the weakest difficulty, because the numbers it settles are read to a novice.
_Avoid_: dataset, sample, training set
