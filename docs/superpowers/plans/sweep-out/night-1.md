# night-1 — 89 packages, app frozen at ccc4568

| | count |
|---|---:|
| packages swept | 89 |
| — properties they belong to | 46 |
| produced something comparable | 50 |
| produced nothing comparable | 39 |
| values compared | 2625 |
| values differing | 2156 |
| — of those, **both sides had a value and they differ** | **285** |
| — we produced a value the filed document has no field for | 1690 |
| — the filed document had a value we produced nothing for | 181 |
| fill-order disagreements | 418 |
| Azure OCR requests sent | 131 |
| — properties that needed at least one | 53 of 89 |

## Interaction storm — what random use broke

Randomized clicking, typing, Enter, Escape, save, revert and reopen, run against
a form that holds a REAL parsed record. Each row replays exactly from its seed.

| property | package | what broke | seed |
|---|---|---|---|
| Burt Farms I | 2024 - Renewal & RCS | save-left-dirt: after "Update property profile" settled, 3 key(s) still differ from the snapshot: appr.email, partb.writein.s1, partb.wr | `1346832637` |
| Cherry Garden - Section 8 | (no cycle folder) | save-left-dirt: after "Update property profile" settled, 2 key(s) still differ from the snapshot: partb.writein.s3, partb.writein.s3.on | `3182618769` |
| Cherry Garden - Section 8 | (no cycle folder) | save-left-dirt: after "Update property profile" settled, 1 key(s) still differ from the snapshot: partb.writein.s3 | `3182618769` |
| Cherry Garden - Section 8 | 2018 | save-left-dirt: after "Update property profile" settled, 3 key(s) still differ from the snapshot: owner.entity_type, partb.equipment.1,  | `2497528546` |
| Cherry Garden - Section 8 | 2018 | save-left-dirt: after "Update property profile" settled, 3 key(s) still differ from the snapshot: partb.services.4, partb.writein.e5, pa | `2497528546` |
| Circle Park | 2026 - RCS | save-left-dirt: after "Update property profile" settled, 2 key(s) still differ from the snapshot: property.addr_city, partb.equipment.1 | `192877470` |
| Colonial Village | 2026 (RCS) | save-left-dirt: after "Update property profile" settled, 72 key(s) still differ from the snapshot: property.name, property.addr_street,  | `2975096134` |
| Colonial Village | 2026 (RCS) | save-left-dirt: after "Update property profile" settled, 72 key(s) still differ from the snapshot: property.name, property.addr_street,  | `2975096134` |
| Colonial Village | 2026 (RCS) | save-left-dirt: after "Update property profile" settled, 72 key(s) still differ from the snapshot: property.name, property.addr_street,  | `2975096134` |
| Fairview Homes | (no cycle folder) | save-left-dirt: after "Update property profile" settled, 2 key(s) still differ from the snapshot: appr.addr_street, partb.fuel.0 | `3316624651` |
| Friendship Court | 2026 - RCS | save-left-dirt: after "Update property profile" settled, 103 key(s) still differ from the snapshot: property.name, property.addr_street, | `3055169361` |
| Mapleview Towers | 2020 | save-left-dirt: after "Update property profile" settled, 23 key(s) still differ from the snapshot: property.name, property.fha, sig.titl | `1686782825` |
| Mapleview Towers | 2020 | save-left-dirt: after "Update property profile" settled, 2 key(s) still differ from the snapshot: property.fha, partb.equipment.0 | `1686782825` |
| Marine Terrace | 2021 | save-left-dirt: after "Update property profile" settled, 2 key(s) still differ from the snapshot: rent_schedule.date_eff_source, rent_sc | `2771342179` |
| Market Square | 2026 - RCS | save-left-dirt: after "Update property profile" settled, 48 key(s) still differ from the snapshot: property.name, property.addr_street,  | `2226687370` |
| Morh Housing | 2026 - RCS | save-left-dirt: after "Update property profile" settled, 86 key(s) still differ from the snapshot: property.name, property.addr_street,  | `2243999333` |
| Morh Housing | 2021 | save-left-dirt: after "Update property profile" settled, 47 key(s) still differ from the snapshot: property.name, property.s8, owner.ent | `3902085183` |
| Newberry Arms | 2026 - RCS | save-left-dirt: after "Update property profile" settled, 58 key(s) still differ from the snapshot: property.name, property.addr_street,  | `2998879348` |
| Newberry Arms | 2026 - RCS | escape-left-residue: after escaping every edit to rest, 2 key(s) still differ from the pre-episode form: tenant.sender_title: "" -> "-5" · un | `2998879348` |
| Noble Tower | 2018 | save-left-dirt: after "Update property profile" settled, 2 key(s) still differ from the snapshot: rent_schedule.date_eff_source, rent_sc | `2376641855` |
| Noble Tower | 2024 - RCS | save-left-dirt: after "Update property profile" settled, 37 key(s) still differ from the snapshot: property.name, property.addr_zip, pro | `2586074563` |
| North Park | 2019 | save-left-dirt: after "Update property profile" settled, 38 key(s) still differ from the snapshot: property.name, property.fha, units.0. | `2074059211` |
| North Park | 2020 | save-left-dirt: after "Update property profile" settled, 1 key(s) still differ from the snapshot: nonrev.0.ba | `78067003` |
| Northgate Terrace CA | 2016 | save-left-dirt: after "Update property profile" settled, 21 key(s) still differ from the snapshot: property.name, property.addr_street,  | `2443757925` |
| Northgate Terrace CA | 2020 (RCS) | save-left-dirt: after "Update property profile" settled, 3 key(s) still differ from the snapshot: units.0.safmr_source, principals.3.nam | `2699750503` |
| Oak Center | 2026 - RCS | save-left-dirt: after "Update property profile" settled, 118 key(s) still differ from the snapshot: property.name, property.addr_street, | `1848751915` |
| Oak Center | 2026 - RCS | escape-left-residue: after escaping every edit to rest, 2 key(s) still differ from the pre-episode form: check.2: "" -> "1" · principals.1.ti | `1848751915` |
| Oak Center | 2021 | save-left-dirt: after "Update property profile" settled, 69 key(s) still differ from the snapshot: property.name, property.s8, owner.ent | `436713229` |
| Peterson Plaza | 2020 | save-left-dirt: after "Update property profile" settled, 80 key(s) still differ from the snapshot: property.name, property.addr_street,  | `2150122004` |
| Peterson Plaza | 2020 | escape-left-residue: after escaping every edit to rest, 2 key(s) still differ from the pre-episode form: partb.equipment.0: "1" -> "" · units | `2150122004` |
| Riverwood | 2025 - RCS | save-left-dirt: after "Update property profile" settled, 2 key(s) still differ from the snapshot: partb.fuel.0, check.11 | `3272932102` |
| Sycamore Green | 2020 | save-left-dirt: after "Update property profile" settled, 4 key(s) still differ from the snapshot: partb.equipment.0, partb.services.1, p | `509383021` |
| Sycamore Green | 2020 | escape-left-residue: after escaping every edit to rest, 1 key(s) still differ from the pre-episode form: partb.services.5: "" -> "1" | `509383021` |
| Walden | 2020 | save-left-dirt: after "Update property profile" settled, 1 key(s) still differ from the snapshot: ca.name | `2000617856` |

## Fill-order disagreements — highest severity

The same inputs in two different fill orders produced different output.
This needs no ground truth to be a defect.

| property | doc | key | rs-first | rcs-first |
|---|---|---|---|---|
| Ebony Gardens | checklist | heading | `Owner’s  Checklist for  RCS  Subm…` | _(absent)_ |
| Ebony Gardens | checklist | property.name | `EbonyGardens` | _(absent)_ |
| Ebony Gardens | checklist | check.0 | `1` | _(absent)_ |
| Ebony Gardens | checklist | check.1 | `1` | _(absent)_ |
| Ebony Gardens | checklist | check.2 | `0` | _(absent)_ |
| Ebony Gardens | checklist | check.3 | `1` | _(absent)_ |
| Ebony Gardens | checklist | check.4 | `1` | _(absent)_ |
| Ebony Gardens | checklist | check.5 | `1` | _(absent)_ |
| Ebony Gardens | checklist | check.6 | `1` | _(absent)_ |
| Ebony Gardens | checklist | check.7 | `1` | _(absent)_ |
| Ebony Gardens | checklist | check.8 | `1` | _(absent)_ |
| Ebony Gardens | checklist | check.9 | `1` | _(absent)_ |
| Ebony Gardens | checklist | check.10 | `1` | _(absent)_ |
| Ebony Gardens | checklist | check.11 | `1` | _(absent)_ |
| Ebony Gardens | checklist | check.12 | `1` | _(absent)_ |
| Ebony Gardens | checklist | check.13 | `1` | _(absent)_ |
| Ebony Gardens | checklist | check.14 | `0` | _(absent)_ |
| Ebony Gardens | checklist | check.15 | `1` | _(absent)_ |
| Ebony Gardens | checklist | check.16 | `1` | _(absent)_ |
| Ebony Gardens | checklist | checklist.signature | `DavidPearson,VPofGP` | _(absent)_ |
| Ebony Gardens | rentSchedule | property.name | `EbonyGardens` | _(absent)_ |
| Ebony Gardens | rentSchedule | rent_schedule.date_eff | `12/08/2025` | _(absent)_ |
| Ebony Gardens | rentSchedule | rent_schedule.eff_month | `12` | _(absent)_ |
| Ebony Gardens | rentSchedule | rent_schedule.eff_day | `08` | _(absent)_ |
| Ebony Gardens | rentSchedule | rent_schedule.eff_year | `2025` | _(absent)_ |
| Ebony Gardens | rentSchedule | total.contract_rent | `550625` | _(absent)_ |
| Ebony Gardens | rentSchedule | total.annual | `6607500` | _(absent)_ |
| Ebony Gardens | rentSchedule | nonrev.total_rent | `3700` | _(absent)_ |
| Ebony Gardens | rentSchedule | owner.entity_name | `EGMtVernonPreservationLP` | _(absent)_ |
| Ebony Gardens | rentSchedule | sig.name_title | `DavidPearson,VicePresidentofGener…` | _(absent)_ |
| Ebony Gardens | rentSchedule | total.units | `144` | _(absent)_ |
| Ebony Gardens | rentSchedule | unit.0.type | `1BR/1BA` | _(absent)_ |
| Ebony Gardens | rentSchedule | unit.0.units | `36` | _(absent)_ |
| Ebony Gardens | rentSchedule | unit.0.rent | `3300` | _(absent)_ |
| Ebony Gardens | rentSchedule | unit.0.extension | `118800` | _(absent)_ |
| Ebony Gardens | rentSchedule | unit.0.ua | `96` | _(absent)_ |
| Ebony Gardens | rentSchedule | unit.0.gross | `3396` | _(absent)_ |
| Ebony Gardens | rentSchedule | unit.0.row | `0` | _(absent)_ |
| Ebony Gardens | rentSchedule | unit.1.type | `2BR/1BA` | _(absent)_ |
| Ebony Gardens | rentSchedule | unit.1.units | `83` | _(absent)_ |
| Ebony Gardens | rentSchedule | unit.1.rent | `3700` | _(absent)_ |
| Ebony Gardens | rentSchedule | unit.1.extension | `307100` | _(absent)_ |
| Ebony Gardens | rentSchedule | unit.1.ua | `117` | _(absent)_ |
| Ebony Gardens | rentSchedule | unit.1.gross | `3817` | _(absent)_ |
| Ebony Gardens | rentSchedule | unit.1.row | `1` | _(absent)_ |
| Ebony Gardens | rentSchedule | unit.2.type | `3BR/1.5BAsmall` | _(absent)_ |
| Ebony Gardens | rentSchedule | unit.2.units | `21` | _(absent)_ |
| Ebony Gardens | rentSchedule | unit.2.rent | `5185` | _(absent)_ |
| Ebony Gardens | rentSchedule | unit.2.extension | `108885` | _(absent)_ |
| Ebony Gardens | rentSchedule | unit.2.ua | `129` | _(absent)_ |
| Ebony Gardens | rentSchedule | unit.2.gross | `5314` | _(absent)_ |
| Ebony Gardens | rentSchedule | unit.2.row | `2` | _(absent)_ |
| Ebony Gardens | rentSchedule | unit.3.type | `3BR/1.5BAlarge` | _(absent)_ |
| Ebony Gardens | rentSchedule | unit.3.units | `3` | _(absent)_ |
| Ebony Gardens | rentSchedule | unit.3.rent | `5280` | _(absent)_ |
| Ebony Gardens | rentSchedule | unit.3.extension | `15840` | _(absent)_ |
| Ebony Gardens | rentSchedule | unit.3.ua | `125` | _(absent)_ |
| Ebony Gardens | rentSchedule | unit.3.gross | `5405` | _(absent)_ |
| Ebony Gardens | rentSchedule | unit.3.row | `3` | _(absent)_ |
| Ebony Gardens | rentSchedule | unit.4.type | `2BR` | _(absent)_ |
| Ebony Gardens | rentSchedule | unit.4.units | `1` | _(absent)_ |
| Ebony Gardens | rentSchedule | unit.4.rent | `0` | _(absent)_ |
| Ebony Gardens | rentSchedule | unit.4.extension | `0` | _(absent)_ |
| Ebony Gardens | rentSchedule | unit.4.ua | `0` | _(absent)_ |
| Ebony Gardens | rentSchedule | unit.4.gross | `0` | _(absent)_ |
| Ebony Gardens | rentSchedule | unit.4.row | `5` | _(absent)_ |
| Ebony Gardens | rentSchedule | owner.entity_type | `LimitedPartnership` | _(absent)_ |
| Ebony Gardens | rentSchedule | partb.equipment.0 | `1` | _(absent)_ |
| Ebony Gardens | rentSchedule | partb.equipment.1 | `1` | _(absent)_ |
| Ebony Gardens | rentSchedule | partb.utilities.0 | `1` | _(absent)_ |
| Ebony Gardens | rentSchedule | partb.utilities.2 | `1` | _(absent)_ |
| Ebony Gardens | rentSchedule | partb.utilities.3 | `1` | _(absent)_ |
| Ebony Gardens | rentSchedule | partb.fuel.0 | `G` | _(absent)_ |
| Ebony Gardens | rentSchedule | partb.fuel.2 | `G` | _(absent)_ |
| Ebony Gardens | rentSchedule | partb.fuel.3 | `G` | _(absent)_ |
| Ebony Gardens | rentSchedule | partb.fuel.4 | `E` | _(absent)_ |
| Ebony Gardens | rentSchedule | partb.writein.e1.on | `1` | _(absent)_ |
| Ebony Gardens | rentSchedule | partb.writein.e1 | `Shades` | _(absent)_ |
| Ebony Gardens | rentSchedule | nonrev.0.use | `Superintendent` | _(absent)_ |
| Ebony Gardens | rentSchedule | nonrev.0.type | `2BR` | _(absent)_ |
| Ebony Gardens | rentSchedule | nonrev.0.rent | `3700` | _(absent)_ |
| Ebony Gardens | rentSchedule | principals.0.name | `EGMt.VernonPreservationGP,LLCGene…` | _(absent)_ |
| Ebony Gardens | rentSchedule | principals.1.name | `EGMt.VernonClassB,LLCClassBLimite…` | _(absent)_ |
| Ebony Gardens | rentSchedule | principals.2.name | `WellsFargoAffordableHousingCommun…` | _(absent)_ |
| Ebony Gardens | analysisXlsx | property.name | `EbonyGardens` | _(absent)_ |
| Ebony Gardens | analysisXlsx | appr.firm | `BelfryValuation,LLC` | _(absent)_ |
| Ebony Gardens | analysisXlsx | unit.0.type | `1BR/1BA` | _(absent)_ |
| Ebony Gardens | analysisXlsx | unit.0.units | `36` | _(absent)_ |
| Ebony Gardens | analysisXlsx | unit.0.current | `2083` | _(absent)_ |
| Ebony Gardens | analysisXlsx | unit.0.proposed | `3300` | _(absent)_ |
| Ebony Gardens | analysisXlsx | unit.0.ua | `96` | _(absent)_ |
| Ebony Gardens | analysisXlsx | unit.0.safmr | `2490` | _(absent)_ |
| Ebony Gardens | analysisXlsx | unit.1.type | `2BR/1BA` | _(absent)_ |
| Ebony Gardens | analysisXlsx | unit.1.units | `83` | _(absent)_ |
| Ebony Gardens | analysisXlsx | unit.1.current | `2320` | _(absent)_ |
| Ebony Gardens | analysisXlsx | unit.1.proposed | `3700` | _(absent)_ |
| Ebony Gardens | analysisXlsx | unit.1.ua | `117` | _(absent)_ |
| Ebony Gardens | analysisXlsx | unit.1.safmr | `2730` | _(absent)_ |
| Ebony Gardens | analysisXlsx | unit.2.type | `3BR/1.5BAsmall` | _(absent)_ |
| Ebony Gardens | analysisXlsx | unit.2.units | `21` | _(absent)_ |
| Ebony Gardens | analysisXlsx | unit.2.current | `2774` | _(absent)_ |
| Ebony Gardens | analysisXlsx | unit.2.proposed | `5185` | _(absent)_ |
| Ebony Gardens | analysisXlsx | unit.2.ua | `129` | _(absent)_ |
| Ebony Gardens | analysisXlsx | unit.2.safmr | `3420` | _(absent)_ |
| Ebony Gardens | analysisXlsx | unit.3.type | `3BR/1.5BAlarge` | _(absent)_ |
| Ebony Gardens | analysisXlsx | unit.3.units | `3` | _(absent)_ |
| Ebony Gardens | analysisXlsx | unit.3.current | `2898` | _(absent)_ |
| Ebony Gardens | analysisXlsx | unit.3.proposed | `5280` | _(absent)_ |
| Ebony Gardens | analysisXlsx | unit.3.ua | `125` | _(absent)_ |
| Ebony Gardens | analysisXlsx | unit.3.safmr | `3420` | _(absent)_ |
| Hampshire House | checklist | heading | `Owner’s  Checklist for  RCS  Subm…` | _(absent)_ |
| Hampshire House | checklist | property.name | `HampshireHouseNJ390030010` | _(absent)_ |
| Hampshire House | checklist | check.0 | `1` | _(absent)_ |
| Hampshire House | checklist | check.1 | `1` | _(absent)_ |
| Hampshire House | checklist | check.2 | `0` | _(absent)_ |
| Hampshire House | checklist | check.3 | `1` | _(absent)_ |
| Hampshire House | checklist | check.4 | `1` | _(absent)_ |
| Hampshire House | checklist | check.5 | `1` | _(absent)_ |
| Hampshire House | checklist | check.6 | `1` | _(absent)_ |
| Hampshire House | checklist | check.7 | `1` | _(absent)_ |
| Hampshire House | checklist | check.8 | `1` | _(absent)_ |
| Hampshire House | checklist | check.9 | `1` | _(absent)_ |
| Hampshire House | checklist | check.10 | `1` | _(absent)_ |
| Hampshire House | checklist | check.11 | `1` | _(absent)_ |
| Hampshire House | checklist | check.12 | `1` | _(absent)_ |
| Hampshire House | checklist | check.13 | `1` | _(absent)_ |
| Hampshire House | checklist | check.14 | `1` | _(absent)_ |
| Hampshire House | checklist | check.15 | `1` | _(absent)_ |
| Hampshire House | checklist | check.16 | `1` | _(absent)_ |
| Hampshire House | checklist | checklist.signature | `DavidPearson,VPofGP` | _(absent)_ |
| Hampshire House | rentSchedule | property.name | `HampshireHouseNJ390030010` | _(absent)_ |
| Hampshire House | rentSchedule | property.fha | `n/a` | _(absent)_ |
| Hampshire House | rentSchedule | rent_schedule.date_eff | `10/01/2024` | _(absent)_ |
| Hampshire House | rentSchedule | rent_schedule.eff_month | `10` | _(absent)_ |
| Hampshire House | rentSchedule | rent_schedule.eff_day | `01` | _(absent)_ |
| Hampshire House | rentSchedule | rent_schedule.eff_year | `2024` | _(absent)_ |
| Hampshire House | rentSchedule | total.contract_rent | `240000` | _(absent)_ |
| Hampshire House | rentSchedule | total.annual | `2880000` | _(absent)_ |
| Hampshire House | rentSchedule | nonrev.total_rent | `0` | _(absent)_ |
| Hampshire House | rentSchedule | owner.entity_name | `HampshireUrbanRenewalPreservation…` | _(absent)_ |
| Hampshire House | rentSchedule | sig.name_title | `DavidPearson,VicePresidentofGener…` | _(absent)_ |
| Hampshire House | rentSchedule | total.units | `115` | _(absent)_ |
| Hampshire House | rentSchedule | unit.0.type | `1BR/1BA` | _(absent)_ |
| Hampshire House | rentSchedule | unit.0.units | `90` | _(absent)_ |
| Hampshire House | rentSchedule | unit.0.rent | `2000` | _(absent)_ |
| Hampshire House | rentSchedule | unit.0.extension | `180000` | _(absent)_ |
| Hampshire House | rentSchedule | unit.0.ua | `70` | _(absent)_ |
| Hampshire House | rentSchedule | unit.0.gross | `2070` | _(absent)_ |
| Hampshire House | rentSchedule | unit.0.row | `0` | _(absent)_ |
| Hampshire House | rentSchedule | unit.1.type | `2BR/1BA` | _(absent)_ |
| Hampshire House | rentSchedule | unit.1.units | `25` | _(absent)_ |
| Hampshire House | rentSchedule | unit.1.rent | `2400` | _(absent)_ |
| Hampshire House | rentSchedule | unit.1.extension | `60000` | _(absent)_ |
| Hampshire House | rentSchedule | unit.1.ua | `86` | _(absent)_ |
| Hampshire House | rentSchedule | unit.1.gross | `2486` | _(absent)_ |
| Hampshire House | rentSchedule | unit.1.row | `1` | _(absent)_ |
| Hampshire House | rentSchedule | owner.entity_type | `LimitedPartnership` | _(absent)_ |
| Hampshire House | rentSchedule | partb.equipment.0 | `1` | _(absent)_ |
| Hampshire House | rentSchedule | partb.equipment.1 | `1` | _(absent)_ |
| Hampshire House | rentSchedule | partb.utilities.0 | `1` | _(absent)_ |
| Hampshire House | rentSchedule | partb.utilities.1 | `1` | _(absent)_ |
| Hampshire House | rentSchedule | partb.utilities.2 | `1` | _(absent)_ |
| Hampshire House | rentSchedule | partb.utilities.3 | `1` | _(absent)_ |
| Hampshire House | rentSchedule | partb.utilities.4 | `1` | _(absent)_ |
| Hampshire House | rentSchedule | partb.fuel.0 | `G` | _(absent)_ |
| Hampshire House | rentSchedule | partb.fuel.1 | `E` | _(absent)_ |
| Hampshire House | rentSchedule | partb.fuel.2 | `G` | _(absent)_ |
| Hampshire House | rentSchedule | partb.fuel.3 | `E` | _(absent)_ |
| Hampshire House | rentSchedule | partb.fuel.4 | `E` | _(absent)_ |
| Hampshire House | rentSchedule | principals.0.name | `HampshirePreservationGP,LLC` | _(absent)_ |
| Hampshire House | rentSchedule | principals.0.title | `GeneralPartner` | _(absent)_ |
| Hampshire House | rentSchedule | principals.1.name | `HampshirePreservationGPII,LLC` | _(absent)_ |
| Hampshire House | rentSchedule | principals.1.title | `Co-GeneralPartner` | _(absent)_ |
| Hampshire House | analysisXlsx | property.name | `HampshireHouseNJ390030010` | _(absent)_ |
| Hampshire House | analysisXlsx | appr.firm | `Renzi&Associates` | _(absent)_ |
| Hampshire House | analysisXlsx | unit.0.type | `1BR/1BA` | _(absent)_ |
| Hampshire House | analysisXlsx | unit.0.units | `90` | _(absent)_ |
| Hampshire House | analysisXlsx | unit.0.current | `1368` | _(absent)_ |
| Hampshire House | analysisXlsx | unit.0.proposed | `2000` | _(absent)_ |
| Hampshire House | analysisXlsx | unit.0.ua | `70` | _(absent)_ |
| Hampshire House | analysisXlsx | unit.0.safmr | `1500` | _(absent)_ |
| Hampshire House | analysisXlsx | unit.1.type | `2BR/1BA` | _(absent)_ |
| Hampshire House | analysisXlsx | unit.1.units | `25` | _(absent)_ |
| Hampshire House | analysisXlsx | unit.1.current | `1675` | _(absent)_ |
| Hampshire House | analysisXlsx | unit.1.proposed | `2400` | _(absent)_ |
| Hampshire House | analysisXlsx | unit.1.ua | `86` | _(absent)_ |
| Hampshire House | analysisXlsx | unit.1.safmr | `1810` | _(absent)_ |
| Morh Housing | analysisXlsx | unit.0.type | `3BR/1.5BA` | `3BR` |
| Morh Housing | analysisXlsx | unit.0.proposed | `4000` | _(absent)_ |
| Morh Housing | analysisXlsx | unit.1.type | `4BR/1.5BA` | `4BR` |
| Morh Housing | analysisXlsx | unit.1.proposed | `4600` | _(absent)_ |
| Morh Housing | analysisXlsx | unit.2.type | `4BR/1.5BA` | `4BR` |
| Morh Housing | analysisXlsx | unit.2.proposed | `4600` | _(absent)_ |
| New Horizons | analysisXlsx | property.name | `NewHorizons` | _(absent)_ |
| New Horizons | analysisXlsx | appr.firm | `Appraiser` | _(absent)_ |
| New Horizons | analysisXlsx | unit.0.type | `1BR/1BA` | _(absent)_ |
| New Horizons | analysisXlsx | unit.0.units | `6` | _(absent)_ |
| New Horizons | analysisXlsx | unit.0.current | `3053` | _(absent)_ |
| New Horizons | analysisXlsx | unit.0.proposed | `3150` | _(absent)_ |
| New Horizons | analysisXlsx | unit.0.ua | `132` | _(absent)_ |
| New Horizons | analysisXlsx | unit.1.type | `2BR/1BA` | _(absent)_ |
| New Horizons | analysisXlsx | unit.1.units | `19` | _(absent)_ |
| New Horizons | analysisXlsx | unit.1.current | `3875` | _(absent)_ |
| New Horizons | analysisXlsx | unit.1.proposed | `4000` | _(absent)_ |
| New Horizons | analysisXlsx | unit.1.ua | `138` | _(absent)_ |
| New Horizons | analysisXlsx | unit.2.type | `3BR/1BA` | _(absent)_ |
| New Horizons | analysisXlsx | unit.2.units | `16` | _(absent)_ |
| New Horizons | analysisXlsx | unit.2.current | `4228` | _(absent)_ |
| New Horizons | analysisXlsx | unit.2.proposed | `4350` | _(absent)_ |
| New Horizons | analysisXlsx | unit.2.ua | `151` | _(absent)_ |
| New Horizons | analysisXlsx | unit.3.type | `4BR/1BA` | _(absent)_ |
| New Horizons | analysisXlsx | unit.3.units | `6` | _(absent)_ |
| New Horizons | analysisXlsx | unit.3.current | `5285` | _(absent)_ |
| New Horizons | analysisXlsx | unit.3.proposed | `5450` | _(absent)_ |
| New Horizons | analysisXlsx | unit.3.ua | `140` | _(absent)_ |
| New Horizons | analysisXlsx | property.name | `U.S.DepartmentofHousingRentSchedu…` | _(absent)_ |
| New Horizons | analysisXlsx | appr.firm | `Appraiser` | _(absent)_ |
| New Horizons | analysisXlsx | unit.0.type | `1BR` | _(absent)_ |
| New Horizons | analysisXlsx | unit.0.units | `8` | _(absent)_ |
| New Horizons | analysisXlsx | unit.0.current | `0.22408` | _(absent)_ |
| New Horizons | analysisXlsx | unit.0.ua | `2511` | _(absent)_ |
| New Horizons | analysisXlsx | unit.1.type | `2BR` | _(absent)_ |
| New Horizons | analysisXlsx | unit.1.units | `19` | _(absent)_ |
| New Horizons | analysisXlsx | unit.1.current | `2820` | _(absent)_ |
| New Horizons | analysisXlsx | unit.1.ua | `2927` | _(absent)_ |
| New Horizons | analysisXlsx | unit.2.type | `3BR` | _(absent)_ |
| New Horizons | analysisXlsx | unit.2.units | `16` | _(absent)_ |
| New Horizons | analysisXlsx | unit.2.current | `3402` | _(absent)_ |
| New Horizons | analysisXlsx | unit.2.ua | `3516` | _(absent)_ |
| New Horizons | analysisXlsx | unit.3.type | `4BR` | _(absent)_ |
| New Horizons | analysisXlsx | unit.3.units | `8` | _(absent)_ |
| New Horizons | analysisXlsx | unit.3.current | `3873` | _(absent)_ |
| New Horizons | analysisXlsx | unit.3.ua | `4015` | _(absent)_ |
| Noble Tower | rentSchedule | total.contract_rent | `604500` | _(absent)_ |
| Noble Tower | rentSchedule | total.annual | `7254000` | _(absent)_ |
| Noble Tower | rentSchedule | unit.0.rent | `3100` | _(absent)_ |
| Noble Tower | rentSchedule | unit.0.extension | `564200` | _(absent)_ |
| Noble Tower | rentSchedule | unit.0.gross | `3100` | _(absent)_ |
| Noble Tower | rentSchedule | unit.1.rent | `3100` | _(absent)_ |
| Noble Tower | rentSchedule | unit.1.extension | `40300` | _(absent)_ |
| Noble Tower | rentSchedule | unit.1.gross | `3100` | _(absent)_ |
| Noble Tower | analysisXlsx | appr.firm | `©2024VanHazingaAppraisal&Consulti…` | `Appraiser` |
| Noble Tower | analysisXlsx | unit.0.proposed | `3100` | _(absent)_ |
| Noble Tower | analysisXlsx | unit.1.proposed | `3100` | _(absent)_ |
| North Park | analysisXlsx | property.name | `NorthParkApts` | _(absent)_ |
| North Park | analysisXlsx | appr.firm | `Renzi&Associates` | _(absent)_ |
| North Park | analysisXlsx | unit.0.type | `Studio/1BA` | _(absent)_ |
| North Park | analysisXlsx | unit.0.units | `32` | _(absent)_ |
| North Park | analysisXlsx | unit.0.current | `2835` | _(absent)_ |
| North Park | analysisXlsx | unit.0.proposed | `3400` | _(absent)_ |
| North Park | analysisXlsx | unit.0.ua | `74` | _(absent)_ |
| North Park | analysisXlsx | unit.0.safmr | `2220` | _(absent)_ |
| North Park | analysisXlsx | unit.1.type | `1BR/1BA` | _(absent)_ |
| North Park | analysisXlsx | unit.1.units | `33` | _(absent)_ |
| North Park | analysisXlsx | unit.1.current | `3834` | _(absent)_ |
| North Park | analysisXlsx | unit.1.proposed | `4400` | _(absent)_ |
| North Park | analysisXlsx | unit.1.ua | `81` | _(absent)_ |
| North Park | analysisXlsx | unit.1.safmr | `2310` | _(absent)_ |
| North Park | analysisXlsx | unit.2.type | `2BR/1BA` | _(absent)_ |
| North Park | analysisXlsx | unit.2.units | `52` | _(absent)_ |
| North Park | analysisXlsx | unit.2.current | `4913` | _(absent)_ |
| North Park | analysisXlsx | unit.2.proposed | `6000` | _(absent)_ |
| North Park | analysisXlsx | unit.2.ua | `85` | _(absent)_ |
| North Park | analysisXlsx | unit.2.safmr | `2560` | _(absent)_ |
| North Park | analysisXlsx | unit.3.type | `3BR/1.5BA` | _(absent)_ |
| North Park | analysisXlsx | unit.3.units | `5` | _(absent)_ |
| North Park | analysisXlsx | unit.3.current | `5501` | _(absent)_ |
| North Park | analysisXlsx | unit.3.proposed | `6900` | _(absent)_ |
| North Park | analysisXlsx | unit.3.ua | `109` | _(absent)_ |
| North Park | analysisXlsx | unit.3.safmr | `3190` | _(absent)_ |
| North Park | analysisXlsx | property.name | `LowRentHousingOfficeofHousingFede…` | _(absent)_ |
| North Park | analysisXlsx | appr.firm | `METROPOLITANVALUATIONSERVICES,INC.` | _(absent)_ |
| North Park | analysisXlsx | unit.0.type | `Studio` | _(absent)_ |
| North Park | analysisXlsx | unit.0.units | `32` | _(absent)_ |
| North Park | analysisXlsx | unit.0.current | `2520` | _(absent)_ |
| North Park | analysisXlsx | unit.0.proposed | `2625` | _(absent)_ |
| North Park | analysisXlsx | unit.0.ua | `70` | _(absent)_ |
| North Park | analysisXlsx | unit.0.safmr | `2529` | _(absent)_ |
| North Park | analysisXlsx | unit.1.type | `1BR` | _(absent)_ |
| North Park | analysisXlsx | unit.1.units | `33` | _(absent)_ |
| North Park | analysisXlsx | unit.1.current | `3429` | _(absent)_ |
| North Park | analysisXlsx | unit.1.proposed | `3550` | _(absent)_ |
| North Park | analysisXlsx | unit.1.ua | `73` | _(absent)_ |
| North Park | analysisXlsx | unit.1.safmr | `2655` | _(absent)_ |
| North Park | analysisXlsx | unit.2.type | `3BR` | _(absent)_ |
| North Park | analysisXlsx | unit.2.units | `525` | _(absent)_ |
| North Park | analysisXlsx | unit.2.current | `44305082` | _(absent)_ |
| North Park | analysisXlsx | unit.2.proposed | `5095` | _(absent)_ |
| North Park | analysisXlsx | unit.2.ua | `8599` | _(absent)_ |
| North Park | analysisXlsx | unit.2.safmr | `3644` | _(absent)_ |
| North Park | analysisXlsx | unit.3.type | `2BR` | _(absent)_ |
| North Park | analysisXlsx | unit.3.units | `52` | _(absent)_ |
| North Park | analysisXlsx | unit.3.proposed | `4550` | _(absent)_ |
| North Park | analysisXlsx | unit.3.safmr | `2910` | _(absent)_ |
| Northgate Terrace CA | analysisXlsx | unit.0.type | `Studio` | `Studio/1BA` |
| Northgate Terrace CA | analysisXlsx | unit.1.type | `1BR` | `1BR/1BA` |
| Northgate Terrace CA | analysisXlsx | unit.0.proposed | _(absent)_ | `2075` |
| Northgate Terrace CA | analysisXlsx | unit.1.proposed | _(absent)_ | `2095` |
| Oak Center | analysisXlsx | unit.0.type | `1BR/1BA` | `1BR` |
| Oak Center | analysisXlsx | unit.0.proposed | `2500` | _(absent)_ |
| Oak Center | analysisXlsx | unit.1.type | `2BR/1BA` | `2BR` |
| Oak Center | analysisXlsx | unit.1.proposed | `2800` | _(absent)_ |
| Oaks on North Plaza | analysisXlsx | unit.0.safmr | `1852` | `1490` |
| Oaks on North Plaza | analysisXlsx | unit.3.type | `3BR` | `3BR/1.5BA` |
| Oaks on North Plaza | analysisXlsx | unit.3.safmr | `2347` | `1760` |
| Oaks on North Plaza | analysisXlsx | unit.5.type | `1BR/1BA` | `3BR/1.5BA` |
| Oaks on North Plaza | analysisXlsx | unit.5.units | `14` | `1` |
| Oaks on North Plaza | analysisXlsx | unit.5.proposed | `1570` | `2325` |
| Oaks on North Plaza | analysisXlsx | unit.5.ua | `80` | `171` |
| Oaks on North Plaza | analysisXlsx | unit.5.safmr | `1490` | `2240` |
| Oaks on North Plaza | analysisXlsx | unit.0.proposed | _(absent)_ | `1570` |
| Oaks on North Plaza | analysisXlsx | unit.3.proposed | _(absent)_ | `2025` |
| Oaks on North Plaza | analysisXlsx | unit.5.current | _(absent)_ | `1198` |
| Oaks on North Plaza | analysisXlsx | unit.6.type | _(absent)_ | `1BR/1BA` |
| Oaks on North Plaza | analysisXlsx | unit.6.units | _(absent)_ | `14` |
| Oaks on North Plaza | analysisXlsx | unit.6.proposed | _(absent)_ | `1570` |
| Oaks on North Plaza | analysisXlsx | unit.6.ua | _(absent)_ | `80` |
| Oaks on North Plaza | analysisXlsx | unit.6.safmr | _(absent)_ | `1490` |
| Peterson Plaza | rentSchedule | total.contract_rent | `34000` | `286230` |
| Peterson Plaza | rentSchedule | total.annual | `408000` | `3434760` |
| Peterson Plaza | rentSchedule | nonrev.total_rent | `1586` | `1680` |
| Peterson Plaza | rentSchedule | unit.0.type | `1BR` | `1BR/1BA` |
| Peterson Plaza | rentSchedule | unit.1.type | `1BR` | `1BR/1BA` |
| Peterson Plaza | rentSchedule | unit.2.type | `2BR` | `2BR/1BA` |
| Peterson Plaza | rentSchedule | unit.3.type | `2BR` | `2BR/1BA` |
| Peterson Plaza | rentSchedule | nonrev.0.rent | `1586` | `1680` |
| Peterson Plaza | rentSchedule | unit.0.rent | _(absent)_ | `1400` |
| Peterson Plaza | rentSchedule | unit.0.extension | _(absent)_ | `140000` |
| Peterson Plaza | rentSchedule | unit.0.gross | _(absent)_ | `1471` |
| Peterson Plaza | rentSchedule | unit.1.rent | _(absent)_ | `1410` |
| Peterson Plaza | rentSchedule | unit.1.extension | _(absent)_ | `42300` |
| Peterson Plaza | rentSchedule | unit.1.gross | _(absent)_ | `1473` |
| Peterson Plaza | rentSchedule | unit.2.rent | _(absent)_ | `1680` |
| Peterson Plaza | rentSchedule | unit.2.extension | _(absent)_ | `1680` |
| Peterson Plaza | rentSchedule | unit.2.gross | _(absent)_ | `1766` |
| Peterson Plaza | rentSchedule | unit.3.rent | _(absent)_ | `1625` |
| Peterson Plaza | rentSchedule | unit.3.extension | _(absent)_ | `68250` |
| Peterson Plaza | rentSchedule | unit.3.gross | _(absent)_ | `1711` |
| Peterson Plaza | analysisXlsx | unit.0.type | `1BR` | `1BR/1BA` |
| Peterson Plaza | analysisXlsx | unit.1.type | `1BR` | `1BR/1BA` |
| Peterson Plaza | analysisXlsx | unit.2.type | `2BR` | `2BR/1BA` |
| Peterson Plaza | analysisXlsx | unit.3.type | `2BR` | `2BR/1BA` |
| Peterson Plaza | analysisXlsx | unit.0.proposed | _(absent)_ | `1400` |
| Peterson Plaza | analysisXlsx | unit.1.proposed | _(absent)_ | `1410` |
| Peterson Plaza | analysisXlsx | unit.2.proposed | _(absent)_ | `1680` |
| Peterson Plaza | analysisXlsx | unit.3.proposed | _(absent)_ | `1625` |
| Riverwood | analysisXlsx | property.name | `RIVERWOODAPTS` | _(absent)_ |
| Riverwood | analysisXlsx | appr.firm | `Appraiser` | _(absent)_ |
| Riverwood | analysisXlsx | unit.0.type | `1BR` | _(absent)_ |
| Riverwood | analysisXlsx | unit.0.units | `4` | _(absent)_ |
| Riverwood | analysisXlsx | unit.0.current | `1136` | _(absent)_ |
| Riverwood | analysisXlsx | unit.0.ua | `71` | _(absent)_ |
| Riverwood | analysisXlsx | unit.1.type | `1BRFamily` | _(absent)_ |
| Riverwood | analysisXlsx | unit.1.units | `23` | _(absent)_ |
| Riverwood | analysisXlsx | unit.1.current | `1165` | _(absent)_ |
| Riverwood | analysisXlsx | unit.1.ua | `71` | _(absent)_ |
| Riverwood | analysisXlsx | unit.2.type | `2BRFamily` | _(absent)_ |
| Riverwood | analysisXlsx | unit.2.units | `32` | _(absent)_ |
| Riverwood | analysisXlsx | unit.2.current | `1306` | _(absent)_ |
| Riverwood | analysisXlsx | unit.2.ua | `85` | _(absent)_ |
| Riverwood | analysisXlsx | unit.3.type | `3BRFamily` | _(absent)_ |
| Riverwood | analysisXlsx | unit.3.units | `24` | _(absent)_ |
| Riverwood | analysisXlsx | unit.3.current | `1393` | _(absent)_ |
| Riverwood | analysisXlsx | unit.3.ua | `142` | _(absent)_ |
| Shiloh Village | analysisXlsx | property.name | `ProjectNameFHAShilohVillageApts.` | _(absent)_ |
| Shiloh Village | analysisXlsx | appr.firm | `Appraiser` | _(absent)_ |
| Shiloh Village | analysisXlsx | unit.0.type | `2BR` | _(absent)_ |
| Shiloh Village | analysisXlsx | unit.0.units | `16` | _(absent)_ |
| Shiloh Village | analysisXlsx | unit.0.current | `877` | _(absent)_ |
| Shiloh Village | analysisXlsx | unit.0.ua | `84` | _(absent)_ |
| Shiloh Village | analysisXlsx | unit.1.type | `3BR` | _(absent)_ |
| Shiloh Village | analysisXlsx | unit.1.units | `80` | _(absent)_ |
| Shiloh Village | analysisXlsx | unit.1.current | `1038` | _(absent)_ |
| Shiloh Village | analysisXlsx | unit.1.ua | `97` | _(absent)_ |
| Shiloh Village | analysisXlsx | unit.2.type | `4BR` | _(absent)_ |
| Shiloh Village | analysisXlsx | unit.2.units | `72` | _(absent)_ |
| Shiloh Village | analysisXlsx | unit.2.current | `1109` | _(absent)_ |
| Shiloh Village | analysisXlsx | unit.2.ua | `95` | _(absent)_ |
| Sycamore Green | analysisXlsx | property.name | `FederalHousingSeepage3forinstruct…` | _(absent)_ |
| Sycamore Green | analysisXlsx | appr.firm | `Appraiser` | _(absent)_ |
| Sycamore Green | analysisXlsx | unit.0.type | `1BR` | _(absent)_ |
| Sycamore Green | analysisXlsx | unit.0.units | `40` | _(absent)_ |
| Sycamore Green | analysisXlsx | unit.0.current | `783` | _(absent)_ |
| Sycamore Green | analysisXlsx | unit.0.ua | `330201936` | _(absent)_ |
| Sycamore Green | analysisXlsx | unit.1.type | `2BR` | _(absent)_ |
| Sycamore Green | analysisXlsx | unit.1.units | `154` | _(absent)_ |
| Sycamore Green | analysisXlsx | unit.1.current | `879` | _(absent)_ |
| Sycamore Green | analysisXlsx | unit.1.ua | `47` | _(absent)_ |
| Sycamore Green | analysisXlsx | unit.2.type | `2BR` | _(absent)_ |
| Sycamore Green | analysisXlsx | unit.2.units | `1` | _(absent)_ |
| Sycamore Green | analysisXlsx | unit.2.current | `753` | _(absent)_ |
| Westwood Village | analysisXlsx | property.name | `WestwoodVillage` | _(absent)_ |
| Westwood Village | analysisXlsx | appr.firm | `BelfryValuation,LLC` | _(absent)_ |
| Westwood Village | analysisXlsx | unit.0.type | `2BR/1BA` | _(absent)_ |
| Westwood Village | analysisXlsx | unit.0.units | `65` | _(absent)_ |
| Westwood Village | analysisXlsx | unit.0.proposed | `1200` | _(absent)_ |
| Westwood Village | analysisXlsx | unit.0.ua | `122` | _(absent)_ |
| Westwood Village | analysisXlsx | unit.0.safmr | `1120` | _(absent)_ |
| Westwood Village | analysisXlsx | unit.1.type | `2BR/1BA` | _(absent)_ |
| Westwood Village | analysisXlsx | unit.1.units | `3` | _(absent)_ |
| Westwood Village | analysisXlsx | unit.1.proposed | `1200` | _(absent)_ |
| Westwood Village | analysisXlsx | unit.1.ua | `86` | _(absent)_ |
| Westwood Village | analysisXlsx | unit.1.safmr | `1120` | _(absent)_ |
| Westwood Village | analysisXlsx | unit.2.type | `3BR/1BA` | _(absent)_ |
| Westwood Village | analysisXlsx | unit.2.units | `33` | _(absent)_ |
| Westwood Village | analysisXlsx | unit.2.proposed | `1350` | _(absent)_ |
| Westwood Village | analysisXlsx | unit.2.ua | `145` | _(absent)_ |
| Westwood Village | analysisXlsx | unit.2.safmr | `1570` | _(absent)_ |
| Westwood Village | analysisXlsx | unit.3.type | `3BR/1BA` | _(absent)_ |
| Westwood Village | analysisXlsx | unit.3.units | `3` | _(absent)_ |
| Westwood Village | analysisXlsx | unit.3.proposed | `1350` | _(absent)_ |
| Westwood Village | analysisXlsx | unit.3.ua | `155` | _(absent)_ |
| Westwood Village | analysisXlsx | unit.3.safmr | `1570` | _(absent)_ |
| Westwood Village | analysisXlsx | unit.4.type | `4BR/2BA` | _(absent)_ |
| Westwood Village | analysisXlsx | unit.4.units | `9` | _(absent)_ |
| Westwood Village | analysisXlsx | unit.4.proposed | `1600` | _(absent)_ |
| Westwood Village | analysisXlsx | unit.4.ua | `151` | _(absent)_ |
| Westwood Village | analysisXlsx | unit.4.safmr | `1850` | _(absent)_ |

## Documents the app did not generate

The filed package contains these; the app produced no counterpart, so
there was nothing to compare. Counted once per document, not once per field.

| document | properties | of |
|---|---:|---:|
| notes | 42 | 89 |
| sections | 42 | 89 |
| rcsStudy | 42 | 89 |
| coverLetter | 38 | 89 |
| rentSchedule | 26 | 89 |
| tenantNotice | 22 | 89 |
| checklist | 15 | 89 |
| submittalLetter | 10 | 89 |

## Properties that produced nothing comparable

Zero comparison rows is not agreement. Each of these is a property the
sweep could not test, and why.

| property | verdict | rs tier | what the app said it was missing |
|---|---|---|---|
| Cherry Garden - Section 8 | the app generated nothing comparable | — |  |
| Cherry Garden - Section 8 | the app generated nothing comparable | unreadable:scan |  |
| Clinton Manor | the app generated nothing comparable | unreadable:scan |  |
| Colonial Village - Section 8 | the app generated nothing comparable | — |  |
| Crossroads of East Ravenswood - Section 8 | the app generated nothing comparable | — |  |
| Crossroads of East Ravenswood - Section 8 | the app generated nothing comparable | — |  |
| Fairview Homes | the app generated nothing comparable | — |  |
| Fairview Homes | the app generated nothing comparable | unreadable:scan |  |
| Fairview Homes - Section 8 | the app generated nothing comparable | — |  |
| Fairview Homes - Section 8 | the app generated nothing comparable | — |  |
| Fairview Homes - Section 8 | the app generated nothing comparable | — |  |
| Friendship Court | the app generated nothing comparable | unreadable:scan |  |
| Gates Manor - Section 8 | the app generated nothing comparable | — |  |
| Golden Link Manor - Section 8 | the app generated nothing comparable | — |  |
| Golden Link Manor - Section 8 | the app generated nothing comparable | — |  |
| Lansing Manor | the app generated nothing comparable | unreadable:scan |  |
| Lansing Manor - Section 8 | the app generated nothing comparable | — |  |
| Lansing Manor - Section 8 | the app generated nothing comparable | — |  |
| Manhattan Plaza - Section 8 | the app generated nothing comparable | — |  |
| Market Square | the app generated nothing comparable | — |  |
| New Horizons | the app generated nothing comparable | unreadable:scan |  |
| Newberry Arms | the app generated nothing comparable | — |  |
| Newberry Arms | the app generated nothing comparable | — |  |
| Noble Tower | the app generated nothing comparable | — |  |
| North Park | the app generated nothing comparable | — |  |
| North Park | the app generated nothing comparable | ocr:half |  |
| Oaks on North Plaza | the app generated nothing comparable | — |  |
| Riverwood - Section 8 | the app generated nothing comparable | — |  |
| Riverwood - Section 8 | the app generated nothing comparable | — |  |
| Shiloh Village | the app generated nothing comparable | — |  |
| Southport Mews - Section 8 | the app generated nothing comparable | — |  |
| Southport Mews - Section 8 | the app generated nothing comparable | — |  |
| Sycamore Green | the app generated nothing comparable | — |  |
| The Pines | the app generated nothing comparable | — |  |
| Village Court - Section 8 | no study for this cycle | — |  |
| Walden | the app generated nothing comparable | unreadable:scan |  |
| Woodbury Oakwood (Lakeside) | the app generated nothing comparable | unreadable:scan |  |
| Woodland Towers - Section 8 | the app generated nothing comparable | — |  |
| Woodland Towers - Section 8 | the app generated nothing comparable | — |  |

## Differences, grouped by cause then by key

Read the **mismatch** rows first: those are the ones where both documents
state a value and the two disagree. A `missing-theirs` row usually means
the filed template has no such field, not that anything is wrong.

Every row starts `undiagnosed`. A cause is only set by a person, or by a
rule that says how it knows.

### Cause: undiagnosed — 2156 rows

| doc · key | properties | example ours | example filed |
|---|---:|---|---|
| analysisXlsx · property.name | 37 | `333HollyfkaHollyCreek11` | _(absent)_ |
| analysisXlsx · appr.firm | 37 | `CORNERSTONEVALUATIONSERVICES` | _(absent)_ |
| analysisXlsx · unit.0.type | 32 | `1BR/1BA` | `1BR` |
| analysisXlsx · unit.1.type | 29 | `2BR/1BA` | `2BR` |
| analysisXlsx · unit.0.ua | 25 | `0` | _(absent)_ |
| analysisXlsx · unit.2.type | 23 | `2BR/2BA` | `2BRLG` |
| checklist · check.1 | 23 | `1` | _(absent)_ |
| checklist · check.2 | 23 | `0` | _(absent)_ |
| checklist · check.3 | 23 | `1` | _(absent)_ |
| checklist · check.4 | 23 | `1` | _(absent)_ |
| checklist · check.5 | 23 | `1` | _(absent)_ |
| checklist · check.14 | 23 | `0` | _(absent)_ |
| rentSchedule · unit.0.type | 23 | `Studio/1BA` | _(absent)_ |
| rentSchedule · unit.1.type | 23 | `1BR/1BA` | _(absent)_ |
| checklist · check.0 | 22 | `1` | _(absent)_ |
| checklist · check.6 | 22 | `1` | _(absent)_ |
| checklist · check.7 | 22 | `1` | _(absent)_ |
| checklist · check.8 | 22 | `1` | _(absent)_ |
| checklist · check.9 | 22 | `1` | _(absent)_ |
| checklist · check.10 | 22 | `1` | _(absent)_ |
| checklist · check.11 | 22 | `1` | _(absent)_ |
| checklist · check.12 | 22 | `1` | _(absent)_ |
| checklist · check.13 | 22 | `1` | _(absent)_ |
| checklist · check.15 | 22 | `1` | _(absent)_ |
| checklist · check.16 | 22 | `1` | _(absent)_ |
| checklist · checklist.signature | 22 | `DavidPearson,VicePresidentofBarnu…` | _(absent)_ |
| rentSchedule · rent_schedule.eff_day | 22 | `01` | _(absent)_ |
| rentSchedule · sig.name_title | 22 | `DavidPearson,VicePresidentofBarnu…` | _(absent)_ |
| rentSchedule · unit.0.units | 22 | `17` | _(absent)_ |
| analysisXlsx · unit.1.ua | 22 | `0` | _(absent)_ |
| checklist · property.name | 21 | `BARNUMHOTELCT26H03706` | _(absent)_ |
| rentSchedule · rent_schedule.eff_month | 21 | `04` | _(absent)_ |
| rentSchedule · rent_schedule.eff_year | 21 | `2026` | _(absent)_ |
| rentSchedule · owner.entity_name | 21 | `BARNUMHOUSEPRESERVATION,L.P.` | _(absent)_ |
| rentSchedule · principals.0.name | 21 | `BARNUMHOUSEPRESERVATION,GP,LLCANE…` | _(absent)_ |
| rentSchedule · property.name | 20 | `BARNUMHOTELCT26H03706` | `N/A` |
| rentSchedule · rent_schedule.date_eff | 20 | `04/01/2026` | _(absent)_ |
| rentSchedule · nonrev.total_rent | 20 | `0` | `RentalRatePerSq.Ft` |
| rentSchedule · total.units | 20 | `83` | `YearlyContractRentPotential` |
| rentSchedule · unit.0.extension | 20 | `39525` | _(absent)_ |
| rentSchedule · unit.0.ua | 20 | `0` | _(absent)_ |
| rentSchedule · unit.1.units | 20 | `66` | _(absent)_ |
| rentSchedule · unit.1.ua | 20 | `0` | _(absent)_ |
| rentSchedule · owner.entity_type | 20 | `LimitedPartnership` | _(absent)_ |
| rentSchedule · partb.equipment.0 | 20 | `1` | _(absent)_ |
| rentSchedule · partb.equipment.1 | 20 | `1` | _(absent)_ |
| rentSchedule · unit.2.type | 20 | `2BR/1.5BATH` | _(absent)_ |
| rentSchedule · total.contract_rent | 19 | `225975` | _(absent)_ |
| rentSchedule · total.annual | 19 | `2711700` | _(absent)_ |
| rentSchedule · unit.0.rent | 19 | `2325` | _(absent)_ |
| rentSchedule · unit.0.gross | 19 | `2325` | _(absent)_ |
| rentSchedule · partb.fuel.0 | 18 | `G` | _(absent)_ |
| rentSchedule · unit.2.units | 18 | `55` | _(absent)_ |
| rentSchedule · unit.1.rent | 17 | `2825` | _(absent)_ |
| rentSchedule · unit.1.extension | 17 | `186450` | _(absent)_ |
| rentSchedule · unit.1.gross | 17 | `2825` | _(absent)_ |
| rentSchedule · unit.1.row | 17 | `1` | _(absent)_ |
| rentSchedule · partb.fuel.2 | 17 | `G` | _(absent)_ |
| rentSchedule · partb.fuel.3 | 17 | `G` | _(absent)_ |
| rentSchedule · principals.1.name | 17 | `DAVIDPEARSON` | _(absent)_ |
| analysisXlsx · unit.3.type | 16 | `3BR/2BA` | `3BR` |
| rentSchedule · unit.0.row | 16 | `0` | _(absent)_ |
| rentSchedule · partb.fuel.4 | 16 | `E` | _(absent)_ |
| analysisXlsx · unit.0.safmr | 16 | `1580` | _(absent)_ |
| rentSchedule · unit.2.rent | 16 | `3400` | _(absent)_ |
| rentSchedule · unit.2.extension | 16 | `187000` | _(absent)_ |
| rentSchedule · unit.2.ua | 16 | `128` | _(absent)_ |
| rentSchedule · unit.2.gross | 16 | `3528` | _(absent)_ |
| analysisXlsx · unit.0.proposed | 16 | `2450` | _(absent)_ |
| analysisXlsx · unit.1.proposed | 16 | `3275` | _(absent)_ |
| analysisXlsx · unit.2.ua | 16 | `131` | _(absent)_ |
| rentSchedule · principals.0.title | 15 | `GENERALPARTNER` | _(absent)_ |
| rentSchedule · partb.equipment.5 | 15 | _(absent)_ | `1` |
| analysisXlsx · unit.1.safmr | 15 | `1920` | _(absent)_ |
| rentSchedule · partb.services.0 | 15 | `1` | _(absent)_ |
| rentSchedule · unit.2.row | 15 | `2` | _(absent)_ |
| rentSchedule · nonrev.0.use | 14 | _(absent)_ | `Col.2` |
| analysisXlsx · unit.2.safmr | 14 | `2640` | _(absent)_ |
| rentSchedule · nonrev.0.type | 13 | _(absent)_ | `Col.2` |
| rentSchedule · nonrev.0.rent | 13 | _(absent)_ | `Col.4` |
| rentSchedule · partb.writein.e1.on | 12 | `1` | _(absent)_ |
| rentSchedule · partb.writein.e1 | 12 | `PlankFlooring` | _(absent)_ |
| analysisXlsx · unit.0.current | 12 | `1520` | _(absent)_ |
| rentSchedule · partb.utilities.2 | 12 | `1` | _(absent)_ |
| analysisXlsx · unit.2.proposed | 12 | `3825` | _(absent)_ |
| rentSchedule · property.fha | 11 | `N/A` | `04/01/2026` |
| rentSchedule · principals.1.title | 11 | `VPOFGENERALPARTNER` | _(absent)_ |
| analysisXlsx · unit.1.current | 11 | `1770` | _(absent)_ |
| rentSchedule · unit.3.type | 11 | `3BR/1.5BAFlat` | _(absent)_ |
| analysisXlsx · unit.3.safmr | 11 | `3390` | _(absent)_ |
| rentSchedule · partb.utilities.0 | 10 | `1` | _(absent)_ |
| rentSchedule · partb.fuel.1 | 10 | `E` | _(absent)_ |
| rentSchedule · unit.3.units | 10 | `2` | _(absent)_ |
| rentSchedule · unit.3.ua | 10 | `185` | _(absent)_ |
| rentSchedule · unit.3.row | 10 | `3` | _(absent)_ |
| analysisXlsx · unit.2.current | 10 | _(absent)_ | `1185` |
| analysisXlsx · unit.3.ua | 10 | `107` | `124.47` |
| rentSchedule · partb.writein.s1.on | 9 | `1` | _(absent)_ |
| rentSchedule · partb.utilities.3 | 9 | `1` | _(absent)_ |
| rentSchedule · partb.writein.s1 | 8 | `FitnessCenter` | _(absent)_ |
| rentSchedule · partb.equipment.4 | 8 | _(absent)_ | `1` |
| rentSchedule · partb.utilities.1 | 8 | _(absent)_ | `1` |
| rentSchedule · unit.3.rent | 8 | `4550` | _(absent)_ |
| rentSchedule · unit.3.extension | 8 | `9100` | _(absent)_ |
| rentSchedule · unit.3.gross | 8 | `4735` | _(absent)_ |
| rentSchedule · unit.4.type | 8 | `3BR/1.5BATH` | _(absent)_ |
| analysisXlsx · unit.4.type | 8 | `3BR/1.5BATH` | `3BR-TH` |
| analysisXlsx · unit.3.current | 8 | _(absent)_ | `1337` |
| analysisXlsx · unit.2.units | 8 | `9` | _(absent)_ |
| analysisXlsx · unit.3.proposed | 8 | `5450` | `6000` |
| rentSchedule · partb.writein.u1 | 7 | _(absent)_ | `NursingCare` |
| rentSchedule · unit.4.units | 7 | `58` | _(absent)_ |
| rentSchedule · unit.4.ua | 7 | `182` | _(absent)_ |
| rentSchedule · unit.4.row | 7 | `4` | _(absent)_ |
| rentSchedule · partb.utilities.4 | 6 | `1` | _(absent)_ |
| rentSchedule · partb.services.1 | 6 | `1` | _(absent)_ |
| checklist · heading | 6 | `Owner’s  Checklist for  RCS  Subm…` | _(absent)_ |
| rentSchedule · unit.4.rent | 6 | `4675` | _(absent)_ |
| rentSchedule · principals.2.name | 6 | `WellsFargoAffordableHousingCommun…` | _(absent)_ |
| analysisXlsx · unit.4.proposed | 6 | _(absent)_ | `0` |
| rentSchedule · partb.writein.s5.on | 5 | _(absent)_ | `1` |
| rentSchedule · unit.4.extension | 5 | `271150` | _(absent)_ |
| rentSchedule · unit.4.gross | 5 | `4857` | _(absent)_ |
| rentSchedule · partb.equipment.2 | 5 | `1` | _(absent)_ |
| analysisXlsx · unit.4.safmr | 5 | `3390` | _(absent)_ |
| analysisXlsx · unit.4.ua | 5 | _(absent)_ | `0` |
| rentSchedule · partb.equipment.3 | 5 | `1` | _(absent)_ |
| rentSchedule · partb.writein.u1.on | 5 | `1` | _(absent)_ |
| rentSchedule · partb.equipment.6 | 5 | _(absent)_ | `1` |
| analysisXlsx · unit.0.units | 5 | `90` | _(absent)_ |
| analysisXlsx · unit.1.units | 5 | `25` | _(absent)_ |
| rentSchedule · unit.5.type | 5 | _(absent)_ | `2BEDROOM` |
| rentSchedule · unit.5.units | 5 | _(absent)_ | `2` |
| rentSchedule · unit.5.row | 5 | _(absent)_ | `6` |
| analysisXlsx · unit.3.units | 5 | `8` | _(absent)_ |
| analysisXlsx · unit.4.units | 4 | _(absent)_ | `1` |
| analysisXlsx · unit.4.current | 4 | _(absent)_ | `0` |
| rentSchedule · partb.writein.s6 | 3 | _(absent)_ | `0.00` |
| rentSchedule · principals.2.title | 3 | `0.005%` | _(absent)_ |
| rentSchedule · partb.writein.e2.on | 3 | `1` | _(absent)_ |
| rentSchedule · partb.writein.e3.on | 3 | `1` | _(absent)_ |
| rentSchedule · partb.writein.e4.on | 3 | `1` | _(absent)_ |
| rentSchedule · partb.writein.s2.on | 3 | `1` | _(absent)_ |
| rentSchedule · partb.writein.s2 | 3 | `landscaping` | _(absent)_ |
| rentSchedule · partb.writein.s3.on | 3 | `1` | _(absent)_ |
| rentSchedule · partb.services.5 | 3 | _(absent)_ | `1` |
| checklist · checklist.sign_date | 3 | _(absent)_ | `3/27/2025` |
| rentSchedule · principals.3.name | 3 | `PNCBank,NationalAssociation` | _(absent)_ |
| rentSchedule · unit.5.extension | 3 | _(absent)_ | `0` |
| rentSchedule · unit.5.gross | 3 | _(absent)_ | `0` |
| rentSchedule · unit.5.ua | 3 | `0` | _(absent)_ |
| analysisXlsx · unit.5.safmr | 3 | `3724` | `2010` |
| analysisXlsx · unit.5.proposed | 3 | _(absent)_ | `2950` |
| rentSchedule · partb.writein.e2 | 2 | `smokedetector` | _(absent)_ |
| rentSchedule · partb.writein.s3 | 2 | `exterminator` | _(absent)_ |
| rentSchedule · partb.services.4 | 2 | _(absent)_ | `1` |
| rentSchedule · nonrev.1.rent | 2 | `2600` | `0` |
| rentSchedule · unit.5.rent | 2 | `0` | _(absent)_ |
| rentSchedule · unit.6.type | 2 | `3BR` | _(absent)_ |
| rentSchedule · unit.6.units | 2 | `1` | _(absent)_ |
| rentSchedule · unit.6.rent | 2 | `0` | _(absent)_ |
| rentSchedule · unit.6.extension | 2 | `0` | _(absent)_ |
| rentSchedule · unit.6.ua | 2 | `0` | _(absent)_ |
| rentSchedule · unit.6.gross | 2 | `0` | _(absent)_ |
| rentSchedule · unit.6.row | 2 | `7` | _(absent)_ |
| analysisXlsx · unit.5.type | 2 | `3BR` | `1BR` |
| analysisXlsx · unit.5.units | 2 | `1` | `33` |
| analysisXlsx · unit.5.current | 2 | `1728` | `2717` |
| analysisXlsx · unit.5.ua | 2 | _(absent)_ | `44` |
| rentSchedule · partb.writein.e3 | 1 | `vinylflooring` | _(absent)_ |
| rentSchedule · partb.writein.e4 | 1 | `tile` | _(absent)_ |
| rentSchedule · partb.writein.e5.on | 1 | _(absent)_ | `1` |
| rentSchedule · owner.entity_type_other | 1 | `LiabilityCompany` | _(absent)_ |
| rentSchedule · principals.3.title | 1 | `LimitedPartner` | _(absent)_ |
| rentSchedule · nonrev.1.use | 1 | `SupersUnit` | `TotalRentLossDuetoNon-Revenue` |
| rentSchedule · nonrev.1.type | 1 | `2BR` | `Units$` |
| rentSchedule · partb.services.2 | 1 | _(absent)_ | `1` |
| rentSchedule · partb.services.3 | 1 | _(absent)_ | `1` |
| rentSchedule · principals.4.name | 1 | _(absent)_ | `NameandTitle` |
| rentSchedule · principals.5.name | 1 | _(absent)_ | `NameandTitle` |
| rentSchedule · principals.6.name | 1 | _(absent)_ | `PartHOwnerCertification` |
| rentSchedule · nonrev.2.use | 1 | `Manager'sUnit` | `SupersUnit` |
| rentSchedule · nonrev.2.rent | 1 | `5150` | `0` |
| analysisXlsx · unit.6.type | 1 | _(absent)_ | `2BR` |
| analysisXlsx · unit.6.units | 1 | _(absent)_ | `20` |
| analysisXlsx · unit.6.current | 1 | _(absent)_ | `3404` |
| analysisXlsx · unit.6.proposed | 1 | _(absent)_ | `3650` |
| analysisXlsx · unit.6.ua | 1 | _(absent)_ | `49` |
| analysisXlsx · unit.6.safmr | 1 | _(absent)_ | `2450` |
| analysisXlsx · unit.7.type | 1 | _(absent)_ | `3BR` |
| analysisXlsx · unit.7.units | 1 | _(absent)_ | `7` |
| analysisXlsx · unit.7.current | 1 | _(absent)_ | `3911` |
| analysisXlsx · unit.7.proposed | 1 | _(absent)_ | `4300` |
| analysisXlsx · unit.7.ua | 1 | _(absent)_ | `62` |
| analysisXlsx · unit.7.safmr | 1 | _(absent)_ | `3130` |
| analysisXlsx · unit.8.type | 1 | _(absent)_ | `3BRTH` |
| analysisXlsx · unit.8.units | 1 | _(absent)_ | `5` |
| analysisXlsx · unit.8.current | 1 | _(absent)_ | `3971` |
| analysisXlsx · unit.8.proposed | 1 | _(absent)_ | `4550` |
| analysisXlsx · unit.8.ua | 1 | _(absent)_ | `67` |
| analysisXlsx · unit.8.safmr | 1 | _(absent)_ | `3130` |
| analysisXlsx · unit.9.type | 1 | _(absent)_ | `4BR` |
| analysisXlsx · unit.9.units | 1 | _(absent)_ | `12` |
| analysisXlsx · unit.9.current | 1 | _(absent)_ | `4657` |
| analysisXlsx · unit.9.proposed | 1 | _(absent)_ | `4900` |
| analysisXlsx · unit.9.ua | 1 | _(absent)_ | `54` |
| analysisXlsx · unit.9.safmr | 1 | _(absent)_ | `3710` |

