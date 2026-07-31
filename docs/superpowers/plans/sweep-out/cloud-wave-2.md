# cloud-wave-2 — 8 packages, app frozen at 0d44de8

| | count |
|---|---:|
| packages swept | 8 |
| — properties they belong to | 5 |
| produced something comparable | 5 |
| produced nothing comparable | 3 |
| values compared | 118 |
| values differing | 61 |
| — of those, **both sides had a value and they differ** | **23** |
| — we produced a value the filed document has no field for | 29 |
| — the filed document had a value we produced nothing for | 9 |
| fill-order disagreements | 0 |
| Azure OCR requests sent | 11 |
| — properties that needed at least one | 5 of 8 |

## Interaction storm — what random use broke

Randomized clicking, typing, Enter, Escape, save, revert and reopen, run against
a form that holds a REAL parsed record. Each row replays exactly from its seed.

| property | package | what broke | seed |
|---|---|---|---|
| Circle Park | 2026 - RCS | save-left-dirt: after "Update property profile" settled, 94 key(s) still differ from the snapshot: property.name, property.addr_street,  | `2074983486` |
| Clinton Manor | 2026 - RCS | escape-left-residue: after escaping every edit to rest, 1 key(s) still differ from the pre-episode form: units.1.safmr_hud: "1700" -> "2803" | `2565671169` |
| Westwood Village | 2025 - RCS | save-left-dirt: after "Update property profile" settled, 1 key(s) still differ from the snapshot: units.4.safmr_hud | `3805780444` |

## Fill-order disagreements — highest severity

None. Every property that generated in both orders generated the same package.

## Documents the app did not generate

The filed package contains these; the app produced no counterpart, so
there was nothing to compare. Counted once per document, not once per field.

| document | properties | of |
|---|---:|---:|
| notes | 5 | 8 |
| sections | 5 | 8 |
| rcsStudy | 5 | 8 |
| checklist | 5 | 8 |
| coverLetter | 5 | 8 |
| rentSchedule | 5 | 8 |
| tenantNotice | 4 | 8 |
| submittalLetter | 2 | 8 |

## Properties that produced nothing comparable

Zero comparison rows is not agreement. Each of these is a property the
sweep could not test, and why.

| property | verdict | rs tier | what the app said it was missing |
|---|---|---|---|
| Burt Farms I | the app generated nothing comparable | — |  |
| Clinton Manor | the app generated nothing comparable | — |  |
| Westwood Village | the app generated nothing comparable | — |  |

## Differences, grouped by cause then by key

Read the **mismatch** rows first: those are the ones where both documents
state a value and the two disagree. A `missing-theirs` row usually means
the filed template has no such field, not that anything is wrong.

Every row starts `undiagnosed`. A cause is only set by a person, or by a
rule that says how it knows.

### Cause: undiagnosed — 61 rows

| doc · key | properties | example ours | example filed |
|---|---:|---|---|
| analysisXlsx · property.name | 5 | `BurtFarmsI` | _(absent)_ |
| analysisXlsx · appr.firm | 5 | `Renzi&Associates` | _(absent)_ |
| analysisXlsx · unit.0.type | 5 | `1BR/1BA` | `1BR` |
| analysisXlsx · unit.1.type | 4 | `2BR/1.5BAFlat` | `2BR-Flat` |
| analysisXlsx · unit.2.type | 4 | `2BR/1.5BATH` | `2BR-TH` |
| analysisXlsx · unit.0.ua | 3 | `54` | _(absent)_ |
| analysisXlsx · unit.3.type | 3 | `3BR/1.5BAFlat` | `3BR-Flat` |
| analysisXlsx · unit.0.safmr | 2 | `2340` | _(absent)_ |
| analysisXlsx · unit.1.safmr | 2 | `2640` | _(absent)_ |
| analysisXlsx · unit.2.safmr | 2 | `2640` | _(absent)_ |
| analysisXlsx · unit.3.safmr | 2 | `3390` | _(absent)_ |
| analysisXlsx · unit.4.type | 2 | `3BR/1.5BATH` | `3BR-TH` |
| analysisXlsx · unit.4.safmr | 2 | `3390` | _(absent)_ |
| analysisXlsx · unit.0.current | 2 | _(absent)_ | `832` |
| analysisXlsx · unit.1.current | 2 | _(absent)_ | `1016` |
| analysisXlsx · unit.2.current | 2 | _(absent)_ | `1185` |
| analysisXlsx · unit.3.current | 2 | _(absent)_ | `1337` |
| analysisXlsx · unit.1.ua | 2 | `221` | _(absent)_ |
| analysisXlsx · unit.2.ua | 2 | `246` | _(absent)_ |
| analysisXlsx · unit.0.proposed | 1 | `1200` | _(absent)_ |
| analysisXlsx · unit.1.proposed | 1 | `1200` | _(absent)_ |
| analysisXlsx · unit.2.proposed | 1 | `1350` | _(absent)_ |
| analysisXlsx · unit.3.proposed | 1 | `1350` | _(absent)_ |
| analysisXlsx · unit.3.ua | 1 | `155` | _(absent)_ |
| analysisXlsx · unit.4.proposed | 1 | `1600` | _(absent)_ |
| analysisXlsx · unit.4.ua | 1 | `151` | _(absent)_ |
| analysisXlsx · unit.4.current | 1 | _(absent)_ | `973` |

