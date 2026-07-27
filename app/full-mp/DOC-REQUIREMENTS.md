# What each of the six documents needs

Audited 2026-07-27, document by document, against **what `gen.js` actually prints** —
not against what seemed obvious. The gate lives in `DOC_REQS` / `docWarns` / `docMissing`
in `app.js`; the checks that hold it there are in `smoke_combined.js`.

Two categories, and the line between them is the whole point:

- **REQUIRED** — the document is *wrong or unfileable* without it. Generation is blocked
  and the modal says so.
- **SUGGESTED** — the document still files, but says less. It generates, with a caveat on
  its own row.

A field is required only where a specific sentence, form field or signature line breaks
without it. Below, each entry names the hole.

---

## The gap this audit closed

The previous table asked for 16 field-checks across five documents. **Only the checklist
asked for a signatory** — so the cover letter, the owner letter and the HUD-92458 could
all generate, download and be filed with an empty signature block. Two sentences did not
merely degrade but broke outright:

- Cover letter: `contact ' + pm_name + ' at ' + pm_phone + ' or ' + pm_email` printed
  **"contact Jane Doe at  or ."** whenever either was blank.
- Owner letter, certification 2: `'(' + appr_name + ', ' + appr_firm + ')'` printed
  **"The RCS appraiser's (, Smith & Co) narratives"** with no appraiser name.

Both now join only what is held, so they stay whole even if the gate is talked past with
an "N/A".

---

## 01 · Cover letter (CA)

| | Field | Why |
|---|---|---|
| **Req** | `property.name`, `property.s8` | the Re: block |
| **Req** | `ca.name`, `ca.org` | addressee, and the salutation is built from the name |
| **Req** | `poc.name` | the closing sentence tells the CA who to call |
| **Req** | `sig.name`, `sig.title` | **was missing** — the letter ended "Best Regards," and nothing |
| Sug | `poc.phone` **or** `poc.email` | at least one, or the closing names a person with no way to reach them |
| Sug | `ca.position`, `ca.addr_street` | addressee block is filtered before printing, so these vanish cleanly |

## 02 · Owner cover letter

| | Field | Why |
|---|---|---|
| **Req** | `property.name`, `property.s8` | the Re: block |
| **Req** | `ca.name`, `ca.org` | addressee + salutation |
| **Req** | `owner.entity_name` | the letterhead line — otherwise prints the literal `[Ownership Entity Name]` |
| **Req** | `appr.name` | **was missing** — certification 2 names the appraiser |
| **Req** | `appr.firm` | same sentence |
| **Req** | `poc.name` | **was missing** — certification 7 *is* the point-of-contact block |
| **Req** | `sig.name`, `sig.title` | **was missing** — signed under penalty of perjury |
| Sug | `poc.email`, `poc.phone` | certification 7's sub-lines |
| Sug | `appr.addr_street`, `appr.email`, `appr.phone` | certification 8 promises the appraiser's details "below", then prints nothing |
| Sug | `ca.position`, `ca.addr_street` | as above |

## 03 · Owner's checklist

| | Field | Why |
|---|---|---|
| **Req** | `property.name` | **was missing** — prints 18pt centred across the head of the form |
| **Req** | `sig.name`, `sig.title` | the signature line drawn over the template |
| Sug | at least one of `check.0`–`check.16` | a checklist certifying nothing is a real state, but worth saying out loud |

`checklist.sign_date` defaults to today, so it is never a gap.

## 04 · RCS report

Not generated — it is the appraiser's PDF, uploaded in Section 1. Required in the sense
that the package is short a document without it; nothing else to check.

## 05 · Draft rent schedule (HUD-92458)

| | Field | Why |
|---|---|---|
| **Req** | `property.name` | field 1 |
| **Req** | `property.fha` | **was missing** — field 2. This is the FHA project number and is **not** the Section 8 number; they are separate fields on this form |
| **Req** | the resolved rents-effective date | **was missing** — fields 3–6. Resolved across `date_eff_rs` / `date_eff_custom` / `date_rents_effective`, so it is checked through `dateEffResolved()`, not as a plain key |
| **Req** | `owner.entity_name` | field 197, Part F mortgagor entity |
| **Req** | `sig.name`, `sig.title` | field 228, Part G |
| **Req** | ≥1 unit type with a count | Part A would otherwise be blank |
| Sug | **proposed rents** | see below |
| Sug | `owner.entity_type` | the Part F tick boxes |

## 06 · Tenant notice

| | Field | Why |
|---|---|---|
| **Req** | `property.name` | **was missing** — the notice names the property in six separate sentences |
| **Req** | `ca.org` | named five times; it is who the request goes to |
| **Req** | `tenant.sender_name` | the signature |
| **Req** | ≥1 unit type with a count | the rent table |
| **Req** | **proposed rents** | see below |
| Sug | management street address | the line telling a tenant where to inspect the materials |

`tenant.sender_title` falls back to "Community Manager"; `tenant.date_of_notice` defaults
to today. Neither is a gap.

---

## Proposed rents: required on the notice, suggested on the schedule

The same figure, gated differently, on purpose.

**The tenant notice requires them.** Its entire legal function under 24 CFR 245 is to
state the proposed increase. Without them the "Requested Rent" column prints empty down
the page, and what is served on residents announces nothing. That is not a document worth
generating.

**The rent schedule only suggests them.** A blank HUD-92458 is something an owner may want
on purpose: generate the form, then type the rents in by hand. That workflow is only real
because the template keeps its own calculation actions — enter a rent in column 3 and HUD's
form still extends it into column 4 and grosses it up in column 6. Those actions used to be
stripped at generation, which is what made a blank schedule a dead form rather than a
convenient one; `test_gen.js` now holds them in place.

So the schedule generates and says "suggested · proposed rents" on its own row.
