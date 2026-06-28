export function printHTML(title: string, body: string) {
  const w = window.open("", "_blank", "width=900,height=700");
  if (!w) return;
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"/><title>${title}</title>
  <style>
    *{box-sizing:border-box} body{font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#0f172a;padding:32px;max-width:800px;margin:auto}
    h1{font-size:22px;margin:0 0 4px} h2{font-size:14px;margin:24px 0 8px;letter-spacing:.06em;text-transform:uppercase;color:#64748b}
    .muted{color:#64748b;font-size:12px} table{width:100%;border-collapse:collapse;margin-top:8px;font-size:13px}
    th,td{padding:8px 10px;border-bottom:1px solid #e2e8f0;text-align:left} th{background:#f8fafc;font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#475569}
    .right{text-align:right} .totals{margin-top:16px;display:flex;justify-content:flex-end;gap:32px;font-size:14px}
    .totals .label{color:#64748b} .totals .val{font-weight:700}
    .head{display:flex;justify-content:space-between;align-items:flex-start;gap:24px;border-bottom:2px solid #0f172a;padding-bottom:16px}
    .badge{display:inline-block;padding:2px 8px;border-radius:999px;background:#0f172a;color:#fff;font-size:11px}
    @media print{body{padding:0}}
  </style></head><body>${body}<script>window.onload=()=>{setTimeout(()=>window.print(),200)}</script></body></html>`);
  w.document.close();
}
