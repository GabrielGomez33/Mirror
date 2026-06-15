# Personality Assessment — Methodology & Audit Notes

This document records *how* the Mirror personality intake derives its Big Five
and MBTI results, so the assessment's claims are defensible and re-calibratable.
It covers the scoring math, the normative basis, reliability/validity handling,
edge cases, and limitations.

## 1. Instrument

- **Big Five:** 40 items, 8 per domain (4 forward-keyed + 4 reverse-keyed),
  7-point Likert. Balanced keying controls for acquiescence at the score level.
- **MBTI:** 32 items, 8 per dichotomy (4 toward each pole), 7-point Likert.
- **Controls:** 2 embedded attention checks (expected answers live with the
  questions in `scientificQuestionBank.ts`), per-item response-time capture,
  and a final open reflection.

## 2. Big Five scoring (`enhancedScoring.ts`, `psychometricNorms.ts`)

1. **Reverse-key** the 4 reverse items per domain (`8 − score`).
2. **Domain raw score** = mean of the 8 keyed item responses (1–7).
3. **POMP transform** (scale-independent): `POMP = (mean − 1) / (7 − 1) × 100`
   (Cohen, Cohen, Aiken & West, 1999). This lets us compare 7-point responses
   against norms reported on other scale lengths.
4. **Percentile & T-score** via the normal CDF against reference norms.

### Normative basis
Domain reference means/SDs (in POMP units) and per-domain base reliabilities are
anchored to the **Big Five Inventory-2 (BFI-2; Soto & John, 2017)** — the most
widely validated public-domain Big Five instrument. BFI-2 1–5 descriptives are
converted to POMP via `(M − 1) / (5 − 1) × 100`. Published BFI-2 domain alphas
(E .86, A .82, C .83, N .85, O .84) are used as each domain's **ceiling**
reliability.

> These are **reference** norms, not norms validated on this exact item set.
> Percentiles are therefore well-grounded approximations, and the UI says so.

### Reliability (per respondent, not Cronbach's α)
Cronbach's α is a between-persons statistic and is **not** computable from one
test-taker, so we do not claim it. Instead we estimate a per-protocol
reliability:

```
reliability = baseReliability(domain)
            × (0.55 + 0.45 · withinPersonConsistency)
            × (0.60 + 0.40 · dataQualityReliability)
            × (0.70 + 0.30 · itemCompleteness)
clamped to [0.30, baseReliability]
```

- `withinPersonConsistency = 1 − (SD of keyed items / 3)` — rewards answering
  forward and reverse items consistently; a straight-liner scores ~0.
- The estimate is **capped at the published alpha** (we never claim better than
  the instrument), and floored so confidence intervals stay finite.

### Confidence intervals
`SEM = SD_norm · √(1 − reliability)` (POMP units); the 95% CI
(`POMP ± 1.96·SEM`) is mapped back onto the percentile metric.

## 3. Response validity (`validityScales.ts`)

Single-respondent screens for the response styles that corrupt self-report:

| Index | Detects | Flag threshold |
|---|---|---|
| Acquiescence | yea-/nay-saying (raw mean vs midpoint) | \|dev\| ≥ 1.0 |
| Inconsistency | careless/random (within-domain keyed SD) | norm. SD ≥ 0.6 |
| Infrequency | extreme same-domain contradictions (\|Δ\| ≥ 5) | ≥ 3 pairs |
| Extreme style | over-use of scale ends | ≥ 65% |
| Central tendency | over-use of the midpoint | ≥ 50% |

A composite `randomRespondingLikelihood` (documented weights) yields an overall
verdict: `valid → acceptable → questionable → invalid`. The verdict attenuates
reliability and drives user-facing cautions; we **flag and disclaim** rather than
silently discard.

## 4. MBTI scoring (`mbtiScoring.ts`)

- Per dichotomy: compare the mean of each pole's items; the higher pole wins.
- **Clarity** scales with the gap and is softly attenuated by data quality
  (floor 0.5×, so a real gap always counts).
- **Borderline** (gap < 0.5 or clarity < 12) is surfaced honestly — the UI shows
  both letters and plausible `alternateTypes`. Exact ties and missing-data
  dichotomies are marked indeterminate (clarity 0) **without** defaulting to a
  fixed letter that would bias the reported type.
- A clean 4-letter `type` is always produced (downstream contract), with every
  weak letter transparently disclosed.

## 5. Edge cases handled (verified)

- Missing / empty / partial answers → neutral, flagged scores; never throws.
- Out-of-range or non-numeric scores → clamped/ignored.
- Straight-lining → neutralized to the keyed midpoint, then flagged invalid.
- All-midpoint → central-tendency flag; all MBTI letters borderline.
- MBTI ties / one-sided dichotomies → borderline + alternates, no bias.
- Scoring failure in the UI → caught, user can retry; answers are preserved.
- Progress is persisted across refresh (content re-hydrated for validity;
  response times stay session-local so speed flags remain honest).

## 6. Limitations (communicated to users)

For personal insight only — **not** for clinical, employment, or other
high-stakes decisions. Results reflect current self-perception, can change over
time, and no instrument fully captures a person. MBTI in particular has limited
scientific validation versus the Big Five and is offered for self-reflection.

## References
- Soto, C. J., & John, O. P. (2017). The Next Big Five Inventory (BFI-2).
  *Journal of Personality and Social Psychology, 113*(1), 117–143.
- Cohen, P., Cohen, J., Aiken, L. S., & West, S. G. (1999). The problem of units
  and the circumstance for POMP. *Multivariate Behavioral Research, 34*(3).
- Meade, A. W., & Craig, S. B. (2012). Identifying careless responses in survey
  data. *Psychological Methods, 17*(3), 437–455.