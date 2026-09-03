# Source Forms

Authoritative source documents for the Field Office PWA. Obtained from `dmv.ca.gov`, August 2026.

---

## REG 343 — Application for Title or Registration

| | |
|---|---|
| **File** | `REG-343_Application_for_Title_or_Registration_Rev-4-2021.pdf` |
| **Text extract** | `REG-343_extracted_text.txt` |
| **Revision** | REV. 4/2021 CORRECTED |
| **Source** | https://www.dmv.ca.gov/portal/uploads/2022/01/REG-343-R4-2021.pdf |
| **Status** | Publicly downloadable — **this is the form the PWA implements** |

Two pages, nine sections. Full field inventory in `../docs/02_Functional_and_Form_Specification.md` §3.

Section 9 requires signature under penalty of perjury (CVC §1808.21). The PWA collects data only; the signature is captured on paper at the counter.

---

## DL 44 — Driver License / ID Card Application

**Not present in this folder, and cannot be.**

DMV does not publish DL 44 as a downloadable PDF. In DMV's own words:

> "A new paper version of the driver's license application is available in field offices for customers who choose not to complete the electronic version" — because "each form has a unique barcode on it."

The barcode is per-copy and issued in office. A downloaded or reproduced DL 44 is not a valid form.

### What replaces it

DMV already operates the electronic equivalent, **eDL 44**:

| | |
|---|---|
| **Portal** | https://www.edl.dmv.ca.gov/ |
| **Information page** | https://www.dmv.ca.gov/portal/driver-licenses-identification-cards/dl-id-online-app-edl-44/ |
| **Requires** | DMV online account with two-factor authentication (email + phone) |
| **Collects** | SSN, name, address, date of birth; REAL ID requires document uploads |
| **Average completion** | 9 minutes (session times out after 15) |
| **Output** | Confirmation number emailed to the applicant |
| **Staff lookup** | "A DMV field office employee can use your confirmation number to look up your application." |

### Consequence for this product

The DL application must **not** be rebuilt. The PWA links out to eDL 44 and stores only the returned confirmation number against the queue token. This product therefore holds no SSN and no DL identity data at any point.

Rationale and flow: `../docs/01_Product_Requirements_Document.md` §6.2.

---

## REG-343_fill-template.pdf

A working copy of the same form, used by the application to produce filled PDFs.

**Why it exists.** The file DMV publishes carries an owner (permissions) password with an empty user password — a "restrict editing" flag on a publicly distributed fillable form, not access protection. Browser PDF libraries cannot read its encrypted object streams, so they cannot fill it.

The template is generated once, offline, from the official file:

```bash
python3 -c "
from pypdf import PdfReader, PdfWriter
r = PdfReader('REG-343_Application_for_Title_or_Registration_Rev-4-2021.pdf')
r.decrypt('')
w = PdfWriter(); w.append(r); w.set_need_appearances_writer(True)
w.write(open('REG-343_fill-template.pdf','wb'))
"
```

Content, field names, layout and revision are unchanged. Only the editing restriction is removed. Regenerate it whenever DMV publishes a new revision, and re-check the field mapping in `../lib/reg343/pdf.ts` — the field names are generic and positional, so a new revision can move them silently.

### Notes on the field structure

- **Field names are generic.** `Text62` is the owner's name, `Text10` the vehicle make. Mapping was established by stamping each field with its own name and rendering the form.
- **VIN, make and year appear on both pages** as one field with two widgets. The value belongs on the field, not the widget.
- **The option controls are not radio groups** but checkbox fields sharing a name across several widgets, each carrying a long accessibility sentence as its export value. They are selected by position rather than by that string.

---

## Supplementary forms referenced by REG 343

Conditionally triggered. The PWA surfaces them to the customer as a prompt; it does not implement them in Phase 1.

| Form | Triggered when |
|---|---|
| REG 4008 — Declaration of GVW/CGW | Commercial vehicle at 10,001 lbs or more |
| REG 256 — Statement of Facts | Vehicle acquired as a gift |
| REG 5036 — Statement of Construction | Body type modifications or alterations made |
| REG 5045 — Nonresident Military VLF Exemption | Applicant or spouse on active duty |
