# Tuning the evaluation's weights

The evaluation weighs eight terms in three phases — twenty-four numbers in all — and until this run every one of them was a guess. They were reasoned guesses, written down with the reasoning beside them, but nothing had ever played a game to find out whether the reasoning held. This is the run that did, the numbers it produced, and enough of how it was done to do it again.

The harness is [`src/ai/self-play.ts`](../../src/ai/self-play.ts); the run is [`tests/tuning/weights.test.ts`](../../tests/tuning/weights.test.ts); the weights it settled are `DEFAULT_WEIGHTS` in [`src/ai/evaluation.ts`](../../src/ai/evaluation.ts).

## How a run works

```sh
pnpm tune
```

**Players.** A player is a function from a game to a move and nothing else. The gauntlet's players are weight sets searching at fixed depths, playing the move the search prefers and never a weaker one on purpose: the point is to measure the weights, and a blunder rate laid over them would measure the blunders too.

**Depths.** Mester's own, per phase — four while placing, five while moving, three while flying. A set tuned at a depth nothing plays at is tuned for a player who does not exist: a term that only pays off three moves further on is worth nothing to a search that stops two moves short of it.

**Openings.** Both players are deterministic, so two of them left alone play one game and repeat it for ever. Each game therefore starts from a few moves drawn uniformly at random from the ones the rules offer — four moves, two placements each, which is enough to make the games different and short enough that neither side is handed the game before it starts.

**Pairing.** Every opening is played twice, with the sides the other way round the second time. Without that the run would measure the openings: an opening that favours light favours whoever was given light. With it, the favour is handed to both players in turn and cancels.

**Chance from a seed.** Every random number in a run comes from a seeded generator, so a run is the same run again on any machine, and a scoreline written down here can be checked rather than believed.

**A fixed baseline.** Candidates are variations of an explicit `BASELINE` constant in the tuning file, and every match is played against it. It holds the reasoned guesses this project started from. Reading it from `DEFAULT_WEIGHTS` instead would have been the obvious thing and would have quietly destroyed the record: committing a winner moves the default, so the candidates become deltas on a different table and the winning set turns into the default playing itself for a guaranteed half. Fixed, every table below comes back at any commit, from `pnpm tune` with `SEED` set to the round you want. A later round that wants to challenge what ships rather than what shipped first copies today's `DEFAULT_WEIGHTS` into `BASELINE` and starts a new record.

## The gauntlet

Run at commit `1f3fc13`, when the shipping weights were still the original guesses. Six candidates, each moving one idea rather than several so that a set which wins says which guess was wrong. 24 games each — 12 openings of four moves, every one played from both sides — at Mester's depths, seed `20260817`.

| Candidate                        |  W |  D |  L | Share |
| -------------------------------- | -: | -: | -: | ----: |
| `material-lighter-while-placing` | 15 |  1 |  8 | 0.646 |
| `threats-heavier`                | 15 |  1 |  8 | 0.646 |
| `mobility-heavier`               | 13 |  3 |  8 | 0.604 |
| `material-heavier`               | 13 |  0 | 11 | 0.542 |
| `degree-cheaper`                 | 11 |  4 |  9 | 0.542 |
| `running-mills-heavier`          | 11 |  0 | 13 | 0.458 |

Three sets beat the guesses and one lost to them. None of it is significant on its own: over 24 games the standard error on a share is about 0.10, so even 0.646 stands only 1.4 of them above parity. A run this size sorts candidates worth playing again from candidates worth dropping, and nothing more — which is the whole reason there is a second round.

**Round two**, the survivors and a combination of the two leaders, at seed `424242`:

| Candidate                        | Seed 20260817 | Seed 424242 |
| -------------------------------- | ------------: | ----------: |
| `mobility-heavier`               |         0.604 |       0.646 |
| `material-lighter-while-placing` |         0.646 |       0.604 |
| `threats-heavier`                |         0.646 |       0.417 |
| `shape-over-material`            |             — |       0.417 |

`threats-heavier` did not replicate: its first result was the openings it drew, not the weights it carried. The combination built on it went the same way. Two sets won both rounds, tied exactly on 0.625 over 48 games, so a third seed was needed to part them.

**Round three**, at seed `77777`, with a combination of the two survivors added:

| Candidate                        | Seed 77777 |
| -------------------------------- | ---------: |
| `mobility-heavier`               |      0.729 |
| `lighter-and-freer`              |      0.729 |
| `material-lighter-while-placing` |      0.479 |

The rule was fixed before the round was run: a set must be above half at every seed it was tried at, and win on total points. `material-lighter-while-placing` fell below half and was out. `lighter-and-freer` tied the leader, but it is `mobility-heavier` with the eliminated set folded in, and it had one seed of evidence to the leader's three — the tie says the mobility half is doing the work.

## What it decided

**`mobility-heavier` ships.** Above half at all three seeds, **0.660 over 72 games** — 44 wins, 7 draws, 21 losses — which is 2.7 standard errors above parity. Four numbers moved, and only four:

| Weight              | Phase   | Was | Is  |
| ------------------- | ------- | --: | --: |
| `mobility`          | placing |   2 |   5 |
| `blocked`           | placing | −10 | −18 |
| `mobility`          | moving  |   3 |   8 |
| `blocked`           | moving  | −12 | −22 |

Everything else is exactly as it was, and that is a result too: heavier material, lighter material, heavier threats, heavier running mills and a cheaper intersection premium were all played for and none of them survived a second seed. The guesses were mostly good ones. The two they got wrong were the two smallest numbers on the moving-phase table.

The evidence pointed here before the gauntlet did. Of the fourteen decisive games in the Mester-against-Mester run below, seven ended in **blocked** — the loser shut in with no legal move at all. A side is not shut in by one bad move but by a dozen that each looked fine to an evaluation pricing a destination at three points against a piece at a hundred. Raising exactly those two numbers is the change the games asked for.

**The confirmation.** A set chosen by winning matches can always have been chosen by the openings it happened to draw, so the winner played the set it replaced once more at seed `31415926`, which had no hand in choosing it: **12 wins, 3 draws, 9 losses, 0.563**. It is the narrowest of the four results and it is the only one that was not selected for, which is exactly why it is the one to believe. That match is a committed test, and the one claim in `tests/tuning/weights.test.ts` that can fail. Its reach is worth being exact about: `pnpm tune` is run by hand and no part of CI runs it, so it catches a weight change while whoever is making it is running the gauntlet, not afterwards. And because it measures against the fixed baseline, a second round of tuning that moves that baseline turns this from a live check into a record of the first round.

**What it did to the engine's play.** The change did what it was picked to do, and something else besides. Over eighteen mirror games from near-best openings, before and after:

|                            | Before | After |
| -------------------------- | -----: | ----: |
| Lost by being shut in      |   7/14 |  4/17 |
| Drawn                      |   4/18 |  1/18 |

Being harder to shut in halved the ending the tuning was aimed at. It also made the engine *more* decisive rather than more drawish: a side that keeps its room converts more of the positions it used to shuffle away. That is a gain in strength and it is not a gain in accuracy — see below.

## Mester against Mester, and what the games actually say

Ticket #9 asks for a sanity check alongside the tuning: malom is a draw with perfect play, so Mester against Mester should draw reliably, and a Mester that regularly beats a copy of itself is evidence of a bug rather than of strength. The check was run. It does not say what the ticket expected, and the numbers are here rather than smoothed away.

Every number in this section was measured with the weights that were shipping **before** the tuning — the original guesses — because that is the engine the question was asked about. What the tuned weights do to these numbers is at the end of the section, and it is not an improvement.

**From the position the game starts in, the pre-tuning engine drew itself**, by repetition, in 52 moves, deterministically. The tuned engine does not: it wins that game as light in 47 moves. Neither fact is asserted anywhere — see the knife-edge below for why.

**From anywhere else, neither engine draws.** Two ways of perturbing the start were measured, six distinct games each — a mirror match plays each opening twice with the sides swapped, and since both players are the same deterministic function, the two halves are the same game and the pair is worth one game, not two.

Openings drawn uniformly from the legal moves:

| Opening moves | 0 | 1 | 2 | 3 | 4 | 6 |
| ------------- | - | - | - | - | - | - |
| Drawn, of 6   | 6 | 0 | 3 | 0 | 0 | 0 |

Openings drawn from Mester's own near-best shortlist — positions it would willingly enter, which is the fairest reading of the ticket's intent:

| Opening moves | 2 | 4 | 6 |
| ------------- | - | - | - |
| Drawn, of 6   | 1 | 2 | 1 |

So: three drawn games in thirty-six from random openings, four in eighteen from openings Mester chose itself. It beats itself about four times in five.

**It is not the search depth.** The same six near-best two-move openings, played at four different depths:

| Depths (placing/moving/flying) | 2/2/2 | 3/3/3 | 4/5/3 (Mester) | 5/6/4 |
| ------------------------------ | ----- | ----- | -------------- | ----- |
| Drawn, of 6                    | 4     | 0     | 1              | 1     |

Looking a move deeper than Mester does not bring the draw back. The four draws at depth two are the opposite of accuracy: a two-move horizon cannot construct anything, so the games shuffle into the fifty-move rule. Everything from depth three up is decisive.

**What it is, then.** The evaluation, which is what this ticket tunes — and the endings hint at where. Of the fourteen decisive near-best games, seven ended in **blocked** and seven in **reduced**: half the time the loser was shut in with no legal move at all rather than ground down piece by piece. A side is not shut in by one bad move; it is shut in by a dozen moves that each looked fine to an evaluation pricing a destination at three points against a piece at a hundred. Half the losses arriving that way is a lot of weight resting on the two smallest numbers in the moving-phase table — which is what sent the gauntlet after them, and what it found.

**The start-position draw is a knife-edge, not a property.** It was asserted in the slow suite for a while, and then it was measured. Ten weight sets were played from the start position against themselves, and two of them drew:

| Weight set                                          | Start-position mirror game   |
| --------------------------------------------------- | ---------------------------- |
| The original guesses                                 | draw by repetition, 52 moves |
| Placing-phase mobility only                          | draw by repetition, 39 moves |
| Mobility 3/5, blocked −12/−14 (the gentlest change)  | light wins in 85 moves       |
| Mobility 4/6, blocked −16/−18                        | light wins in 49 moves       |
| The tuned set                                        | light wins in 47 moves       |
| …and five others touching the moving phase           | decisive, every one          |

Moving mobility from 3 to 5 — two points, on a table where a piece is a hundred — turns a 52-move draw into a win in 85. Every set that touches the moving phase at all loses it. So the drawn game says whether one deterministic line happens to repeat; it does not say the engine is sound, and a gate that eight sets in ten fail would have rejected the tuning for the crime of being tuning.

It was therefore not made an acceptance gate, and the tuned weights ship. What the slow suite keeps is the part of the sanity check that survives contact with the evidence: **the engine must not think the game it is about to start is anything but level.** The empty board is the same board for both players, so an engine that scores it as won for either side, or that leans to a side at all, is broken — and that is caught exactly, in a second, rather than statistically over an hour. It measures as nought.

**None of this is a bug.** The harness is symmetric — every mirror pair split exactly, 8–8 and 6–6 and 3–3 — the results repeat run for run, and the decisiveness survives a search a move deeper than Mester's. What it means for the product is that Mester is a strong opponent for a learner rather than perfect play, and that the next real gain is another evaluation change rather than a deeper search. That is a ticket, not a defect: a perfect-play endgame database is explicitly out of scope, so a better evaluation is the only route to holding theoretical draws, and it deserves a gauntlet of its own.

## The strength regression

```sh
pnpm test:slow
```

Two claims, in `tests/slow/strength.test.ts`, both against the weights that ship. It runs in CI on `main` and on demand, not on every pull request, and it does not gate the deploy — a weakened engine is something to find out about and fix, not a reason to stop shipping the rest of the site.

| What it asserts                                          | Measured        | Threshold          |
| -------------------------------------------------------- | --------------- | ------------------ |
| Mester beats Kezdő over 16 games, 8 openings, both sides  | 16–0–0, 1.000   | share ≥ 0.85       |
| Mester scores the empty board as level                    | exactly 0       | within a mill (34) |

The first threshold has a wide cushion on purpose. A perfect score leaves nowhere to fall before the test would trip on ordinary noise, and this run is 16 games: at 0.85 it takes a genuinely weakened Mester — losing or drawing five of sixteen to a difficulty that searches one move deep and blunders half the time — before it fires. The second has no meaningful noise to cushion against, so its cushion is the smallest weight on the board that anyone would notice.

Both numbers were measured before they were written down, and the thresholds were set below the measurements rather than the measurements being fitted to thresholds. If a later change moves them, move the threshold only when the new number is *better* than the old one. A threshold lowered so a run goes green is a regression test that has stopped testing.

## Doing it again

1. Add candidates to `CANDIDATES` in `tests/tuning/weights.test.ts`, one idea per set, with the reasoning in the `idea` string — a set that wins should say which guess was wrong.
2. `pnpm tune`, and keep the table it prints.
3. **Play the leaders again at a seed you have not used.** This is the step that matters most and the one it is most tempting to skip. In the run above, the joint top scorer of round one — `threats-heavier`, at 0.646 — came back 0.417 at the next seed. One round of 24 games sorts candidates worth replaying from candidates worth dropping, and nothing else: the standard error on a share over 24 games is about 0.10. Fix the rule before you look at the result. The rule here was *above half at every seed, and best on total points*.
4. Write the winner into `DEFAULT_WEIGHTS`, then run the confirmation match at the bottom of the tuning file — the shipping set against the set it replaced, at a seed that had no hand in choosing it. It is a committed test, so it will fail loudly if a later change quietly undoes this one.
5. `pnpm test:slow`, which measures the strength regression against the new weights. Move a threshold only if the new number is better than the old one; a threshold lowered to make a run pass is a regression test that has stopped testing.
6. Record the run here: the commit, the seeds, the counts, the tables, and what was decided — including the candidates that lost. Half the value of the run above is knowing that heavier material, lighter material, heavier threats, heavier running mills and a cheaper intersection premium were all tried and none of them survived.

One practical note: a whole gauntlet played one match at a time is half an hour. Each candidate is its own test, so a machine with cores to spare can run them at once, one process each:

```sh
pnpm tune -- -t material-heavier    # and so on, in parallel
```
