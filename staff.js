/* staff.js - Stage 2: RID assignment + barcode generation */

document.addEventListener('DOMContentLoaded', () => {
  const { PDFDocument, rgb } = PDFLib;

  let pdfDoc = null;      // loaded PDFDocument
  let pdfForm = null;     // its form
  let finalBytes = null;  // bytes ready for download
  let sourceFileName = 'request.pdf';

  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('fileInput');
  const uploadStatus = document.getElementById('uploadStatus');
  const reviewCard = document.getElementById('reviewCard');
  const downloadCard = document.getElementById('downloadCard');
  const summaryBox = document.getElementById('summaryBox');
  const ridInput = document.getElementById('ridInput');
  const reviewedByInput = document.getElementById('reviewedByInput');
  const generateStatus = document.getElementById('generateStatus');
  const barcodePreview = document.getElementById('barcodePreview');
  const barcodeImg = document.getElementById('barcodeImg');

  function setStep(n) {
    ['step1', 'step2', 'step3'].forEach((id, i) => {
      document.getElementById(id).classList.toggle('active', i === n - 1);
    });
  }
  setStep(1);

  // ---- Drag & drop / click to browse ----
  dropzone.addEventListener('click', () => fileInput.click());
  dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('drag'); });
  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('drag'));
  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('drag');
    if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
  });
  fileInput.addEventListener('change', () => {
    if (fileInput.files.length) handleFile(fileInput.files[0]);
  });

  async function handleFile(file) {
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      showUploadStatus('Please upload a PDF file.', false);
      return;
    }
    sourceFileName = file.name;
    try {
      const bytes = await file.arrayBuffer();
      pdfDoc = await PDFDocument.load(bytes);
      pdfForm = pdfDoc.getForm();
      showUploadStatus(`Loaded "${file.name}" (${pdfDoc.getPageCount()} pages).`, true);
      populateSummary();
      reviewCard.style.display = 'block';
      downloadCard.style.display = 'none';
      barcodePreview.style.display = 'none';
      finalBytes = null;
      setStep(2);
    } catch (err) {
      console.error(err);
      showUploadStatus('Could not read that PDF: ' + err.message, false);
    }
  }

  function showUploadStatus(msg, ok) {
    uploadStatus.textContent = msg;
    uploadStatus.className = 'status-msg ' + (ok ? 'ok' : 'err');
  }

  // Field names created by pdf-builder.js are suffixed with a counter
  // (e.g. "f_requestedBy_7"), so match by prefix instead of exact name.
  function findTextByPrefix(prefix) {
    try {
      const fields = pdfForm.getFields();
      const match = fields.find((f) => f.getName().startsWith(prefix));
      if (match && typeof match.getText === 'function') return match.getText() || '';
    } catch (e) { /* field type mismatch, ignore */ }
    return '';
  }

  function populateSummary() {
    const requestedBy = findTextByPrefix('f_requestedBy');
    const dateRequired = findTextByPrefix('f_dateRequired');
    const orderType = findTextByPrefix('f_orderType');
    const accountName = findTextByPrefix('f_accountName');
    const shipInstitution = findTextByPrefix('f_shipInstitution');

    summaryBox.innerHTML = `
      <div><strong>Requested By:</strong> ${escapeHtml(requestedBy) || '-'}</div>
      <div><strong>Order Type:</strong> ${escapeHtml(orderType) || '-'}</div>
      <div><strong>Date Required:</strong> ${escapeHtml(dateRequired) || '-'}</div>
      <div><strong>Account Name:</strong> ${escapeHtml(accountName) || '-'}</div>
      <div><strong>Ship Institution:</strong> ${escapeHtml(shipInstitution) || '-'}</div>
    `;

    // Pre-fill RID if this PDF already has one (e.g. re-opened for correction).
    try {
      const ridField = pdfForm.getTextField(RID_FIELD_NAME);
      ridInput.value = ridField.getText() || '';
    } catch (e) { /* no RID field found */ }
    try {
      const rb = pdfForm.getTextField(REVIEWED_BY_FIELD_NAME);
      reviewedByInput.value = rb.getText() || '';
    } catch (e) { /* no field */ }
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  // ---- Generate barcode & embed ----
  document.getElementById('generateBtn').addEventListener('click', async () => {
    const rid = ridInput.value.trim();
    if (!rid) {
      showGenerateStatus('Enter an RID before generating the barcode.', false);
      return;
    }
    try {
      const canvas = document.getElementById('barcodeCanvas');
      JsBarcode(canvas, rid, {
        format: 'CODE128',
        displayValue: true,
        fontSize: 16,
        height: 50,
        margin: 6,
      });
      const dataUrl = canvas.toDataURL('image/png');
      barcodeImg.src = dataUrl;
      barcodePreview.style.display = 'block';

      const pngBytes = dataUrlToBytes(dataUrl);
      const pngImage = await pdfDoc.embedPng(pngBytes);

      // Find the Internal Use page (the last page, created by pdf-builder.js).
      const pages = pdfDoc.getPages();
      const targetPage = pages[pages.length - 1];

      // Scale the barcode to fit inside the placeholder box, centered.
      const box = BARCODE_RECT;
      const scale = Math.min(box.width / pngImage.width, box.height / pngImage.height);
      const drawW = pngImage.width * scale;
      const drawH = pngImage.height * scale;
      const drawX = box.x + (box.width - drawW) / 2;
      const drawY = box.y + (box.height - drawH) / 2;

      targetPage.drawRectangle({
        x: box.x, y: box.y, width: box.width, height: box.height,
        color: rgb(1, 1, 1),
      });
      targetPage.drawImage(pngImage, { x: drawX, y: drawY, width: drawW, height: drawH });

      // Update RID / Reviewed By fields (stay editable).
      pdfForm.getTextField(RID_FIELD_NAME).setText(rid);
      if (reviewedByInput.value.trim()) {
        pdfForm.getTextField(REVIEWED_BY_FIELD_NAME).setText(reviewedByInput.value.trim());
      }
      try {
        pdfForm.getTextField(DATE_ASSIGNED_FIELD_NAME).setText(new Date().toLocaleDateString());
      } catch (e) { /* optional field */ }

      finalBytes = await pdfDoc.save();
      showGenerateStatus('Barcode generated and embedded.', true);
      downloadCard.style.display = 'block';
      setStep(3);
    } catch (err) {
      console.error(err);
      showGenerateStatus('Could not generate the barcode: ' + err.message, false);
    }
  });

  function showGenerateStatus(msg, ok) {
    generateStatus.textContent = msg;
    generateStatus.className = 'status-msg ' + (ok ? 'ok' : 'err');
  }

  function dataUrlToBytes(dataUrl) {
    const base64 = dataUrl.split(',')[1];
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  // ---- Download final PDF ----
  document.getElementById('downloadBtn').addEventListener('click', () => {
    if (!finalBytes) return;
    const blob = new Blob([finalBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const rid = ridInput.value.trim() || 'request';
    a.href = url;
    a.download = `${rid}-final.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });

  // ---- Start over ----
  document.getElementById('startOverBtn').addEventListener('click', () => {
    pdfDoc = null; pdfForm = null; finalBytes = null;
    fileInput.value = '';
    reviewCard.style.display = 'none';
    downloadCard.style.display = 'none';
    barcodePreview.style.display = 'none';
    uploadStatus.className = 'status-msg';
    generateStatus.className = 'status-msg';
    setStep(1);
  });
});
