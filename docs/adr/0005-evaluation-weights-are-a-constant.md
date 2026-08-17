# The evaluation's weights are a constant, not a setting

There is one weight set. It is `DEFAULT_WEIGHTS` in `src/ai/evaluation.ts`, it is measured by the self-play gauntlet rather than guessed, and it is the same set for every difficulty, every hint and every grade. The search takes weights as an argument so that the gauntlet can play one set against another; nothing above the search does, and no weights cross the session facade, the opponent, or the worker.

## Considered options

The parent spec sketched the game session facade as taking evaluation weights through its constructor, "which is what makes self-play and weight tuning possible". It turned out not to be what makes it possible. The harness that tunes the weights is headless: it plays a function from a game to a move against another such function, and the shortest path from a weight set to one of those is the search, which already takes them. Threading weights from the facade down through the opponent and across the worker boundary would have added a setting to four modules to serve a caller that never uses any of them — dead parameters that every later reader has to rule out.

Keeping it a constant also keeps a promise ADR-0001 makes. If weights were a setting, something would eventually set them: a difficulty weakened by a blunted evaluation, a teaching mode grading against different numbers from the ones the opponent plays by. Both are exactly the divergence between playing and teaching that ADR-0001 exists to prevent, and neither is possible when there is only one set of numbers in the program.

## Consequences

Changing the weights is a code change, measured and reviewed like any other: the gauntlet plays candidates against the shipping set, the winner is written into the constant, and the run is recorded in `docs/tuning/weights.md`. There is no way to try other weights at runtime, and nothing in the interface offers any.

Difficulty stays what ADR-0001 says it is — shallower search and a rate of deliberately picking a near-best move — and cannot quietly become a second, worse evaluation.

If a later ticket genuinely needs two weight sets live at once, this is the decision to reopen. It would mean a real caller, and the argument the search already takes is where it would start.
