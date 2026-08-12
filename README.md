# Print Requisition Webform

A two-stage, database-free, static web app for print job intake:

1. **`index.html`** &mdash; the customer-facing form. Customer fills it out, clicks
   **Create Request**, and a professional request PDF downloads to their computer.
   Every value is written into a real, editable PDF form field, so nothing needs
   to be re-typed later.
2. **`staff.html`** &mdash; your internal tool. Upload the PDF the customer emailed
   you, review/edit specs directly in the browser or in your PDF reader, type in
   the RID you're assigning, click **Generate Barcode**, and download the final
   production PDF with a Code 128 barcode baked in.

No backend, no database, no server-side code — everything runs in the browser.
That means it can be hosted for free on **GitHub Pages** (or any static host).

## Files

```
webform/
  index.html       customer intake form
  staff.html       staff RID + barcode tool
  style.css        shared styling
  form.js          customer form behavior (conditional fields, dynamic rows)
  pdf-builder.js   builds the request PDF from the form data (pdf-lib)
  staff.js         loads the PDF, embeds barcode, re-saves (pdf-lib + JsBarcode)
  pdf-config.js    shared layout constants used by both pdf-builder.js and staff.js
```

## How the PDF stays editable

`pdf-builder.js` doesn't just draw text onto the PDF — it creates actual AcroForm
fields (text fields and checkboxes) and pre-fills them with the customer's
answers. Any PDF reader (Acrobat, Preview, browser PDF viewers, etc.) will let
you click into those fields and correct them, exactly like the original CBE
print requisition workflow.

The last page of every generated PDF is labeled **"Internal Use Only"** and has:
- an editable **RID** field (blank until staff assigns one)
- a placeholder box where the barcode image goes
- optional **Reviewed By** / **Date Assigned** fields

## Why the barcode is a baked-in image, not embedded PDF JavaScript

An earlier approach tried to generate the barcode using JavaScript embedded
inside the PDF itself (so typing an RID directly in Acrobat would draw the
barcode). That relied on Acrobat's font-embedding for the barcode font, which
proved unreliable across viewers. This version avoids that entirely: the
**staff tool renders the barcode as a real PNG image in the browser**
(via JsBarcode) and stamps it onto the PDF using pdf-lib. It always renders
correctly because it's just a picture, not a barcode font depending on the PDF
viewer's JS engine.

If you correct the RID after the barcode was generated, click **Generate
Barcode** again — it overwrites the previous image in the same spot.

## Hosting on GitHub Pages

1. Create a repo (e.g. `print-requisition`) and push these files to it.
2. In the repo settings, enable **Pages** → deploy from the `main` branch, root folder.
3. Share the `index.html` URL with customers, and keep the `staff.html` URL for
   internal use (it isn't linked from anywhere public except a link on the form
   itself — you may want to remove that link, or password-protect staff.html
   separately, since GitHub Pages has no built-in access control. See "Restricting
   staff.html" below.)

## Restricting staff.html

GitHub Pages sites are public by default. Options if you don't want customers
finding the staff tool:
- Put `staff.html` (and its JS) in a **private** repo and host it separately
  (e.g. on your existing home server / Cloudflare Tunnel setup), while
  `index.html` stays on public GitHub Pages.
- Use GitHub Pages on a **private repository** with GitHub Enterprise/Pro,
  which supports access restrictions.
- Add a simple client-side password gate (not real security, just deters
  casual visitors) or, better, host `staff.html` behind the authentication
  you already use for other internal tools.

## Customizing fields

- Add/remove fields directly in `index.html`; give new inputs an `id`.
- Read them into the `data` object in `form.js`'s `createRequestBtn` handler.
- Add a corresponding line in `pdf-builder.js` (`drawFieldRow`, `drawCheckboxGroup`,
  or `drawTextArea`) to place it on the PDF.
- The **Internal Use Only** page layout is intentionally simple and fixed —
  if you resize or move the barcode placeholder box, update `BARCODE_RECT` in
  `pdf-config.js` to match, since both `pdf-builder.js` and `staff.js` read
  from that single source of truth.

## Notes on the current field set

A couple of small additions beyond your original spec, easy to remove if
unwanted:
- **Requested By** / **Requestor Email** in Order Info, so staff has someone
  to contact about the job.
- **Previous Order #** only appears when Order Type is set to "Reprint /
  Re-order" (mirrors the conditional pattern used elsewhere in your spec).
- **Reviewed By** / **Date Assigned** on the Internal Use page, auto-filled
  when the barcode is generated.

Everything else follows your field list and grouping exactly (Order Info,
Account, Shipping, Graphics, Printing with dynamic rows, Paper, Finishing,
Packaging, Additional Information).
