/* pdf-config.js
 * Shared layout constants for the "Internal Use Only" page.
 * Both pdf-builder.js (customer form) and staff.js (RID/barcode tool) must
 * agree on these so the barcode image lands exactly on the placeholder box.
 */
const PDF_PAGE_W = 612;   // US Letter, points
const PDF_PAGE_H = 792;
const PDF_MARGIN = 42;

const RID_FIELD_NAME = 'RID';
const REVIEWED_BY_FIELD_NAME = 'ReviewedBy';
const DATE_ASSIGNED_FIELD_NAME = 'DateAssigned';

// Position of the barcode placeholder box drawn on the Internal Use page.
// Must match the rectangle drawn in pdf-builder.js's Internal Use section.
const BARCODE_RECT = { x: PDF_MARGIN, y: 540, width: 260, height: 60 };
