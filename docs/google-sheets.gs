/**
 * Apps Script nhận dữ liệu từ app và ghi vào tab "Cập nhật từ app".
 * Cách dùng: README mục "Google Sheets". Đổi SECRET trùng biến SHEETS_WEBHOOK_SECRET trên Vercel.
 */
const SECRET = "DOI_THANH_CHUOI_BI_MAT";
const SHEET_NAME = "Cập nhật từ app"; // tab riêng, không đụng tab "Tổng hợp" cũ

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    if (body.secret !== SECRET) return out({ ok: false, error: "Sai secret" });
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sh = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
    const n = body.headers.length;
    sh.getRange(1, 1, 1, n).setValues([body.headers]).setFontWeight("bold");
    sh.setFrozenRows(1);
    sh.getRange(2, 1, Math.max(sh.getMaxRows() - 1, 1), n).setNumberFormat("@"); // giữ ngày dạng dd/mm/yyyy
    if (body.mode === "replace") {
      if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, n).clearContent();
      if (body.rows.length) sh.getRange(2, 1, body.rows.length, n).setValues(body.rows);
    } else {
      const last = sh.getLastRow();
      const sites = last > 1 ? sh.getRange(2, 1, last - 1, 1).getValues().map(function (r) { return String(r[0]); }) : [];
      body.rows.forEach(function (row) {
        const i = sites.indexOf(String(row[0]));
        if (i >= 0) sh.getRange(i + 2, 1, 1, n).setValues([row]);
        else { sh.getRange(sh.getLastRow() + 1, 1, 1, n).setValues([row]); sites.push(String(row[0])); }
      });
    }
    return out({ ok: true, rows: body.rows.length });
  } catch (err) {
    return out({ ok: false, error: String(err) });
  }
}
function out(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
