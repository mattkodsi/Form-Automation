# Property name vs "also known to tenants as" — the provenance problem

Written 2026-07-30 on `worktree-rcs-corpus` at `5b9a4f1`. **Observation only — nothing under
`app/full-mp/` was modified to produce this document.** Every count below comes from a
measurement that was run; where a thing could not be measured it is named in the last
section rather than estimated.

Matt's report: the parser cannot tell the property name from the also-known-as name, because
the executed rent schedule does not write them as `{name}/{aka}`. His example, Cherry Garden,
prints **`Oak Park Apartments (t/b/k/a Cherry Garden Apartments)`**. He asks for the count of
every other property with the same problem, for a rule that can tell the two names apart, and
for the decision about which source owns the property name to be laid out rather than taken.

---

## What was measured

Three name sources were read for all 34 corpus properties and joined on the tracker's
`Property Code`.

| Source | How it was read | Coverage |
|---|---|---|
| Executed rent schedule, HUD-92458 **Part A field `1`** (the project name) | AcroForm widget `/V`, raw, whitespace preserved — the same field id `gen.js` writes and `extract.js` reads (`RS_SCALARS['1']`, `app/full-mp/corpus/extract.js:314`) | **16 of 34** |
| The same field on a **flattened** schedule | the app's own rect reader — `rsFieldRects` + `rsTextPageAt` + `rsMapRects`, driven the way `flattenedFields` drives it (`extract.js:288`) | **+8 of 34** (7 real, 1 misread) |
| HAP tracker `Property Name` | `_archive/hap-fixtures/hap-tracker-2026-07-28.csv`, 2853 rows | **33 of 34** |
| The RCS study's own project name | already in `app/full-mp/corpus/corpus.json` (`studies[].name`), produced by `readSubject` in `rcs.js:218` | 33 of 34 |
| What our record actually held at generation time | the 34 cached sweeps in `_archive/corpus-cache/_sweep/*.json`, rows with `key: "property.name"` | 34 of 34 (whitespace stripped by `canon`) |

Scratch scripts live outside the repo, under
`…/scratchpad/name-agent/` (`names.js`, `raw3.js`, `rule2.py`). Nothing was written to the
Drive mount, no Azure OCR call was made, and no Supabase session was used.

**Two facts about the tracker that bound everything else.**

- **249 properties, 249 distinct names, 249 distinct codes.** Not one code carries two names;
  not one name is carried by two codes. The tracker is already a clean one-name registry.
- **The corpus is 33 of those 249 — 13%.** Every count in the census below is a count over
  13% of the portfolio. `75453 Sycamore Green` has no tracker row at all (the tracker's
  nearest is `Sycamore Ridge`, code `75912`), so it is a 34th case the tracker cannot anchor.

**Only 3 of the 249 tracker names carry an alias marker at all**, and one of them is not an
alias:

```
75541  'Chestnut Park (Skyview)'      — an alias
75834  'Southern Hills/Orlando'       — an alias, or a city qualifier
79181  'Loring Towers (MA)'           — a state disambiguator, NOT an alias
```

So the fog is almost entirely on the **document** side, not the tracker side. That is the
single most useful thing measured here: the tracker is the clean input.

---

## The shape census

Every distinct Part A project-name string read off an executed schedule, classified. A
property appears in more than one row where two cycles print it differently.

### Shapes that carry a second name (7 readings, 6 properties)

| Shape | n | Properties, and what the schedule prints |
|---|--:|---|
| `A/B` — two names, slash | **2** | `75567` `MAPLEVIEW TOWER/STAMFORD ELDERLY` · `75708` `Colonial Village/White Oak Townhomes` |
| `A fka B` | **3** | `75704` `333 Holly fka Holly Creek II` · `75705` `The Pines fka Wood Glen Apartments` · `75544` `Oaks on North Plaza fka North Plaza Apartments` (read from the RCS Analysis workbook — 75544's schedule is unreadable) |
| `A (t/b/k/a B)` | **1** | `75576` Cherry Garden — `Oak Park Apartments (t/b/k/a Cherry Garden Apartments)`. **Matt's report; not in the corpus.** Recorded on his statement, not on a file this session read. |
| `A (B)` — parenthesised second name in the **tracker**, not the schedule | **1** | `75541` `Chestnut Park (Skyview)` |

`A/B` and `A fka B` are the same count — three each if Cherry Garden's marker family is
counted with the parenthesised one. **The slash shape the app understands is the minority
shape.**

### Shapes that carry a contract number, not a name (7 readings, 6 properties)

This is the census's real finding, and it is larger than the alias census.

| Shape | n | Properties |
|---|--:|---|
| `A / <contract#>` | **2** | `75478` `North Park Apartments / NY36A005001` · `75832` (2020) `Newberry Arms / SC160061002` |
| `A - <contract#>` | **2** | `4640013` (2020) `Riverwood Apartments - VA36R000009` · `75563` `Oceanport Senior Citizens - NJ390014058` |
| `A (<contract#>)` | **3** | `75833` `Circle Park Apartments (IL06-0054-027)` · `75917` `Peterson Plaza Apartments (IL060052016)` · `75920` `Fairview Homes (NJ390013022)` |

**The two `A / <contract#>` cases are actively corrupted by the shipped splitter today.**
`app.js:2397` splits on `/`, sees two parts, and writes `NY36A005001` into
`tenant.property_alias`. On the branch, `gen.js:276` then prints that back into Part A field 1
as `North Park Apartments/NY36A005001`, and `app.js:4838` offers it as the name residents know
the building by on the tenant notice's generated letterhead. That is a contract number on a
letter to tenants.

`rcs.js:230` **already** strips a trailing parenthesised Section 8 number from the *study's*
project name — "Fairview writes the number inside the name" is a comment in that file. The
rent-schedule reader never got the same treatment.

### Shapes with one name that is not the tracker's name (4 properties)

| Property | tracker | executed RS |
|---|---|---|
| `75500` | `Senior World` | `Lansing Manor` |
| `75921` | `Walden` | `The Cedars` |
| `75488` | `Woodbury Oakwood` | `Lakeside Apartments` |
| `75569` | `Barnum House` | `BARNUM HOTEL` |

Two of these are a *pair of names for one building* that nobody has written down as a pair —
75500's study is titled `Lansing Manor / Senior World`, so the alias exists in the study and
the tracker holds one half while the schedule holds the other. Under today's code the parse
silently renames the property in the menu from `Walden` to `The Cedars` and from
`Senior World` to `Lansing Manor`, and nothing tells the user it happened.

### Shapes with a phase marker (2 properties)

| Property | tracker | executed RS |
|---|---|---|
| `75926` | `Oak Center` | `Oak Center I` |
| `75927` | `MORH Housing` | `MORH I Housing` |

**These must never be normalised away, and there is a measurement that proves it:** the
tracker holds `Burt Farms I` (75109) and `Burt Farms II` (75480) as two separate properties.
Strip the phase marker and they collide into one. Any rule that treats `Oak Center` and
`Oak Center I` as the same name is a rule that merges Burt Farms I into Burt Farms II.

### Shapes where the schedule adds a generic suffix the tracker omits (5 properties)

| Property | tracker | executed RS |
|---|---|---|
| `2640001` | `Northcross` | `Northcross Townhomes` |
| `4640013` | `Riverwood` | `RIVERWOOD APTS` |
| `75478` | `North Park` | `North Park Apartments` |
| `75917` | `Peterson Plaza` | `Peterson Plaza Apartments` |
| `75576` | `Cherry Garden` | `Cherry Garden Apartments` |

This is exactly Matt's question (1) — tracker `Cherry Garden` vs schedule
`Cherry Garden Apartments`. **34 of the 249 tracker names carry a trailing generic word**
(`Apartments`, `Homes`, `Housing`, `Townhomes`, `Townhouses`, `Residences`), so the suffix is
sometimes in the tracker and sometimes not; it is not a convention either way.

Suffix-insensitive comparison collides exactly **one** pair across all 249 tracker names —
`Fairview Homes` (75920) and `Fairview Housing` (90060). Adding singular/plural insensitivity
(needed for `MAPLEVIEW TOWER` ≈ `Mapleview Towers`) adds two more: `Riverwood`/`Riverwoods
Apartments` and `Walnut Hill`/`Walnut Hills`. **All three collisions are irrelevant to the
split rule and fatal to a name lookup** — which is why the rule below compares against *this
property's own* tracker row, keyed by `Property Code`, and never searches the registry by
name.

### Exact match, modulo case (8 properties)

`75568` `MARKET SQUARE` · `75830` `Clinton Manor` · `75831` `Friendship Court` ·
`75832` (2026) `Newberry Arms` · `75922` `Marine Terrace` · `75453` `Sycamore Green`
(no tracker row) · `75543` `Noble Tower` · `75566` `Ebony Gardens`.

Five of the 24 readable schedules are printed **ALL CAPS** (`4640013`, `75567`, `75568`,
`75569`, `75927`). Case is never a difference; the one-name rule at `db.js:294` already knows
that (`nameKey` lowercases and trims).

### Census totals

| | count |
|---|--:|
| Corpus properties | 34 |
| …with a tracker row | 33 |
| …whose executed schedule's Part A name could be read at all | **24** |
| Readings carrying a **second name** | **7** (6 properties) |
| Readings carrying a **contract number** mistaken for a name | **7** (6 properties) |
| Properties whose single RS name is **not** the tracker's name | **4** |
| Properties differing only by a **generic suffix** | **5** |
| Properties differing only by a **phase marker** | **2** |
| Properties matching exactly, modulo case | **8** |
| Properties where the name could not be read from any document | **10** |

**Cherry Garden is not one case in 34. Twelve of the 24 readable schedules print something
other than a bare property name** — half.

### One read defect found along the way

`75544 Oaks on North Plaza` — the rect reader returns **`"ProjectName"`** for field `1`: the
blank HUD-92458's own caption, taken as the value. `flattenedFields`
(`extract.js:296`) discards a mapped value with no alphanumerics, which stops rows of
underscores but not a printed caption. Any rule fed this would write the caption into the
property name. Not fixed here (no source file was touched).

---

## The matching rule, and how it scored

### The rule

Given the property's tracker row (which the app already has — `hapForPid(pid).name`, reached
through `hapProperties()` → `mpdb.hapRows()`, `app.js:3690` and `app.js:5113`) and the raw
Part A string:

1. **Delete contract identifiers.** A token is an identifier, never a name, when it is
   ≥8 characters, has no lowercase letter, contains ≥5 digits, and matches
   `^[A-Z]{2}[0-9][0-9A-Z]*(-?[0-9A-Z]{3,})*$`. Delete it whether it sits after `/`, after
   ` - `, or inside `( )`. Same job `rcs.js:230` already does for the study.
2. **Split on an explicit alias marker** — `t/b/k/a`, `f/k/a`, `a/k/a`, `n/k/a`, `d/b/a`,
   `fka`, `aka`, `dba`, `formerly`, `formerly known as`, `also known as`, `now known as`,
   `to be known as` — with or without slashes, dots, or surrounding parentheses. Failing a
   marker, split on a remaining `/`.
3. **Anchor on the tracker.** Compare each candidate to the tracker name under a normalisation
   that lowercases, drops punctuation, drops a **trailing** generic word
   (`apartments`/`apts`/`homes`/`housing`/`townhomes`/`townhouses`/`residences`/
   `senior citizens`), drops a leading `the`, and de-pluralises words of 4+ letters. It does
   **not** touch a phase marker, ever (see Burt Farms above).
4. **Exactly one candidate matching the tracker is the property name; the other is the
   alias.** Zero matches, two matches, or no tracker row → **refuse**: write nothing, and put
   the reading in front of the user as a choice.

### The score

29 measured cases (every distinct reading in the census, plus Cherry Garden on Matt's
statement), run through the rule in `…/scratchpad/name-agent/rule2.py`:

```
cases: 29   split correctly: 21   refused correctly: 8   wrong: 0
```

The eight refusals are the eight cases where refusing is the only correct answer: `75500`,
`75563`, `75569`, `75921`, `75488` (the RS names a different building than the tracker),
`75926`, `75927` (phase markers), `75453` (no tracker row).

**Cherry Garden scores correct.** `Oak Park Apartments (t/b/k/a Cherry Garden Apartments)`
with tracker `Cherry Garden` → property name `Cherry Garden Apartments`, alias
`Oak Park Apartments`. Which answers Matt's question (1): the parser knows which to grab
because the tracker's `Cherry Garden` matches `Cherry Garden Apartments` once the trailing
generic word is set aside, and does not match `Oak Park Apartments` under any normalisation.

### The same 29 cases through the shipped rule

The rule in `app.js:2397` today — split on `/`, and only when there are exactly two parts:

```
SHIPPED slash-only rule: 11 of 29 correct, 18 wrong
```

Broken down, the 18:

- **2 actively corrupt the record** — a contract number written into
  `tenant.property_alias` (`75478`, `75832`).
- **6 leave a composite string sitting in `property.name`** — `A fka B` and
  `A (contract#)` unparsed (`75704`, `75705`, `75544`, `75833`, `75917`, `75920`, `4640013`,
  `75576`).
- **8 silently rename the property** to a name the tracker does not hold, with no refusal and
  no notice (`75500`, `75563`, `75569`, `75921`, `75488`, `75926`, `75927`, `75453`).

The rule was run. The score is a measurement, not a projection. Its one soft input is Cherry
Garden's string, which came from Matt's message and not from a file — no `75576` folder exists
under the corpus root and no `t/b/k/a` appears anywhere in the repo.

---

## What is already fixed on the branch

Checked with `git show main:…` against each file. **Almost nothing here is branch-only, so
almost none of it is hidden from what Matt runs.**

| Thing | `main` | branch |
|---|---|---|
| The slash-only splitter, `app.js` | present (`main` line 1781) | present (line 2397) — **unchanged** |
| `hap.js`, the tracker seam | present | present, extended (+143 lines: `typeKind`, the primary action) |
| `HAPSource` / `mpdb.hapRows()` | present | present |
| `ra_property_code` + `propByRaCode` | present | present |
| `openHapProperty` → `createProperty(p.name, code)` | present (`main` line 3042) | present (line 3958) |
| The one-name rule in the data layer (`assertNameFree`) | present, 5 call sites | present, 5 call sites |
| Part A field 1 writes **both** names on the way out | **absent** — `main:gen.js:245` writes `T(1, g('property.name'))` only | **fixed** — `gen.js:276` writes `_pn+'/'+_pa` |

So: **one** piece of this is branch-only, and it is the round-trip. On `main`, the app splits
`Colonial Village/White Oak Townhomes` on the way in and prints back only `Colonial Village`
— the form HUD identifies the project by loses half its identity. On the branch it round-trips.
Everything else — the splitter that only understands `/`, the tracker seeding the record, the
one-name rule, the silent rename — is live in what Matt runs today.

**A second thing is fixed nowhere.** `app.js:5172`, in the `?selftest=1` fixture, writes
`'property.alias':'Beacon Hill'`. There is no such key: the real key is
`tenant.property_alias`, and `property.alias` appears exactly once in the whole source tree.
The self-test property therefore has no alias, and every browser check that would have
exercised the alias on a real cell has been running against an empty field. Present on both
branches.

**A third: the tracker name is never offered as a source.** `SRCPICK_ROWS['property.name']`
(`app.js:453`) already declares three sources — *Executed RS*, *Related Affordable*, *RCS
report*. The middle one reads `raVal()` → `window.RASource`, which is set **only by Kinley's
Azure port** (`build-ra.py:170`). In Matt's build that row is permanently dim: per FORM-RULES
rule 1 the row must render, and it does, saying `— Related Affordable · not available`. The
value it wants is one call away — `hapForPid(activePid).name` — and it is the one name the
whole design treats as definitive.

---

## The decisions for Matt

Each has the measurement that would settle it. None is taken here.

### Decision 1 — which source owns `property.name`

| Option | What it costs | What breaks |
|---|---|---|
| **A. The HAP tracker is definitive.** The record's name is the tracker's name, always. The schedule can only ever supply the *alias*. | The menu never churns. The one-name rule is free — the tracker is already 249 names, 249 codes, zero duplicates. Nothing has to reign back to Kinley's database, because nothing downstream of the tracker ever changes a name. | The generated Part A prints `Cherry Garden`, when the filed schedules for that building have printed `Cherry Garden Apartments` for years. **6 of 19 non-refused corpus cases** would print a name the CA has not seen. |
| **B. The executed schedule is definitive.** The most recent filed schedule's Part A name wins; the tracker is the anchor for *matching* only. | Every generated document matches the filed history. | The menu renames itself out from under the PM: **6 of 19** cases change the row's label (`Northcross`→`Northcross Townhomes`, `Riverwood`→`RIVERWOOD APTS`, `North Park`→`North Park Apartments`, `Mapleview Towers`→`MAPLEVIEW TOWER`, `Peterson Plaza`→`Peterson Plaza Apartments`, `Cherry Garden`→`Cherry Garden Apartments`). Two of those six are ALL CAPS and one is an abbreviation — the schedule's spelling is not always the better spelling. And the new name has to reign back to Kinley's database or the two registries diverge on the next import. |
| **C. The tracker names the property; the schedule's spelling is a per-package fact.** `property.name` stays the tracker's; a new per-cycle key holds what the schedule printed, and *that* is what Part A field 1 prints. | One new key. The menu never churns, the documents match history, nothing reigns back. | Two "names" on the form where there is now one, and a rule for which one every other document uses. The cover letter, the owner letter, the checklist and the notice would each need assigning. |
| **D. The PM chooses**, through the source dropdown that already exists at `app.js:453`. | Almost no new machinery — the row is built and rendering dim today. | A choice made per property, per session, by whoever is looking. The one thing a registry cannot survive is the same building named differently by two people, and 249 clean tracker names are evidence somebody has been disciplined about this. |

**The measurement that would settle it:** take the 33 corpus properties and ask the CA-facing
question — *has a CA ever rejected or queried a schedule over the project name?* The corpus
holds 33 filed packages and, for several, the CA's returned copy. If the CA does not care, A
is free and every other option is paying for nothing. If the CA matches Part A against the HAP
contract, B or C is forced and A is unshippable. **This is one question to Elliot Kohanbash or
whoever fields CA correspondence, and it decides the whole shape.** It cannot be measured from
the files: the corpus contains no CA rejection.

**The second measurement, if B or C is chosen:** does Kinley's container accept a name write
at all? `RA-PORT.md` and `build-ra.py` describe a *read* seam (`window.RASource.value(k)`).
There is no write. If the mother database is read-only to us, B is not "make the RS
definitive" — it is "let the two registries diverge", and that is a different decision.

### Decision 2 — may a PM rename a property?

**What the existing rule already forces**, whatever Matt decides:

- A rename cannot produce a duplicate. `assertNameFree` (`db.js:300`, `db.supabase.js:231`)
  guards `createProperty`, `renameProperty`, `saveForm` and `saveFlat` — case-insensitive,
  space-insensitive. It is in the data layer precisely because a dialog-only check let three
  `Beacon Hill`s and three `Colonial Village`s into the live record
  (`test_db.js:415–470`, section 10 — *"A check that lives in a dialog only covers the callers
  who came through that dialog"*).
- **Applying a parse is a rename.** `test_db.js` says so in as many words: *"A property's name
  need not be the name it was created with: a rename changes it, and so does any save carrying
  `property.name` — which is exactly what applying an executed rent schedule's parse does."*
  So the question "may a PM rename" and the question "may a parse overwrite the name" are one
  question with one answer.
- The menu row **does** follow the record. `app.js:3718` — `name:(rec&&rec.name)||any.name` —
  the tracker's name shows only until a record exists; after that the record's name wins every
  card. So a parse-driven rename is visible portfolio-wide, immediately, which is what Matt
  suspected.
- The record already carries the tracker's code (`ra_property_code`, set by
  `createProperty(name, raMasterId)` at `db.js:232`, looked up by `propByRaCode`). **Identity
  is already the code, not the name.** A rename cannot lose a property; it can only confuse a
  human reading the list.

**The measurement that would settle it:** writing the RS spelling back for all 24 readable
corpus properties produces **zero** `DUP_PROPERTY_NAME` collisions against the 249 tracker
names. Renaming is therefore *safe* today. Whether it is *wanted* is the judgement, and the
one number that bears on it is the churn: **6 of 19**, about a third of the properties where
we can read a name at all, would get a different label in the menu.

### Decision 3 — what a refusal looks like

The rule refuses on **8 of 29** cases — 28%. Refusing is only correct if there is somewhere
for the refusal to go. Today there is not: `rsFillFromParsed` has no path that declines to
write and reports why.

The pieces exist. `SRCPICK_ROWS['property.name']` already offers three tagged rows;
`app.js:2841` already builds a checklist chip for the property name. The smallest honest
version is: on refusal, write nothing, leave the cell as it was, and make the source dropdown
show the schedule's reading as one option beside the tracker's — one measurement short of a
design, and it is Matt's, not this document's.

**The measurement that would settle the shape:** how often does a PM actually open a property
whose schedule disagrees with the tracker? 12 of 24 readable corpus schedules print something
other than a bare name, but the corpus is a 13% sample chosen for having filed packages.
Running the census over the other 216 tracker properties needs their schedules, which are not
on the mount.

---

## What could not be measured, and why

- **Cherry Garden itself.** Code `75576` is in the tracker (254 units, 252 assisted, Elliot
  Kohanbash, NJHMFA, RCS due 2026-08-16). There is **no `75576` folder under the corpus root**
  and no occurrence of `t/b/k/a` or `Oak Park` anywhere in the repository. The string
  `Oak Park Apartments (t/b/k/a Cherry Garden Apartments)` is recorded on Matt's statement
  alone. It scores correct under the rule, but that is a scored *claim*, not a scored *file*.
- **10 of 34 schedules have no readable Part A name.** `4640009`, `75109`, `75474`, `75495`,
  `75564`, `75572`, `75573`, `75919`, and `75544`/`75488` partially. No AcroForm value, and
  the text layer holds nothing at the field's rectangle — the executed copies are vector
  outlines, as recorded in memory: only a minority of the 34 are text-readable. Reading them
  needs tier-3 OCR, which bills per page against Azure, and this session made no OCR call.
  So the census covers 24 of 34, and the true shape distribution over the corpus is unknown
  for the remaining 10.
- **The other 216 tracker properties.** Their schedules are not on the mount. Every "n of 34"
  is a 13% sample; every "n of 249" (the marker census, the collision counts, the
  suffix/phase counts) is the whole portfolio and can be trusted as such.
- **`333 Holly` and `The Pines` word boundaries.** Both read back with no word spacing —
  `333HollyfkaHollyCreekII`, `ThePinesfkaWoodGlenApartments` — because the filed page draws
  each word as its own text run and `rsMapRects` joins runs with nothing, the same condition
  `extract.js` trap 4 documents. The `fka` shape is unambiguous and the study names confirm
  both halves, but the exact printed spacing was not recovered.
- **Whether the CA cares.** No CA rejection exists in the corpus. Decision 1 turns on a fact
  no file here holds.
