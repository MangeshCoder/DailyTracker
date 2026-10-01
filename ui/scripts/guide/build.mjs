// ─────────────────────────────────────────────────────────────────────────────
//  Builds the user-guide PDFs in ui/public from content-en.mjs / content-mr.mjs.
//    npm run guide
//  Uses the Playwright Chromium already installed for the UI tests. For the
//  Marathi edition a Devanagari font must be installed (e.g. Noto Sans Devanagari).
//  Two passes: the first finds the page each section starts on, the second
//  prints those page numbers in the contents list.
// ─────────────────────────────────────────────────────────────────────────────
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const publicDir = join(here, '..', '..', 'public');
// Montcrest Software logo for the cover (embedded, so the PDF needs no files)
const logo = `data:image/png;base64,${readFileSync(join(publicDir, 'brand', 'montcrest-logo.png')).toString('base64')}`;

const css = `
  @page { size: A4; margin: 18mm 16mm 20mm 16mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Noto Sans', 'Noto Sans Devanagari', 'DejaVu Sans', sans-serif; color: #1e293b; font-size: 10.5pt; line-height: 1.55; margin: 0; }
  .cover { height: 250mm; display: flex; flex-direction: column; justify-content: center; page-break-after: always; }
  .logo { height: 64px; width: auto; align-self: flex-start; margin-bottom: 26px; }
  .brand { font-size: 10pt; letter-spacing: .18em; text-transform: uppercase; color: #B35F00; font-weight: 700; }
  .cover h1 { font-size: 30pt; line-height: 1.15; margin: 10px 0 6px; color: #0f172a; }
  .cover .subtitle { font-size: 13pt; color: #475569; margin: 0 0 22px; }
  .cover .updated { font-size: 9.5pt; color: #64748b; margin-top: 26px; }
  .lead { font-size: 11.5pt; color: #334155; }
  .box { border: 1px solid #cbd5e1; background: #f8fafc; border-radius: 10px; padding: 12px 16px; margin: 16px 0; }
  .toc { page-break-after: always; }
  .toc h2 { font-size: 20pt; margin: 0 0 16px; color: #0f172a; }
  .toc ol { list-style: none; padding: 0; margin: 0; }
  .toc li { display: flex; align-items: baseline; gap: 8px; padding: 7px 0; border-bottom: 1px dotted #cbd5e1; font-size: 11pt; }
  .toc .n { color: #B35F00; font-weight: 700; width: 26px; }
  .toc .t { flex: 1; }
  .toc .p { color: #64748b; font-variant-numeric: tabular-nums; }
  section { page-break-before: always; }
  section:first-of-type { page-break-before: auto; }
  .num { display: inline-block; background: #B35F00; color: #fff; font-weight: 700; border-radius: 6px; padding: 1px 8px; font-size: 11pt; margin-right: 8px; }
  h2 { font-size: 18pt; margin: 0 0 2px; color: #0f172a; }
  .sub { color: #64748b; margin: 0 0 14px; font-size: 10.5pt; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; }
  h3 { font-size: 12pt; margin: 16px 0 4px; color: #961B1F; }
  ul, ol { margin: 4px 0 8px; padding-left: 20px; }
  li { margin: 3px 0; }
  table { width: 100%; border-collapse: collapse; margin: 8px 0 12px; font-size: 9.8pt; page-break-inside: avoid; }
  th { background: #FFF8EB; color: #7A1619; text-align: left; }
  th, td { border: 1px solid #cbd5e1; padding: 5px 8px; vertical-align: top; }
  .ui { font-weight: 600; color: #0f172a; background: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 4px; padding: 0 4px; white-space: nowrap; }
  .tip { border-left: 4px solid #10b981; background: #ecfdf5; padding: 8px 12px; border-radius: 6px; margin: 12px 0; }
  .mark { font-size: 1px; color: #fff; }
`;

const html = (c, pages) => `<!doctype html><html lang="${c.meta.lang}"><head><meta charset="utf-8"><style>${css}</style></head><body>
  <div class="cover">
    <img class="logo" src="${logo}" alt="Montcrest Software">
    <div class="brand">DailyTracker v2</div>
    <h1>${c.meta.title}</h1>
    <p class="subtitle">${c.meta.subtitle}</p>
    ${c.cover}
    <p class="updated">${c.meta.updated}</p>
  </div>
  <div class="toc"><h2>${c.meta.contents}</h2><ol>
    ${c.sections.map((s, i) => `<li><span class="n">${i + 1}</span><span class="t">${s.title}</span><span class="p">${pages?.[i] ?? ''}</span></li>`).join('')}
  </ol></div>
  ${c.sections.map((s, i) => `<section>
    <span class="mark">[[S${String(i + 1).padStart(2, '0')}]]</span>
    <h2><span class="num">${i + 1}</span>${s.title}</h2><p class="sub">${s.sub}</p>${s.body}</section>`).join('')}
</body></html>`;

const footer = (c) => `<div style="width:100%;font-size:8px;color:#94a3b8;padding:0 16mm;display:flex;justify-content:space-between;font-family:'Noto Sans','Noto Sans Devanagari',sans-serif;">
  <span>${c.meta.footer}</span><span>${c.meta.page} <span class="pageNumber"></span> ${c.meta.of} <span class="totalPages"></span></span></div>`;

async function render(browser, c, pages, out) {
  const page = await browser.newPage();
  await page.setContent(html(c, pages), { waitUntil: 'load' });
  await page.pdf({ path: out, format: 'A4', printBackground: true, displayHeaderFooter: true,
    headerTemplate: '<span></span>', footerTemplate: footer(c),
    margin: { top: '18mm', bottom: '20mm', left: '16mm', right: '16mm' } });
  await page.close();
}

/** The page each section starts on, found through its hidden marker */
function sectionPages(pdf, count) {
  const text = execFileSync('pdftotext', ['-layout', pdf, '-'], { encoding: 'utf8' });
  const pages = text.split('\f');
  return Array.from({ length: count }, (_, i) => {
    const mark = `[[S${String(i + 1).padStart(2, '0')}]]`;
    const idx = pages.findIndex(p => p.includes(mark));
    return idx >= 0 ? idx + 1 : '';
  });
}

const browser = await chromium.launch();
const work = mkdtempSync(join(tmpdir(), 'guide-'));
for (const lang of ['en', 'mr']) {
  const c = await import(`./content-${lang}.mjs`);
  const first = join(work, `${lang}.pdf`);
  await render(browser, c, null, first);
  const pages = sectionPages(first, c.sections.length);
  const out = join(publicDir, c.meta.file);
  await render(browser, c, pages, out);
  const total = execFileSync('pdfinfo', [out], { encoding: 'utf8' }).match(/Pages:\s+(\d+)/)?.[1];
  const size = Math.round(readFileSync(out).length / 1024);
  console.log(`${c.meta.file}: ${total} pages, ${size} KB`);
  writeFileSync(join(work, `${lang}.json`), JSON.stringify({ pages: Number(total), sizeKb: size }));
}
await browser.close();
