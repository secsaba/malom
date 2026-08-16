# Teaching reasons come only from detected patterns

Every plain-language reason shown to a learner is generated from a fixed catalogue of patterns the engine positively detected in the position — a fork created, a mill let through, a piece left blocked, a mill broken for nothing. When no pattern fires, the app falls back to a generic sentence stating only what the evaluation supports ("the engine prefers d2 — it keeps more options open"). It never reaches for a plausible-sounding explanation it cannot substantiate.

## Consequences

Some moves get a grade with a thin reason attached, which reads as less impressive than a confident narrative for every move. That is the intended trade: this is a teaching tool, and a single explanation that a learner can see is wrong costs more trust than a hundred vague-but-true ones. Practically, it also means adding a new kind of explanation is a code change — a detector plus a sentence template in each language — not a prompt or a copy edit.
