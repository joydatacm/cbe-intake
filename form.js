/* form.js - customer intake form behavior */

document.addEventListener('DOMContentLoaded', () => {
  // ---- Order Info: show Previous Order # only for reprints ----
  const orderType = document.getElementById('orderType');
  const previousOrderField = document.getElementById('previousOrderField');
  function syncOrderType() {
    const isReprint = orderType.value === 'Reprint / Re-order';
    previousOrderField.style.display = isReprint ? 'flex' : 'none';
  }
  orderType.addEventListener('change', syncOrderType);
  syncOrderType();

  // ---- Generic checkbox -> conditional block toggler ----
  function wireToggle(checkboxId, targetId) {
    const cb = document.getElementById(checkboxId);
    const target = document.getElementById(targetId);
    function sync() { target.classList.toggle('show', cb.checked); }
    cb.addEventListener('change', sync);
    sync();
  }
  wireToggle('spotColourCheck', 'spotColourField');
  wireToggle('specialPaperCheck', 'specialPaperField');
  wireToggle('bandInCheck', 'bandInField');
  wireToggle('otherPackagingCheck', 'otherPackagingField');
  wireToggle('foldingCheck', 'foldingSub');
  wireToggle('coversCheck', 'coversSub');

  // ---- Paper size -> Other Dimensions ----
  const paperSize = document.getElementById('paperSize');
  const otherDimensionsField = document.getElementById('otherDimensionsField');
  function syncPaperSize() {
    otherDimensionsField.style.display = paperSize.value === 'Other' ? 'flex' : 'none';
  }
  paperSize.addEventListener('change', syncPaperSize);
  syncPaperSize();

  // ---- Printing rows (dynamic add/remove) ----
  const printingRowsBody = document.getElementById('printingRows');
  const addRowBtn = document.getElementById('addRowBtn');

  function addPrintingRow() {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><input type="text" class="pr-pages" placeholder="e.g. 4"></td>
      <td>
        <select class="pr-sided">
          <option value="1-Sided">1-Sided</option>
          <option value="2-Sided">2-Sided</option>
        </select>
      </td>
      <td><input type="number" class="pr-qty" min="0" step="1"></td>
      <td><input type="text" class="pr-filename" placeholder="filename.pdf"></td>
      <td class="rm"><button type="button" class="btn-remove" title="Remove row">&times;</button></td>
    `;
    tr.querySelector('.btn-remove').addEventListener('click', () => {
      if (printingRowsBody.children.length > 1) tr.remove();
    });
    printingRowsBody.appendChild(tr);
  }
  addRowBtn.addEventListener('click', addPrintingRow);
  addPrintingRow(); // start with one row

  // ---- Helpers ----
  function checkedValues(containerId) {
    return Array.from(document.querySelectorAll(`#${containerId} input[type=checkbox]`))
      .map((el) => ({ label: el.value, checked: el.checked }));
  }

  function collectPrintingRows() {
    return Array.from(printingRowsBody.querySelectorAll('tr')).map((tr) => ({
      pages: tr.querySelector('.pr-pages').value.trim(),
      sided: tr.querySelector('.pr-sided').value,
      qty: tr.querySelector('.pr-qty').value.trim(),
      fileName: tr.querySelector('.pr-filename').value.trim(),
    })).filter((r) => r.pages || r.qty || r.fileName);
  }

  function val(id) {
    const el = document.getElementById(id);
    return el ? el.value.trim() : '';
  }

  function showStatus(msg, ok) {
    const box = document.getElementById('statusMsg');
    box.textContent = msg;
    box.className = 'status-msg ' + (ok ? 'ok' : 'err');
  }

  function slugify(s) {
    return (s || 'request').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  }

  // ---- Create Request ----
  document.getElementById('createRequestBtn').addEventListener('click', async () => {
    const data = {
      orderType: val('orderType'),
      previousOrder: val('previousOrder'),
      dateRequired: val('dateRequired'),
      requestedBy: val('requestedBy'),
      requestorEmail: val('requestorEmail'),

      accountNumber: val('accountNumber'),
      accountName: val('accountName'),
      budgetCode: val('budgetCode'),
      purchaseOrder: val('purchaseOrder'),

      shipMethod: val('shipMethod'),
      shipInstitution: val('shipInstitution'),
      shipAddress: val('shipAddress'),
      shipAttention: val('shipAttention'),
      shipPhone: val('shipPhone'),

      graphicsChecks: checkedValues('graphicsChecks'),
      totalFiles: val('totalFiles'),

      printingRows: collectPrintingRows(),
      printingChecks: checkedValues('printingChecks'),
      spotColourValue: document.getElementById('spotColourCheck').checked ? val('spotColourValue') : '',

      paperSize: val('paperSize'),
      otherDimensions: val('paperSize') === 'Other' ? val('otherDimensions') : '',
      paperWeight: val('paperWeight'),
      paperColour: val('paperColour'),
      specialPaperValue: document.getElementById('specialPaperCheck').checked ? val('specialPaperValue') : '',

      finishingChecks: checkedValues('finishingChecks'),
      foldType: document.getElementById('foldingCheck').checked ? document.getElementById('foldType').value : '',
      foldDirection: document.getElementById('foldingCheck').checked ? document.getElementById('foldDirection').value : '',
      coverFront: document.getElementById('coversCheck').checked && document.getElementById('coverFront').checked,
      coverBack: document.getElementById('coversCheck').checked && document.getElementById('coverBack').checked,

      packagingChecks: checkedValues('packagingChecks'),
      bandCount: document.getElementById('bandInCheck').checked ? val('bandCount') : '',
      otherPackagingValue: document.getElementById('otherPackagingCheck').checked ? val('otherPackagingValue') : '',

      comments: val('comments'),
    };

    if (!data.requestedBy || !data.dateRequired) {
      showStatus('Please fill in at least "Requested By" and "Date Required" before creating the request.', false);
      return;
    }

    try {
      const bytes = await buildRequestPdf(data);
      const blob = new Blob([bytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const stamp = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `print-request-${slugify(data.requestedBy)}-${stamp}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      showStatus('Request PDF created and downloaded. Please email the PDF to Print Services to submit your job.', true);
    } catch (err) {
      console.error(err);
      showStatus('Something went wrong generating the PDF: ' + err.message, false);
    }
  });
});
