/* pdf-builder.js
 * Builds the "Print Requisition" PDF from collected form data using pdf-lib.
 * Every value is written into a real AcroForm field (text field or checkbox),
 * so the PDF stays editable by staff in any standard PDF viewer.
 * A final "Internal Use Only" page carries the RID field that the staff tool fills in.
 */

const PAGE_W = PDF_PAGE_W;
const PAGE_H = PDF_PAGE_H;
const MARGIN = PDF_MARGIN;
const CONTENT_W = PAGE_W - MARGIN * 2;

async function buildRequestPdf(data) {
  const { PDFDocument, StandardFonts, rgb } = PDFLib;

  const pdfDoc = await PDFDocument.create();
  pdfDoc.setTitle('Print Requisition' + (data.requestedBy ? ' - ' + data.requestedBy : ''));
  pdfDoc.setSubject('Print Requisition');
  pdfDoc.setCreator('Print Requisition Webform');

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const form = pdfDoc.getForm();

  const navy = rgb(0.11, 0.17, 0.23);
  const gold = rgb(0.78, 0.63, 0.23);
  const gray = rgb(0.42, 0.46, 0.5);
  const line = rgb(0.85, 0.86, 0.88);

  let page = pdfDoc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;
  let fieldCounter = 0;

  function nextName(base) {
    fieldCounter += 1;
    return `${base}_${fieldCounter}`;
  }

  function newPage() {
    page = pdfDoc.addPage([PAGE_W, PAGE_H]);
    y = PAGE_H - MARGIN;
  }

  function ensureSpace(h) {
    if (y - h < MARGIN + 20) newPage();
  }

  function drawDocHeader() {
    page.drawText('Print Requisition', { x: MARGIN, y: y - 4, size: 18, font: fontBold, color: navy });
    const generated = 'Generated ' + new Date().toLocaleString();
    const w = font.widthOfTextAtSize(generated, 9);
    page.drawText(generated, { x: PAGE_W - MARGIN - w, y: y, size: 9, font, color: gray });
    y -= 14;
    page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_W - MARGIN, y }, thickness: 2, color: gold });
    y -= 22;
  }

  function drawSectionHeader(title) {
    ensureSpace(30);
    page.drawRectangle({ x: MARGIN, y: y - 20, width: CONTENT_W, height: 22, color: navy });
    page.drawText(title, { x: MARGIN + 8, y: y - 14, size: 11, font: fontBold, color: rgb(1, 1, 1) });
    y -= 20;
    y -= 18;
  }

  // One row of N labeled text fields, evenly spaced across content width.
  function drawFieldRow(fields, rowH = 34) {
    ensureSpace(rowH);
    const gap = 12;
    const totalWeight = fields.reduce((s, f) => s + (f.weight || 1), 0);
    let x = MARGIN;
    const usable = CONTENT_W - gap * (fields.length - 1);
    fields.forEach((f) => {
      const w = usable * ((f.weight || 1) / totalWeight);
      page.drawText(f.label, { x, y: y, size: 9, font: fontBold, color: gray });
      const tf = form.createTextField(nextName('f_' + f.name));
      tf.setText(f.value || '');
      tf.enableMultiline && f.multiline && tf.enableMultiline();
      tf.addToPage(page, {
        x, y: y - 20, width: w, height: 18,
        font, borderWidth: 1, borderColor: line, backgroundColor: rgb(0.98, 0.98, 0.98),
      });
      x += w + gap;
    });
    y -= rowH;
  }

  function drawTextArea(label, value, height = 50) {
    ensureSpace(height + 20);
    page.drawText(label, { x: MARGIN, y: y, size: 9, font: fontBold, color: gray });
    const tf = form.createTextField(nextName('f_' + label));
    tf.setText(value || '');
    tf.enableMultiline();
    tf.addToPage(page, {
      x: MARGIN, y: y - 16 - height, width: CONTENT_W, height,
      font, borderWidth: 1, borderColor: line, backgroundColor: rgb(0.98, 0.98, 0.98),
    });
    y -= (height + 24);
  }

  function drawCheckboxGroup(items, columns = 3) {
    const colW = CONTENT_W / columns;
    const rows = Math.ceil(items.length / columns);
    ensureSpace(rows * 20 + 10);
    items.forEach((item, i) => {
      const col = i % columns;
      const row = Math.floor(i / columns);
      const x = MARGIN + col * colW;
      const cy = y - row * 20;
      const cb = form.createCheckBox(nextName('c_' + item.label));
      cb.addToPage(page, { x, y: cy - 10, width: 11, height: 11, borderWidth: 1, borderColor: line });
      if (item.checked) cb.check();
      page.drawText(item.label, { x: x + 16, y: cy - 9, size: 9.5, font, color: navy });
    });
    y -= rows * 20 + 14;
  }

  function drawPrintingTable(rows) {
    const cols = [
      { key: 'pages', label: 'Pages', weight: 1 },
      { key: 'sided', label: 'Sided', weight: 1.2 },
      { key: 'qty', label: 'Qty', weight: 0.8 },
      { key: 'fileName', label: 'File Name', weight: 2 },
    ];
    const gap = 8;
    const totalWeight = cols.reduce((s, c) => s + c.weight, 0);
    const usable = CONTENT_W - gap * (cols.length - 1);

    ensureSpace(20);
    let x = MARGIN;
    cols.forEach((c) => {
      const w = usable * (c.weight / totalWeight);
      page.drawText(c.label, { x, y, size: 9, font: fontBold, color: gray });
      x += w + gap;
    });
    y -= 16;

    rows.forEach((row) => {
      ensureSpace(24);
      let cx = MARGIN;
      cols.forEach((c) => {
        const w = usable * (c.weight / totalWeight);
        const tf = form.createTextField(nextName('pr_' + c.key));
        tf.setText(String(row[c.key] || ''));
        tf.addToPage(page, {
          x: cx, y: y - 16, width: w, height: 17,
          font, borderWidth: 1, borderColor: line, backgroundColor: rgb(0.98, 0.98, 0.98),
        });
        cx += w + gap;
      });
      y -= 22;
    });
    y -= 6;
  }

  // ---- Page 1 ----
  drawDocHeader();

  drawSectionHeader('1. Order Info');
  drawFieldRow([
    { name: 'orderType', label: 'Order Type', value: data.orderType },
    { name: 'previousOrder', label: 'Previous Order #', value: data.previousOrder },
    { name: 'dateRequired', label: 'Date Required', value: data.dateRequired },
  ]);
  drawFieldRow([
    { name: 'requestedBy', label: 'Requested By', value: data.requestedBy, weight: 1.5 },
    { name: 'requestorEmail', label: 'Requestor Email', value: data.requestorEmail, weight: 1.5 },
  ]);

  drawSectionHeader('2. Account');
  drawFieldRow([
    { name: 'accountNumber', label: 'Account #', value: data.accountNumber },
    { name: 'accountName', label: 'Account Name', value: data.accountName },
  ]);
  drawFieldRow([
    { name: 'budgetCode', label: 'Budget Code', value: data.budgetCode },
    { name: 'purchaseOrder', label: 'Purchase Order', value: data.purchaseOrder },
  ]);

  drawSectionHeader('3. Shipping');
  drawFieldRow([
    { name: 'shipMethod', label: 'Method', value: data.shipMethod },
    { name: 'shipInstitution', label: 'Institution', value: data.shipInstitution },
  ]);
  drawTextArea('Address', data.shipAddress, 34);
  drawFieldRow([
    { name: 'shipAttention', label: 'Attention', value: data.shipAttention },
    { name: 'shipPhone', label: 'Phone', value: data.shipPhone },
  ]);

  drawSectionHeader('4. Graphics');
  drawCheckboxGroup(data.graphicsChecks, 3);
  drawFieldRow([{ name: 'totalFiles', label: 'Total Files Supplied', value: data.totalFiles, weight: 1 }]);

  // ---- Printing (own section, may span pages) ----
  drawSectionHeader('5. Printing');
  drawPrintingTable(data.printingRows);
  drawCheckboxGroup(data.printingChecks, 3);
  if (data.spotColourValue) {
    drawFieldRow([{ name: 'spotColourValue', label: 'Spot Colour', value: data.spotColourValue, weight: 1 }]);
  }

  drawSectionHeader('6. Paper');
  drawFieldRow([
    { name: 'paperSize', label: 'Size', value: data.paperSize },
    { name: 'paperWeight', label: 'Weight', value: data.paperWeight },
    { name: 'paperColour', label: 'Colour', value: data.paperColour },
  ]);
  if (data.otherDimensions) {
    drawFieldRow([{ name: 'otherDimensions', label: 'Other Dimensions', value: data.otherDimensions, weight: 1 }]);
  }
  if (data.specialPaperValue) {
    drawFieldRow([{ name: 'specialPaperValue', label: 'Special Paper', value: data.specialPaperValue, weight: 1 }]);
  }

  drawSectionHeader('7. Finishing');
  drawCheckboxGroup(data.finishingChecks, 3);
  if (data.foldType) {
    drawFieldRow([
      { name: 'foldType', label: 'Fold Type', value: data.foldType },
      { name: 'foldDirection', label: 'Fold Direction', value: data.foldDirection },
    ]);
  }
  if (data.coverFront || data.coverBack) {
    drawCheckboxGroup([
      { label: 'Cover - Front', checked: data.coverFront },
      { label: 'Cover - Back', checked: data.coverBack },
    ], 2);
  }

  drawSectionHeader('8. Packaging');
  drawCheckboxGroup(data.packagingChecks, 3);
  if (data.bandCount) {
    drawFieldRow([{ name: 'bandCount', label: '# per Band', value: String(data.bandCount), weight: 1 }]);
  }
  if (data.otherPackagingValue) {
    drawFieldRow([{ name: 'otherPackagingValue', label: 'Other Packaging', value: data.otherPackagingValue, weight: 1 }]);
  }

  drawSectionHeader('9. Additional Information');
  drawTextArea('Comments', data.comments, 60);

  // ---- Internal Use page (RID + barcode, filled in by staff tool) ----
  newPage();
  page.drawRectangle({ x: MARGIN, y: y - 20, width: CONTENT_W, height: 22, color: navy });
  page.drawText('Internal Use Only', { x: MARGIN + 8, y: y - 14, size: 11, font: fontBold, color: rgb(1, 1, 1) });
  y -= 50;

  page.drawText('This page is completed by Print Services after review.', { x: MARGIN, y, size: 10, font, color: gray });
  y -= 30;

  page.drawText('RID', { x: MARGIN, y, size: 9, font: fontBold, color: gray });
  const ridField = form.createTextField(RID_FIELD_NAME);
  ridField.setText('');
  ridField.addToPage(page, {
    x: MARGIN, y: y - 22, width: 220, height: 22,
    font: fontBold, borderWidth: 1.2, borderColor: navy, backgroundColor: rgb(1, 1, 1),
  });
  y -= 60;

  // This label/rectangle position MUST match BARCODE_RECT in pdf-config.js
  page.drawText('Barcode', { x: MARGIN, y, size: 9, font: fontBold, color: gray });
  page.drawRectangle({
    x: BARCODE_RECT.x, y: BARCODE_RECT.y, width: BARCODE_RECT.width, height: BARCODE_RECT.height,
    borderWidth: 1, borderColor: line, color: rgb(0.98, 0.98, 0.98),
  });
  page.drawText('Not yet generated - use the Staff RID & Barcode Tool', {
    x: MARGIN + 10, y: y - 45, size: 8.5, font, color: gray,
  });

  page.drawText('Reviewed By', { x: MARGIN + 300, y, size: 9, font: fontBold, color: gray });
  const reviewedBy = form.createTextField(REVIEWED_BY_FIELD_NAME);
  reviewedBy.addToPage(page, {
    x: MARGIN + 300, y: y - 22, width: 180, height: 20,
    font, borderWidth: 1, borderColor: line, backgroundColor: rgb(0.98, 0.98, 0.98),
  });

  page.drawText('Date Assigned', { x: MARGIN + 300, y: y - 50, size: 9, font: fontBold, color: gray });
  const dateAssigned = form.createTextField(DATE_ASSIGNED_FIELD_NAME);
  dateAssigned.addToPage(page, {
    x: MARGIN + 300, y: y - 72, width: 180, height: 20,
    font, borderWidth: 1, borderColor: line, backgroundColor: rgb(0.98, 0.98, 0.98),
  });

  form.updateFieldAppearances(font);
  const bytes = await pdfDoc.save();
  return bytes;
}
