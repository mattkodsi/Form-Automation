# cloud-wave-1 — 5 packages, app frozen at 92a2be5

| | count |
|---|---:|
| packages swept | 5 |
| — properties they belong to | 3 |
| produced something comparable | 4 |
| produced nothing comparable | 1 |
| values compared | 391 |
| values differing | 301 |
| — of those, **both sides had a value and they differ** | **21** |
| — we produced a value the filed document has no field for | 271 |
| — the filed document had a value we produced nothing for | 9 |
| fill-order disagreements | 124 |
| Azure OCR requests sent | 6 |
| — properties that needed at least one | 3 of 5 |

## Interaction storm — what random use broke

The storm ran on 4 package(s) — 100 random actions in total — and found nothing.

This is a statement about these permutations, not about the app: a different
sweep draws different seeds and walks different interleavings.

## Fill-order disagreements — highest severity

The same inputs in two different fill orders produced different output.
This needs no ground truth to be a defect.

| property | doc | key | rs-first | rcs-first |
|---|---|---|---|---|
| Peterson Plaza | rentSchedule | total.contract_rent | `429050` | `456900` |
| Peterson Plaza | rentSchedule | total.annual | `5148600` | `5482800` |
| Peterson Plaza | rentSchedule | unit.2.type | `2BR` | `2BR/1BA` |
| Peterson Plaza | rentSchedule | unit.3.type | `2BR/1BA` | `2BR/1.5BA` |
| Peterson Plaza | rentSchedule | unit.3.rent | `2650` | `3250` |
| Peterson Plaza | rentSchedule | unit.3.extension | `111300` | `136500` |
| Peterson Plaza | rentSchedule | unit.3.ua | `111` | `131` |
| Peterson Plaza | rentSchedule | unit.3.gross | `2761` | `3381` |
| Peterson Plaza | rentSchedule | unit.2.rent | _(absent)_ | `2650` |
| Peterson Plaza | rentSchedule | unit.2.extension | _(absent)_ | `2650` |
| Peterson Plaza | rentSchedule | unit.2.gross | _(absent)_ | `2761` |
| Peterson Plaza | analysisXlsx | unit.2.type | `2BR` | `2BR/1BA` |
| Peterson Plaza | analysisXlsx | unit.3.type | `2BR/1BA` | `2BR/1.5BA` |
| Peterson Plaza | analysisXlsx | unit.3.proposed | `2650` | `3250` |
| Peterson Plaza | analysisXlsx | unit.3.ua | `111` | `131` |
| Peterson Plaza | analysisXlsx | unit.3.safmr | `2100` | `2700` |
| Peterson Plaza | analysisXlsx | unit.2.proposed | _(absent)_ | `2650` |
| Peterson Plaza | checklist | heading | `Owner’s  Checklist for  RCS  Subm…` | _(absent)_ |
| Peterson Plaza | checklist | property.name | `PetersonPlazaApartments` | _(absent)_ |
| Peterson Plaza | checklist | check.0 | `1` | _(absent)_ |
| Peterson Plaza | checklist | check.1 | `1` | _(absent)_ |
| Peterson Plaza | checklist | check.2 | `0` | _(absent)_ |
| Peterson Plaza | checklist | check.3 | `1` | _(absent)_ |
| Peterson Plaza | checklist | check.4 | `1` | _(absent)_ |
| Peterson Plaza | checklist | check.5 | `1` | _(absent)_ |
| Peterson Plaza | checklist | check.6 | `1` | _(absent)_ |
| Peterson Plaza | checklist | check.7 | `1` | _(absent)_ |
| Peterson Plaza | checklist | check.8 | `1` | _(absent)_ |
| Peterson Plaza | checklist | check.9 | `1` | _(absent)_ |
| Peterson Plaza | checklist | check.10 | `1` | _(absent)_ |
| Peterson Plaza | checklist | check.11 | `1` | _(absent)_ |
| Peterson Plaza | checklist | check.12 | `1` | _(absent)_ |
| Peterson Plaza | checklist | check.13 | `1` | _(absent)_ |
| Peterson Plaza | checklist | check.14 | `0` | _(absent)_ |
| Peterson Plaza | checklist | check.15 | `1` | _(absent)_ |
| Peterson Plaza | checklist | check.16 | `1` | _(absent)_ |
| Peterson Plaza | checklist | checklist.signature | `MatthewFinkle,VicePresidentofGene…` | _(absent)_ |
| Peterson Plaza | rentSchedule | property.name | `PetersonPlazaApartments` | _(absent)_ |
| Peterson Plaza | rentSchedule | property.fha | `IL060052016` | _(absent)_ |
| Peterson Plaza | rentSchedule | rent_schedule.date_eff | `09/01/2020` | _(absent)_ |
| Peterson Plaza | rentSchedule | rent_schedule.eff_month | `09` | _(absent)_ |
| Peterson Plaza | rentSchedule | rent_schedule.eff_day | `01` | _(absent)_ |
| Peterson Plaza | rentSchedule | rent_schedule.eff_year | `2020` | _(absent)_ |
| Peterson Plaza | rentSchedule | total.contract_rent | `34000` | _(absent)_ |
| Peterson Plaza | rentSchedule | total.annual | `408000` | _(absent)_ |
| Peterson Plaza | rentSchedule | nonrev.total_rent | `1586` | _(absent)_ |
| Peterson Plaza | rentSchedule | owner.entity_name | `PetersonPlazaPreservation,L.P.` | _(absent)_ |
| Peterson Plaza | rentSchedule | sig.name_title | `MatthewFinkle,VicePresidentofGene…` | _(absent)_ |
| Peterson Plaza | rentSchedule | total.units | `190` | _(absent)_ |
| Peterson Plaza | rentSchedule | unit.0.type | `1BR` | _(absent)_ |
| Peterson Plaza | rentSchedule | unit.0.units | `100` | _(absent)_ |
| Peterson Plaza | rentSchedule | unit.0.ua | `71` | _(absent)_ |
| Peterson Plaza | rentSchedule | unit.0.row | `0` | _(absent)_ |
| Peterson Plaza | rentSchedule | unit.1.type | `1BR` | _(absent)_ |
| Peterson Plaza | rentSchedule | unit.1.units | `30` | _(absent)_ |
| Peterson Plaza | rentSchedule | unit.1.ua | `63` | _(absent)_ |
| Peterson Plaza | rentSchedule | unit.1.row | `1` | _(absent)_ |
| Peterson Plaza | rentSchedule | unit.2.type | `2BR` | _(absent)_ |
| Peterson Plaza | rentSchedule | unit.2.units | `1` | _(absent)_ |
| Peterson Plaza | rentSchedule | unit.2.ua | `86` | _(absent)_ |
| Peterson Plaza | rentSchedule | unit.2.row | `2` | _(absent)_ |
| Peterson Plaza | rentSchedule | unit.3.type | `2BR` | _(absent)_ |
| Peterson Plaza | rentSchedule | unit.3.units | `42` | _(absent)_ |
| Peterson Plaza | rentSchedule | unit.3.ua | `86` | _(absent)_ |
| Peterson Plaza | rentSchedule | unit.3.row | `3` | _(absent)_ |
| Peterson Plaza | rentSchedule | unit.4.type | `3BR/1.5BA` | _(absent)_ |
| Peterson Plaza | rentSchedule | unit.4.units | `16` | _(absent)_ |
| Peterson Plaza | rentSchedule | unit.4.rent | `2125` | _(absent)_ |
| Peterson Plaza | rentSchedule | unit.4.extension | `34000` | _(absent)_ |
| Peterson Plaza | rentSchedule | unit.4.ua | `118` | _(absent)_ |
| Peterson Plaza | rentSchedule | unit.4.gross | `2243` | _(absent)_ |
| Peterson Plaza | rentSchedule | unit.4.row | `4` | _(absent)_ |
| Peterson Plaza | rentSchedule | unit.5.type | `2BR` | _(absent)_ |
| Peterson Plaza | rentSchedule | unit.5.units | `1` | _(absent)_ |
| Peterson Plaza | rentSchedule | unit.5.rent | `0` | _(absent)_ |
| Peterson Plaza | rentSchedule | unit.5.extension | `0` | _(absent)_ |
| Peterson Plaza | rentSchedule | unit.5.ua | `0` | _(absent)_ |
| Peterson Plaza | rentSchedule | unit.5.gross | `0` | _(absent)_ |
| Peterson Plaza | rentSchedule | unit.5.row | `6` | _(absent)_ |
| Peterson Plaza | rentSchedule | owner.entity_type | `LimitedPartnership` | _(absent)_ |
| Peterson Plaza | rentSchedule | partb.equipment.0 | `1` | _(absent)_ |
| Peterson Plaza | rentSchedule | partb.equipment.1 | `1` | _(absent)_ |
| Peterson Plaza | rentSchedule | partb.equipment.2 | `1` | _(absent)_ |
| Peterson Plaza | rentSchedule | partb.equipment.5 | `1` | _(absent)_ |
| Peterson Plaza | rentSchedule | partb.equipment.6 | `1` | _(absent)_ |
| Peterson Plaza | rentSchedule | partb.utilities.0 | `1` | _(absent)_ |
| Peterson Plaza | rentSchedule | partb.utilities.1 | `1` | _(absent)_ |
| Peterson Plaza | rentSchedule | partb.utilities.2 | `1` | _(absent)_ |
| Peterson Plaza | rentSchedule | partb.fuel.0 | `E` | _(absent)_ |
| Peterson Plaza | rentSchedule | partb.fuel.1 | `E` | _(absent)_ |
| Peterson Plaza | rentSchedule | partb.fuel.2 | `G` | _(absent)_ |
| Peterson Plaza | rentSchedule | partb.fuel.3 | `E` | _(absent)_ |
| Peterson Plaza | rentSchedule | partb.fuel.4 | `E` | _(absent)_ |
| Peterson Plaza | rentSchedule | partb.services.0 | `1` | _(absent)_ |
| Peterson Plaza | rentSchedule | nonrev.0.use | `EmploveeUnit` | _(absent)_ |
| Peterson Plaza | rentSchedule | nonrev.0.type | `2BR` | _(absent)_ |
| Peterson Plaza | rentSchedule | nonrev.0.rent | `1586` | _(absent)_ |
| Peterson Plaza | rentSchedule | principals.0.name | `PetersonPlazaPreservationGP,LLC` | _(absent)_ |
| Peterson Plaza | rentSchedule | principals.0.title | `.01%` | _(absent)_ |
| Peterson Plaza | rentSchedule | principals.1.name | `RaymondJamesHousingOpportunitiesF…` | _(absent)_ |
| Peterson Plaza | rentSchedule | principals.1.title | `99.99%` | _(absent)_ |
| Peterson Plaza | analysisXlsx | property.name | `PetersonPlazaApartments` | _(absent)_ |
| Peterson Plaza | analysisXlsx | appr.firm | `Appraiser` | _(absent)_ |
| Peterson Plaza | analysisXlsx | unit.0.type | `1BR` | _(absent)_ |
| Peterson Plaza | analysisXlsx | unit.0.units | `100` | _(absent)_ |
| Peterson Plaza | analysisXlsx | unit.0.current | `1381` | _(absent)_ |
| Peterson Plaza | analysisXlsx | unit.0.ua | `71` | _(absent)_ |
| Peterson Plaza | analysisXlsx | unit.1.type | `1BR` | _(absent)_ |
| Peterson Plaza | analysisXlsx | unit.1.units | `30` | _(absent)_ |
| Peterson Plaza | analysisXlsx | unit.1.current | `1387` | _(absent)_ |
| Peterson Plaza | analysisXlsx | unit.1.ua | `63` | _(absent)_ |
| Peterson Plaza | analysisXlsx | unit.2.type | `2BR` | _(absent)_ |
| Peterson Plaza | analysisXlsx | unit.2.units | `1` | _(absent)_ |
| Peterson Plaza | analysisXlsx | unit.2.current | `1586` | _(absent)_ |
| Peterson Plaza | analysisXlsx | unit.2.ua | `86` | _(absent)_ |
| Peterson Plaza | analysisXlsx | unit.3.type | `2BR` | _(absent)_ |
| Peterson Plaza | analysisXlsx | unit.3.units | `42` | _(absent)_ |
| Peterson Plaza | analysisXlsx | unit.3.current | `1586` | _(absent)_ |
| Peterson Plaza | analysisXlsx | unit.3.ua | `86` | _(absent)_ |
| Peterson Plaza | analysisXlsx | unit.4.type | `3BR/1.5BA` | _(absent)_ |
| Peterson Plaza | analysisXlsx | unit.4.units | `16` | _(absent)_ |
| Peterson Plaza | analysisXlsx | unit.4.current | `2106` | _(absent)_ |
| Peterson Plaza | analysisXlsx | unit.4.proposed | `2125` | _(absent)_ |
| Peterson Plaza | analysisXlsx | unit.4.ua | `118` | _(absent)_ |

## Documents the app did not generate

The filed package contains these; the app produced no counterpart, so
there was nothing to compare. Counted once per document, not once per field.

| document | properties | of |
|---|---:|---:|
| coverLetter | 3 | 5 |
| notes | 2 | 5 |
| sections | 2 | 5 |
| rcsStudy | 2 | 5 |
| tenantNotice | 1 | 5 |
| submittalLetter | 1 | 5 |

## Properties that produced nothing comparable

Zero comparison rows is not agreement. Each of these is a property the
sweep could not test, and why.

| property | verdict | rs tier | what the app said it was missing |
|---|---|---|---|
| Hampshire House | the app generated nothing comparable | — |  |

## Differences, grouped by cause then by key

Read the **mismatch** rows first: those are the ones where both documents
state a value and the two disagree. A `missing-theirs` row usually means
the filed template has no such field, not that anything is wrong.

Every row starts `undiagnosed`. A cause is only set by a person, or by a
rule that says how it knows.

### Cause: undiagnosed — 301 rows

| doc · key | properties | example ours | example filed |
|---|---:|---|---|
| checklist · property.name | 4 | `ColonialVillage` | `7/7/2026` |
| checklist · check.0 | 4 | `1` | _(absent)_ |
| checklist · check.1 | 4 | `1` | _(absent)_ |
| checklist · check.2 | 4 | `0` | _(absent)_ |
| checklist · check.3 | 4 | `1` | _(absent)_ |
| checklist · check.4 | 4 | `1` | _(absent)_ |
| checklist · check.5 | 4 | `1` | _(absent)_ |
| checklist · check.6 | 4 | `1` | _(absent)_ |
| checklist · check.7 | 4 | `1` | _(absent)_ |
| checklist · check.8 | 4 | `1` | _(absent)_ |
| checklist · check.9 | 4 | `1` | _(absent)_ |
| checklist · check.10 | 4 | `1` | _(absent)_ |
| checklist · check.11 | 4 | `1` | _(absent)_ |
| checklist · check.12 | 4 | `1` | _(absent)_ |
| checklist · check.13 | 4 | `1` | _(absent)_ |
| checklist · check.14 | 4 | `0` | _(absent)_ |
| checklist · check.15 | 4 | `1` | _(absent)_ |
| checklist · check.16 | 4 | `1` | _(absent)_ |
| checklist · checklist.signature | 4 | `DavidPearson,VPofGeneralPartner` | _(absent)_ |
| rentSchedule · rent_schedule.eff_day | 4 | `01` | `1` |
| rentSchedule · sig.name_title | 4 | `DavidPearson,VPofGeneralPartner` | `MatthewFinkle,VPofGP` |
| rentSchedule · unit.0.type | 4 | `2BR/1BA` | `2BR` |
| rentSchedule · unit.0.ua | 4 | `161` | `160` |
| rentSchedule · unit.1.type | 4 | `3BR/1BA` | `1BR` |
| rentSchedule · unit.2.type | 4 | `2BR` | `2BRNonRev` |
| analysisXlsx · property.name | 4 | `ColonialVillage` | _(absent)_ |
| analysisXlsx · appr.firm | 4 | `BelfryValuation,LLC` | _(absent)_ |
| analysisXlsx · unit.0.type | 4 | `2BR/1BA` | `2BR` |
| analysisXlsx · unit.1.type | 4 | `3BR/1BA` | `3BR` |
| rentSchedule · unit.0.gross | 3 | `2011` | `2010` |
| rentSchedule · principals.1.name | 3 | _(absent)_ | `DavidPearson,VicePresidentofGener…` |
| rentSchedule · property.name | 3 | `HampshireHouseNJ390030010` | _(absent)_ |
| rentSchedule · rent_schedule.date_eff | 3 | `10/01/2024` | _(absent)_ |
| rentSchedule · rent_schedule.eff_month | 3 | `10` | _(absent)_ |
| rentSchedule · rent_schedule.eff_year | 3 | `2024` | _(absent)_ |
| rentSchedule · total.contract_rent | 3 | `240000` | _(absent)_ |
| rentSchedule · total.annual | 3 | `2880000` | _(absent)_ |
| rentSchedule · nonrev.total_rent | 3 | `0` | _(absent)_ |
| rentSchedule · owner.entity_name | 3 | `HampshireUrbanRenewalPreservation…` | _(absent)_ |
| rentSchedule · total.units | 3 | `115` | _(absent)_ |
| rentSchedule · unit.0.units | 3 | `90` | `ndFloor` |
| rentSchedule · unit.1.units | 3 | `25` | _(absent)_ |
| rentSchedule · unit.1.ua | 3 | `86` | _(absent)_ |
| rentSchedule · unit.1.row | 3 | `1` | `3` |
| rentSchedule · owner.entity_type | 3 | `LimitedPartnership` | _(absent)_ |
| rentSchedule · partb.equipment.0 | 3 | `1` | _(absent)_ |
| rentSchedule · partb.equipment.1 | 3 | `1` | _(absent)_ |
| rentSchedule · partb.utilities.0 | 3 | `1` | _(absent)_ |
| rentSchedule · partb.utilities.1 | 3 | `1` | _(absent)_ |
| rentSchedule · partb.utilities.2 | 3 | `1` | _(absent)_ |
| rentSchedule · partb.fuel.0 | 3 | `G` | _(absent)_ |
| rentSchedule · partb.fuel.1 | 3 | `E` | _(absent)_ |
| rentSchedule · partb.fuel.2 | 3 | `G` | _(absent)_ |
| rentSchedule · partb.fuel.3 | 3 | `E` | _(absent)_ |
| rentSchedule · partb.fuel.4 | 3 | `E` | _(absent)_ |
| rentSchedule · principals.0.name | 3 | `HampshirePreservationGP,LLC` | _(absent)_ |
| rentSchedule · principals.0.title | 3 | `GeneralPartner` | _(absent)_ |
| rentSchedule · unit.2.row | 3 | _(absent)_ | `5` |
| rentSchedule · unit.3.type | 3 | _(absent)_ | `Section8ContractNo:NJ390030010` |
| rentSchedule · unit.3.row | 3 | _(absent)_ | `6` |
| rentSchedule · unit.4.type | 3 | _(absent)_ | `DearMr.Silber,` |
| rentSchedule · unit.4.row | 3 | _(absent)_ | `10` |
| checklist · heading | 2 | `Owner’s  Checklist for  RCS  Subm…` | _(absent)_ |
| rentSchedule · property.fha | 2 | `n/a` | _(absent)_ |
| rentSchedule · unit.0.rent | 2 | `2000` | _(absent)_ |
| rentSchedule · unit.0.extension | 2 | `180000` | _(absent)_ |
| rentSchedule · unit.1.rent | 2 | `2400` | _(absent)_ |
| rentSchedule · unit.1.extension | 2 | `60000` | _(absent)_ |
| rentSchedule · unit.1.gross | 2 | `2486` | _(absent)_ |
| rentSchedule · partb.utilities.3 | 2 | `1` | _(absent)_ |
| rentSchedule · principals.1.title | 2 | `Co-GeneralPartner` | _(absent)_ |
| rentSchedule · nonrev.0.use | 2 | _(absent)_ | `ContractCoordinator,AssetManageme…` |
| analysisXlsx · unit.0.ua | 2 | `70` | _(absent)_ |
| analysisXlsx · unit.1.ua | 2 | `86` | _(absent)_ |
| rentSchedule · unit.0.row | 2 | `0` | _(absent)_ |
| rentSchedule · unit.2.units | 2 | `1` | _(absent)_ |
| rentSchedule · unit.2.ua | 2 | `111` | _(absent)_ |
| rentSchedule · unit.3.units | 2 | `42` | _(absent)_ |
| rentSchedule · unit.3.ua | 2 | `111` | _(absent)_ |
| rentSchedule · unit.4.units | 2 | `16` | _(absent)_ |
| rentSchedule · unit.4.rent | 2 | `3250` | _(absent)_ |
| rentSchedule · unit.4.extension | 2 | `52000` | _(absent)_ |
| rentSchedule · unit.4.ua | 2 | `131` | _(absent)_ |
| rentSchedule · unit.4.gross | 2 | `3381` | _(absent)_ |
| rentSchedule · partb.equipment.2 | 2 | `1` | _(absent)_ |
| rentSchedule · partb.equipment.5 | 2 | `1` | _(absent)_ |
| rentSchedule · partb.equipment.6 | 2 | `1` | _(absent)_ |
| analysisXlsx · unit.3.type | 2 | `2BR/1BA` | `2-BR` |
| analysisXlsx · unit.4.type | 2 | `3BR/1.5BA` | `3-BR` |
| rentSchedule · partb.utilities.4 | 1 | `1` | _(absent)_ |
| analysisXlsx · unit.0.proposed | 1 | `2000` | _(absent)_ |
| analysisXlsx · unit.1.proposed | 1 | `2400` | _(absent)_ |
| rentSchedule · unit.3.rent | 1 | `2650` | _(absent)_ |
| rentSchedule · unit.3.extension | 1 | `111300` | _(absent)_ |
| rentSchedule · unit.3.gross | 1 | `2761` | _(absent)_ |
| analysisXlsx · unit.2.proposed | 1 | _(absent)_ | `2700` |
| rentSchedule · unit.5.type | 1 | `2BR` | _(absent)_ |
| rentSchedule · unit.5.units | 1 | `1` | _(absent)_ |
| rentSchedule · unit.5.rent | 1 | `0` | _(absent)_ |
| rentSchedule · unit.5.extension | 1 | `0` | _(absent)_ |
| rentSchedule · unit.5.ua | 1 | `0` | _(absent)_ |
| rentSchedule · unit.5.gross | 1 | `0` | _(absent)_ |
| rentSchedule · unit.5.row | 1 | `6` | _(absent)_ |
| rentSchedule · partb.services.0 | 1 | `1` | _(absent)_ |
| rentSchedule · nonrev.0.type | 1 | `2BR` | _(absent)_ |
| rentSchedule · nonrev.0.rent | 1 | `1586` | _(absent)_ |
| analysisXlsx · unit.0.units | 1 | `100` | _(absent)_ |
| analysisXlsx · unit.0.current | 1 | `1381` | _(absent)_ |
| analysisXlsx · unit.1.units | 1 | `30` | _(absent)_ |
| analysisXlsx · unit.1.current | 1 | `1387` | _(absent)_ |
| analysisXlsx · unit.2.type | 1 | `2BR` | _(absent)_ |
| analysisXlsx · unit.2.units | 1 | `1` | _(absent)_ |
| analysisXlsx · unit.2.current | 1 | `1586` | _(absent)_ |
| analysisXlsx · unit.2.ua | 1 | `86` | _(absent)_ |
| analysisXlsx · unit.3.units | 1 | `42` | _(absent)_ |
| analysisXlsx · unit.3.current | 1 | `1586` | _(absent)_ |
| analysisXlsx · unit.3.ua | 1 | `86` | _(absent)_ |
| analysisXlsx · unit.4.units | 1 | `16` | _(absent)_ |
| analysisXlsx · unit.4.current | 1 | `2106` | _(absent)_ |
| analysisXlsx · unit.4.proposed | 1 | `2125` | _(absent)_ |
| analysisXlsx · unit.4.ua | 1 | `118` | _(absent)_ |

