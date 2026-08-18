# Calibrating the grade bands

A grade is a number turned into one of five Hungarian words. The number is the eval loss — how much worse the move played was than the move the engine preferred — and the words are Legjobb, Jó, Pontatlan, Hiba and Súlyos hiba. What turns one into the other is four band edges, and until this run every one of them was a guess: four numbers read in all three phases, placed by hand around the two losses anyone could name.

This is the run that replaced them, what it found, and enough of how it was done to do it again.

The harness is [`tests/tuning/grades.test.ts`](../../tests/tuning/grades.test.ts); the bands it settled are `BANDS` in [`src/teaching/grade.ts`](../../src/teaching/grade.ts), beside `LOST_POSITION`, which it settled too.

## What was wrong with the guesses

One table, read in all three phases:

| Grade       | Loss |
| ----------- | ---: |
| Súlyos hiba |  100 |
| Hiba        |   50 |
| Pontatlan   |   20 |
| Jó          |    1 |

It was placed around the moving phase, where a piece is worth 100 and a mill about a third of that: a piece handed over was Súlyos hiba and a mill missed was short of one. In the moving phase it was close to right, and this run largely confirms it. The trouble is that it was read in the other two phases as well, and **the evaluation's units are not the same size in all three** — a piece is worth 8 while pieces are being placed, 100 while they move and 300 while they fly, and the seven other terms do not scale with it. One table read in all three therefore means three different scales wearing the same five words.

The damage is not the one it looks like from the outside. It is tempting to say that Súlyos hiba at 100 was unreachable while placing, twelve pieces being more than anyone ever loses. It was not unreachable at all: while placing, material is the smallest thing on the board and mills, forks and potential mills are the whole game, so a novice's placing loses in shape and shape is expensive — the median placing move in the corpus below loses a piece and a quarter, and the ninetieth loses nine. A loss of 100 while placing is about three mills, and it happened. What actually went wrong is this:

- **While placing**, the two lower edges were moving-phase numbers landing wherever they happened to land in a quite different distribution. Pontatlan began at 20, which is past the sixtieth percentile of a novice's placing moves rather than anywhere near the median, so the phase in which a novice most needs telling was the phase that flattered them most. It is the largest change this run made: a quarter of a novice's placing moves were graded Jó, and a third of those belong further down the scale.
- **While flying**, Súlyos hiba began at a third of a piece. A loss of 240 there — four fifths of what a piece is worth — meant the same word as handing a piece over.

**The flying half of that is the interesting one, because the shares below do not show it.** Súlyos hiba fired on 5 flying moves in 98 under the old table and fires on 6 under the new one. The old band was far too harsh and it was very nearly never reached, and both facts have the same cause: `LOST_POSITION` was a single number too, 200, which in the flying phase is two thirds of a piece — so most flying moves were in positions the old code had already written off, and were capped at Pontatlan before any band was consulted. Two numbers that were wrong in opposite directions cancelled, and the grading looked reasonable in a phase where nothing about it was.

That is worth stating plainly because it is the argument for calibrating at all. A table can produce sensible-looking output for reasons that have nothing to do with being right, and the only way to tell the difference is to go and look.

The counts are in [the shares below](#what-share-of-a-novices-moves-each-band-takes), measured rather than argued.

## How a run works

```sh
pnpm tune -t grades
```

**The corpus is Kezdő's moves.** A band is read to a novice, so it has to be right for the moves a novice plays, and Kezdő is the closest thing this project has to a novice that can play a thousand moves overnight. It looks one move ahead and plays a deliberately weaker move half the time. Both halves matter and only one is obvious: the deliberate mistakes come off the near-best shortlist and are bounded by its margin, but the depth of one is bounded by nothing — Kezdő hangs pieces to tactics it cannot see, which is what a novice does and what the worst band has to be placed around.

**Three games per opening.** Kezdő against itself, because that is the game a beginner actually plays; and Kezdő against Erős from both sides, because a novice under pressure reaches positions a novice left alone never does. Only Kezdő's moves are measured. Kezdő against Kezdő is one game with both sides measured rather than the same deterministic game played twice.

**Twenty openings**, four random moves each — more than the weight gauntlet plays, because of the flying phase. It is the scarcest thing here: a novice game reaches it rarely, ends quickly once it does, and half the moves played there are decided outright by the search rather than weighed by the evaluation.

**Every measured move is weighed exactly as the grader weighs it**: one full-strength search of the position the move was played in, the loss taken between the move it preferred and the move that was played, and the same two moves skipped that the grader skips — the one the rules left no choice about, and the one the search did not rank.

**Chance comes from a seed**, as everywhere else in this repo, so a table written down here can be checked rather than believed.

**What placed the edges is not what is published.** Edges read off the quantiles of one corpus can always be that corpus's doing, so the seeds that placed them and the seed the tables below come from are different — the same precaution the weight gauntlet takes when it plays its confirmation match at a seed that had no hand in choosing the winner. Seeds `20260817` and `424242` placed the edges, pooled, over 3061 graded moves. **Every table below is seed `31415926`**, 1454 graded moves, which had no hand in choosing anything.

## The rule, fixed before the tables were read

An edge chosen after looking at what it would produce is an edge chosen by hand with extra steps. So the rule was written down first, in the harness, and the numbers were fitted to it. In full it is in the harness header; in short:

1. Pool the two calibrating corpora. In each phase, read the edges off the quantiles of what the moves played in that phase lost: **the median** between Jó and Pontatlan, **the eightieth** between Pontatlan and Hiba, **the ninety-fifth** between Hiba and Súlyos hiba. Anything at all lost is Jó.
2. Take those quantiles over the moves the **evaluation weighed**, not the ones the **search decided**.
3. Round to something readable — the nearest 2 while placing, 10 while moving, 25 while flying. Rounding is cosmetic and may not reorder a table.
4. Where an edge would land at or below the edge under it, re-read that phase's quantiles over the moves that lost anything at all.
5. Two anchors override a quantile where they disagree, because they are what the grades have to *mean* rather than how often they have to fire: **a piece handed over while pieces move is Súlyos hiba**, and **a move that gave up less than a mill in its phase is no worse than Pontatlan**.
6. An anchor that pins an edge below the quantile under it leaves the table out of order; the lower edges are then re-read at the same quantiles over the moves that lost **something but** less than the pin. The lower bound is not a detail: half a novice's moving moves lose almost nothing, so a subset taking those in would put Pontatlan at nought.
7. `LOST_POSITION` is the smallest measured distance behind from which no game in the corpus was ever saved.

**The rule was amended three times, and all three are worth reading**, because a rule that never met anything it could not handle was not a rule anybody was following.

- **Rules 2 and 6 were written before any edge was read off any table**, when the first run came back and made two collisions plain.
- **Rule 7 was rewritten after its table was read**, which is the one to be suspicious of. It is set out in full below, in the words of what it replaced, so that anyone can disagree with it against the same numbers.

Rule 2 is the one worth understanding, because it is not a technicality. Eval loss is not one scale but two. A move that walks into a game the search has already seen won or lost loses a **mate score** — a million — against an evaluation that cannot pass a hundred thousand however good the position is. Quantiles over the two mixed are quantiles over nothing, and while flying, where **half** a novice's moves are decided outright, the eightieth and ninety-fifth both landed on a mate score: Hiba and Súlyos hiba would have meant the same number. Nothing is lost by leaving those moves out of the arithmetic. A mate-scale loss is above every band by construction and is Súlyos hiba whatever the edges are.

## What a novice's moves lose

Seed `31415926`, 1454 graded moves. `decided` counts the moves the search decided rather than the evaluation weighed, and they are excluded from the quantiles beside them.

| Phase   | Moves | Decided | p50 | p80 | p90 | p95 |  Max |
| ------- | ----: | ------: | --: | --: | --: | --: | ---: |
| Placing |   560 |       2 |  10 |  46 |  74 | 128 |  326 |
| Moving  |   796 |      66 |   3 | 163 | 276 | 398 | 1501 |
| Flying  |    98 |      55 |   0 |  35 | 260 | 264 |  320 |

The same figures in pieces of their own phase, which is the only way the three can be read against each other:

| Phase   |  p50 |  p80 |  p90 |  p95 |
| ------- | ---: | ---: | ---: | ---: |
| Placing | 1.25 | 5.75 | 9.25 | 16.0 |
| Moving  | 0.03 | 1.63 | 2.76 | 3.98 |
| Flying  | 0.00 | 0.12 | 0.87 | 0.88 |

Three things fall out of that, and each of them is a fact about the game rather than about the engine.

**A novice's placing moves are never far wrong in pieces and always far wrong in shape.** The median loss is a piece and a quarter, the ninetieth is nine pieces — numbers that would be absurd in any other phase. They are not absurd here: while placing, material is the smallest thing on the board and mills, forks and potential mills are the whole game, so what a bad placement loses is measured in shape and shape is expensive.

**The moving phase is where a novice is either fine or ruined.** Half its moves lose almost nothing — the median is 3, three hundredths of a piece — and a quarter lose more than a whole piece. There is very little in between. That is the phase's own structure: most moving positions offer several moves that come to much the same thing and one or two that hang a piece to a mill.

**Half a novice's flying moves are decided rather than weighed.** 55 of 98. With three pieces there is frequently no move that does not lose, or exactly one that does not, and the search sees the end from where it stands. Of what is left, the losses are tiny until they are enormous, with almost nothing between an eighth of a piece and nine tenths of one.

## The bands

| Grade       | Placing | Moving | Flying |
| ----------- | ------: | -----: | -----: |
| Súlyos hiba |     140 |    100 |    300 |
| Hiba        |      44 |     40 |     50 |
| Pontatlan   |      12 |     20 |     25 |
| Jó          |       1 |      1 |      1 |

Where each edge came from, with the pooled quantile it was read off and the shipped number it rounded to:

| Edge                | Measured or anchored | Read off | Rounds to |
| ------------------- | -------------------- | -------: | --------: |
| Placing, Pontatlan  | Measured, p50        |       11 |        12 |
| Placing, Hiba       | Measured, p80        |       44 |        44 |
| Placing, Súlyos hiba | Measured, p95        |      140 |       140 |
| Moving, Pontatlan   | Measured over the losses between nought and the pin (rule 6), p50 | 20 | 20 |
| Moving, Hiba        | Measured over the losses between nought and the pin (rule 6), p80 | 44 | 40 |
| Moving, Súlyos hiba | **Anchored** — the piece. The p95 was 546. | — | 100 |
| Flying, Pontatlan   | Measured over the moves that lost anything (rule 4), p50 | 9 | 25 |
| Flying, Hiba        | Measured, p80        |       40 |        50 |
| Flying, Súlyos hiba | Measured, p95        |      290 |       300 |

The flying Pontatlan edge is the one rounding moved furthest — 9 to 25, because the nearest multiple of 25 is nought and rounding may not put an edge at or under the one beneath it. On a phase measured over 59 moves, a median of 9 is not precise to the unit anyway.

**The moving phase is anchored at the top and measured underneath. The other two are measured throughout**, and that is exactly the division of labour the ticket asked for — the corpus was needed where nothing could be named, and nothing in the placing or the flying phase can be named the way a piece can.

The anchor is worth being blunt about, because it overrides the corpus by a factor of five. The pooled ninety-fifth in the moving phase is 546: a novice loses more than five pieces' worth on one moving move in twenty, more than two pieces' worth on one in five, and a whole piece on about **three in ten**. Read literally, the quantile rule would have set Súlyos hiba at five pieces and called handing a piece over merely Hiba. That is the rule measuring how often a Kezdő errs instead of what an error is worth, and the anchor is there to stop it. A move that gives a piece away for nothing is the archetypal grave mistake in this game, and it is graded as one.

**What the guesses got right, and it is most of the moving phase.** The moving table came out at 100/40/20 against guesses of 100/50/20 — one edge moved, by ten. That is a real result: the phase the guesses were reasoned about is the phase they had right, and the two they had never been checked in are the two that moved.

**The flying bands are the thin ones.** They rest on 59 pooled moves that lost anything at all, because the flying phase is scarce and half of it is decided outright. They are much better than the table they replace, which is a low bar, and they are the first thing a later run should look at with a bigger corpus.

## What share of a novice's moves each band takes

Seed `31415926`, the same 1454 graded moves, graded by the bands above. This is what the ticket asked to be written down: roughly what a novice's game looks like once every move in it has a word attached.

| Phase   | Moves | Legjobb | Jó  | Pontatlan | Hiba | Súlyos hiba |
| ------- | ----: | ------: | --: | --------: | ---: | ----------: |
| Placing |   560 |     36% | 17% |       26% |  16% |          5% |
| Moving  |   796 |     50% | 11% |        8% |   7% |         24% |
| Flying  |    98 |     58% |  7% |       29% |   0% |          6% |
| **All** |  1454 | **45%** | **13%** |   **17%** | **10%** |    **15%** |

And the same corpus under the table this run replaced, so that what changed can be read rather than taken on trust:

| Phase   | Moves | Legjobb | Jó  | Pontatlan | Hiba | Súlyos hiba |
| ------- | ----: | ------: | --: | --------: | ---: | ----------: |
| Placing |   560 |     36% | 26% |       23% |  10% |          5% |
| Moving  |   796 |     50% | 11% |       13% |   4% |         22% |
| Flying  |    98 |     58% |  6% |       31% |   0% |          5% |
| **All** |  1454 | **45%** | **17%** |   **18%** | **6%** |     **14%** |

Four things are worth pulling out of those two tables.

**Legjobb does not move at all**, in any phase, because nothing about it changed: it is the move the engine would have played, and no band edge decides that.

**The placing phase is where the work was done.** A novice's placements were graded Jó a quarter of the time and are now graded Jó a sixth; Hiba there rises from a tenth to a sixth. Both are the same correction in the same direction — a table calibrated in moving-phase units was systematically kind to a phase whose numbers are eight times smaller, and the corpus moves it about ten points down the scale. What did *not* move is Súlyos hiba, at 5% either way, and that is a coincidence of two changes cancelling: the band edge went up, from 100 to 140, and the cap that used to swallow the worst placements went away.

**Súlyos hiba on a quarter of moving-phase moves is not a bug.** It is what the piece anchor means, and the corpus is unambiguous that a Kezdő loses a whole piece on about three moving moves in ten — the cap for already-lost positions is what brings the graded share down to a quarter. See the caveat at the end: Kezdő is a harsher novice than a person.

**Hiba was a narrow band and is now a real one**, 6% before and 10% after, though it is still empty in the flying phase. Part of that is the placing correction above; the rest is the shape of the game. In the moving and flying phases a move is usually either sound or ruinous, with not much in between, so the middle word has little to describe. The placing phase, at 16%, is the one with a genuine middle — which is worth knowing, because it is the phase a beginner has the best chance of improving by being told.

## When a position is already lost

`LOST_POSITION` is what stops a grade blaming the wrong move. A player whose game had gone before they moved is graded no worse than Pontatlan whatever they played, because the mistake was made further back. Getting it wrong in either direction is costly: too high and it never fires; too low and it caps ordinary positions, and the grading stops saying anything at all.

Every move in the corpus carries what the engine made of the position it was played in and what the game went on to do, so this is measurable. Pooled over the calibrating seeds, by how far behind the mover stood, counting a draw as a game saved:

| Behind by  | Placing (n) | share lost | Moving (n) | share lost | Flying (n) | share lost |
| ---------- | ----------: | ---------: | ---------: | ---------: | ---------: | ---------: |
| level      |         821 |       0.79 |        923 |       0.95 |        109 |       1.00 |
| ½ piece    |         789 |       0.80 |        863 |       0.97 |        104 |       1.00 |
| 1 piece    |         759 |       0.79 |        806 |       0.97 |         75 |       1.00 |
| 1½ pieces  |         731 |       0.79 |        711 |       0.98 |         75 |       1.00 |
| 2 pieces   |         715 |       0.79 |        646 |       0.99 |         50 |       1.00 |
| 3 pieces   |         658 |       0.80 |        541 |       0.99 |         37 |       1.00 |
| 4 pieces   |         583 |       0.81 |        449 |       0.99 |         16 |       1.00 |
| 6 pieces   |         473 |       0.83 |        304 |       1.00 |          2 |       1.00 |
| 8 pieces   |         383 |       0.86 |        237 |       1.00 |          0 |          — |
| 12 pieces  |         251 |       0.85 |        112 |       1.00 |          0 |          — |

Those are the ten distances the corpus was asked about, and the grid is the whole of what was measured — a point worth holding on to, because the end of it is not the end of the distribution.

**The rule this table was supposed to answer did not survive it, and that is the amendment to be suspicious of.** As written, `LOST_POSITION` was to be the smallest distance at which the mover went on to lose at least nine games in ten. Read against the table, the answer in the moving phase is *level* — 0.95 — and in the flying phase it is *level* as well, at 1.00. A gate the very first row already passes is not measuring the position; it is measuring the player. Taken at its word it would have capped roughly two moving-phase moves in five at Pontatlan, which is precisely the failure the rule's own second sentence was written to avoid.

The confound is the corpus's one real weakness and it cannot be fixed by choosing a different number: **the player is the weakest difficulty, and it loses from very nearly everywhere.** A share of games lost is a joint fact about the position and about who was standing in it.

What replaced it is the one reading the confound cannot corrupt: **the smallest distance from which no game in the corpus was ever saved**, out of at least thirty moves, and never closer than a piece of its phase. Certainty is evidence about the position rather than about the player — if a stronger player would have held some of those games, the corpus cannot say so, but nobody saved one.

| Phase   | `LOST_POSITION`    | Why                                                                        |
| ------- | -----------------: | --------------------------------------------------------------------------- |
| Placing | 100000 (`EVALUATION_LIMIT`) | No distance was ever certain — the share never passes 0.86 across the whole grid — so nothing in the placing phase is hopeless by the evaluation, and only a game the search has *seen* lost trips the cap there. |
| Moving  |                600 | Six pieces, the first distance nothing was saved from. Deep enough that the five-ply search has to have seen the loss coming, which is the point. |
| Flying  |                450 | A piece and a half. Every distance is certain here, so the piece-down floor decides it: a side one piece down while flying still has a game to play, and the next distance out is the one taken. |

**The placing number deserves the extra sentence, because the obvious version of it is wrong.** "Set past the furthest measured" invites 100 — four points beyond the twelve-piece row. That reads the end of the measuring grid as though it were the end of the distribution, and it is not: 251 of the 821 pooled placing moves already stand at or beyond twelve pieces behind, so a cap at 100 would fire on getting on for a third of everything played in that phase. The evidence does not say a placing position that far behind is lost — it says the opposite, that a sixth of them were saved. A cap the evidence does not support should not fire at all, so it is set where the evaluation runs out.

A game the search has seen lost outright scores far below any of these, so one number per phase takes in both — the position that is hopeless and the position that is over bar the playing.

At the held-out seed the shape comes back the same, which is the most that can be asked of it: placing never passes 0.88 at any distance, the moving phase reaches certainty at three pieces rather than six, and every flying distance is certain. The pooled reading is the more conservative of the two, which is the right way round.

**What this number replaced was itself a single number, 200, read in all three phases.** In the flying phase that is two thirds of a piece, and it is why the old flying bands looked harmless: the cap fired before they did. Being explicit about it is half the value of this section — the old grading's flying behaviour was the product of two mistakes rather than of any decision.

## Doing it again

1. Change what you mean to change: the corpus (`MATCHUPS`, `OPENINGS`, `NOVICE`), or the quantiles the edges are read at.
2. **Write the rule down before you run it.** Every amendment above is in the harness header with the reason beside it, including the one made after a table was read. That last is the one that matters: a rule amended after the fact is a rule that has to justify itself in public, or it is not a rule.
3. `pnpm tune -t grades`. It is about twenty minutes — three corpora of 1500 graded moves, each one a full-strength search.
4. Read the edges off the **pooled calibrating** table, not off the seed the document reports. Then write them into `BANDS`.
5. `pnpm test`. The bands are anchored by tests rather than only by prose — a piece handed over while pieces move is Súlyos hiba, a move that gave up less than a mill is no worse than Pontatlan in every phase, and a move that throws a won game is Súlyos hiba in every phase. If a new table breaks one of those, the table is wrong, not the test.
6. Record the run here: the seeds, the counts, the tables, the edges and which of them were measured and which anchored — and the amendments, especially the ones that went against you.

The one thing worth carrying into the next run is what this corpus is and is not. **Kezdő is a harsher novice than a person.** It searches one move deep and plays a deliberately weaker move half the time, so the shares above are the worst case rather than the typical one, and a human beginner will see fewer Súlyos hiba than this document reports. The bands' *meaning* comes from the anchors and is not affected; what the corpus places is where the edges fall between them.
