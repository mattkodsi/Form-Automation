# cv — 1 packages, app frozen at 84677d0

| | count |
|---|---:|
| packages swept | 1 |
| — properties they belong to | 1 |
| produced something comparable | 1 |
| produced nothing comparable | 0 |
| values compared | 88 |
| values differing | 32 |
| — of those, **both sides had a value and they differ** | **10** |
| — we produced a value the filed document has no field for | 21 |
| — the filed document had a value we produced nothing for | 1 |
| fill-order disagreements | 0 |
| Azure OCR requests sent | 2 |
| — properties that needed at least one | 1 of 1 |

## Interaction storm — what random use broke

Randomized clicking, typing, Enter, Escape, save, revert and reopen, run against
a form that holds a REAL parsed record. Each row replays exactly from its seed.

| property | package | what broke | seed |
|---|---|---|---|
| Colonial Village | 2026 (RCS) | save-left-dirt: after "Update property profile" settled, 7 key(s) still differ from the snapshot: property.name, property.addr_city, app | `601113841` |
| Colonial Village | 2026 (RCS) | save-left-dirt: after "Update property profile" settled, 2 key(s) still differ from the snapshot: property.name, partb.equipment.3 | `601113841` |
| Colonial Village | 2026 (RCS) | save-left-dirt: after "Update property profile" settled, 2 key(s) still differ from the snapshot: partb.fuel.1, partb.fuel.4 | `601113841` |

## Fill-order disagreements — highest severity

None. Every property that generated in both orders generated the same package.

## Documents the app did not generate

The filed package contains these; the app produced no counterpart, so
there was nothing to compare. Counted once per document, not once per field.

| document | properties | of |
|---|---:|---:|
| coverLetter | 1 | 1 |

## Properties that produced nothing comparable

None.

## Differences, grouped by cause then by key

Read the **mismatch** rows first: those are the ones where both documents
state a value and the two disagree. A `missing-theirs` row usually means
the filed template has no such field, not that anything is wrong.

Every row starts `undiagnosed`. A cause is only set by a person, or by a
rule that says how it knows.

### Cause: undiagnosed — 32 rows

| doc · key | properties | example ours | example filed |
|---|---:|---|---|
| checklist · heading | 1 | `Owner’s  Checklist for  RCS  Subm…` | _(absent)_ |
| checklist · property.name | 1 | `ColonialVillage` | `7/7/2026` |
| checklist · check.0 | 1 | `1` | _(absent)_ |
| checklist · check.1 | 1 | `1` | _(absent)_ |
| checklist · check.2 | 1 | `0` | _(absent)_ |
| checklist · check.3 | 1 | `1` | _(absent)_ |
| checklist · check.4 | 1 | `1` | _(absent)_ |
| checklist · check.5 | 1 | `1` | _(absent)_ |
| checklist · check.6 | 1 | `1` | _(absent)_ |
| checklist · check.7 | 1 | `1` | _(absent)_ |
| checklist · check.8 | 1 | `1` | _(absent)_ |
| checklist · check.9 | 1 | `1` | _(absent)_ |
| checklist · check.10 | 1 | `1` | _(absent)_ |
| checklist · check.11 | 1 | `1` | _(absent)_ |
| checklist · check.12 | 1 | `1` | _(absent)_ |
| checklist · check.13 | 1 | `1` | _(absent)_ |
| checklist · check.14 | 1 | `0` | _(absent)_ |
| checklist · check.15 | 1 | `1` | _(absent)_ |
| checklist · check.16 | 1 | `1` | _(absent)_ |
| checklist · checklist.signature | 1 | `DavidPearson,VPofGeneralPartner` | _(absent)_ |
| rentSchedule · rent_schedule.eff_day | 1 | `01` | `1` |
| rentSchedule · sig.name_title | 1 | `DavidPearson,VPofGeneralPartner` | `MatthewFinkle,VPofGP` |
| rentSchedule · unit.0.type | 1 | `2BR/1BA` | `2BR` |
| rentSchedule · unit.0.ua | 1 | `161` | `160` |
| rentSchedule · unit.0.gross | 1 | `2011` | `2010` |
| rentSchedule · unit.1.type | 1 | `3BR/1BA` | `1BR` |
| rentSchedule · unit.2.type | 1 | `2BR` | `2BRNonRev` |
| rentSchedule · principals.1.name | 1 | _(absent)_ | `DavidPearson,VicePresidentofGener…` |
| analysisXlsx · property.name | 1 | `ColonialVillage` | _(absent)_ |
| analysisXlsx · appr.firm | 1 | `BelfryValuation,LLC` | _(absent)_ |
| analysisXlsx · unit.0.type | 1 | `2BR/1BA` | `2BR` |
| analysisXlsx · unit.1.type | 1 | `3BR/1BA` | `3BR` |

