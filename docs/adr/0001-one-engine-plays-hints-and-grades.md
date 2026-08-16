# One engine plays, hints, and grades

The opponent, the hint feature, and the move grading are all served by a single engine rather than by separate components tuned for each job. A hint is the engine's best move, a grade is the eval loss between that move and the one played, and the opponent's move is that same search with a difficulty setting applied on top.

## Considered options

A common shortcut is a cheap heuristic opponent plus a separate, simpler "advisor" for teaching. We rejected it: the teaching quality is then capped by whichever component is weaker, and the two can disagree — the app would recommend a move its own opponent would not play, which is visibly incoherent to the learner.

## Consequences

Engine strength is not a nice-to-have that can be deferred; it is a correctness requirement for the teaching mode, because a weak engine grades good moves as mistakes. Difficulty must therefore weaken the opponent *at the point of move selection* (shallower search, a tunable rate of deliberately picking a near-best move) and must never weaken the engine used for hints and grades — those always run at full strength regardless of the difficulty the human chose to play against.
