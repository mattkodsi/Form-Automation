#!/usr/bin/env node
/* rdiff.js — render two PDFs at the same DPI and diff the PIXELS.

   The point. compare.js compares *values* pulled out of a PDF, and both sides
   of that comparison have already had "$" and "," stripped from them. It is
   therefore structurally incapable of seeing a dropped dollar sign, a missing
   zero, a number that landed one row low, or a cell that printed blank where
   the form prints "0". Those are all the defects the owner has actually found
   by clicking. This tool sees them, because it compares renderings.

   Usage
     node rdiff.js <a.pdf> <b.pdf> [--dpi 110] [--out DIR]
                                   [--threshold 16] [--min-region 4] [--json]

     --dpi         both files are rendered at this DPI. Default 110.
     --threshold   per-pixel grey delta (0-255) that counts as "different".
                   Default 16. Below ~8 you are mostly measuring the
                   anti-aliaser; see THE ARTIFACT PROBLEM below.
     --min-region  drop connected regions smaller than this many differing
                   pixels. Default 4. Kills isolated speckle, keeps glyphs.
     --out         where the diff PNGs go. Default: a pid-scoped temp dir,
                   because parallel agents share /tmp.
     --json        machine-readable report on stdout.

   What it prints, per page: how many pixels differ, the bounding boxes of the
   connected differing REGIONS (merged on an 8px block grid, so a word is one
   box and not forty), where each region falls on the page in words, and the
   absolute path of a viewable side-by-side PNG with every region outlined in
   red and every differing pixel tinted magenta.

   THE ARTIFACT PROBLEM — what a pixel diff cannot tell you.
   A pixel diff cannot distinguish "the value changed" from "the same value was
   drawn by a different rasteriser, or in a font a quarter-point wider". Both
   show up as differing pixels. Two things here make the difference legible
   rather than hiding it:
     1. Every region carries `meanDelta` and `maxDelta`. A sub-pixel shift of
        identical ink is a thin outline of LOW mean delta hugging glyph edges;
        a changed character is a solid blob with meanDelta near the ink/paper
        contrast. The numbers are printed, not thresholded away.
     2. Every region carries `inkA`/`inkB` — how many pixels in that box are
        dark (<128) on each side. Equal ink with differing pixels means the
        same marks moved; unequal ink means marks appeared or vanished.
   Neither is a proof. This tool localises and quantifies; a human still looks
   at the PNG. That is the whole design: it exists so that looking is possible.

   Exit codes: 0 = identical, 1 = differences found, 2 = usage error,
               3 = no rasteriser (SKIPPED LOUDLY, never a silent pass),
               4 = the documents are not comparable (page count / page size).
*/
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const L = require('./look.js');

/* ------------------------------------------------------------------ *
 * 1. Pixel maths                                                      *
 * ------------------------------------------------------------------ */
const BLOCK = 8;      // region-merge grid, in pixels

/**
 * Diff two equal-sized grayscale rasters.
 * @returns {diffPixels, mask:Uint8Array, regions:[...]}
 */
function diffGray(a, b, opts) {
  const thr = (opts && opts.threshold) != null ? opts.threshold : 16;
  const minRegion = (opts && opts.minRegion) != null ? opts.minRegion : 4;
  if (a.w !== b.w || a.h !== b.h) throw new Error('diffGray: raster sizes differ');
  const w = a.w, h = a.h, n = w * h;
  const mask = new Uint8Array(n);
  const delta = new Uint8Array(n);
  let diffPixels = 0, sumDelta = 0, maxDelta = 0;
  for (let i = 0; i < n; i++) {
    const d = Math.abs(a.data[i] - b.data[i]);
    if (d > maxDelta) maxDelta = d;
    if (d > thr) { mask[i] = 1; delta[i] = d; diffPixels++; sumDelta += d; }
  }

  /* ---- merge into regions on a block grid ---- */
  const bw = Math.ceil(w / BLOCK), bh = Math.ceil(h / BLOCK);
  const blk = new Uint8Array(bw * bh);
  for (let y = 0; y < h; y++) {
    const by = (y / BLOCK) | 0, row = y * w;
    for (let x = 0; x < w; x++) if (mask[row + x]) blk[by * bw + ((x / BLOCK) | 0)] = 1;
  }
  // Dilate by one block so a gap of a few px (the space inside "$ 1,850")
  // does not split one edit into three regions.
  const dil = new Uint8Array(bw * bh);
  for (let by = 0; by < bh; by++) for (let bx = 0; bx < bw; bx++) {
    if (!blk[by * bw + bx]) continue;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const ny = by + dy, nx = bx + dx;
      if (ny >= 0 && ny < bh && nx >= 0 && nx < bw) dil[ny * bw + nx] = 1;
    }
  }
  // 8-connected components over the dilated grid, iterative flood fill.
  const lab = new Int32Array(bw * bh).fill(-1);
  const regions = [];
  const stack = [];
  for (let s = 0; s < bw * bh; s++) {
    if (!dil[s] || lab[s] !== -1) continue;
    const id = regions.length;
    lab[s] = id; stack.length = 0; stack.push(s);
    const cells = [];
    while (stack.length) {
      const c = stack.pop(); cells.push(c);
      const cy = (c / bw) | 0, cx = c % bw;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const ny = cy + dy, nx = cx + dx;
        if (ny < 0 || ny >= bh || nx < 0 || nx >= bw) continue;
        const q = ny * bw + nx;
        if (dil[q] && lab[q] === -1) { lab[q] = id; stack.push(q); }
      }
    }
    // Exact pixel bbox + stats, over the ACTUAL differing pixels in those cells
    // (the dilation is for merging only; it must not inflate a bbox).
    let x0 = w, y0 = h, x1 = -1, y1 = -1, count = 0, sum = 0, mx = 0;
    for (const c of cells) {
      const cy = (c / bw) | 0, cx = c % bw;
      const py1 = Math.min(h, (cy + 1) * BLOCK), px1 = Math.min(w, (cx + 1) * BLOCK);
      for (let y = cy * BLOCK; y < py1; y++) for (let x = cx * BLOCK; x < px1; x++) {
        const i = y * w + x;
        if (!mask[i]) continue;
        count++; sum += delta[i]; if (delta[i] > mx) mx = delta[i];
        if (x < x0) x0 = x; if (x > x1) x1 = x;
        if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
    }
    if (count < minRegion || x1 < 0) { regions.push(null); continue; }
    // ink on each side, inside the bbox — "did marks move, or appear?"
    let inkA = 0, inkB = 0;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const i = y * w + x;
      if (a.data[i] < 128) inkA++;
      if (b.data[i] < 128) inkB++;
    }
    regions.push({
      x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1,
      pixels: count, meanDelta: Math.round(sum / count), maxDelta: mx, inkA, inkB,
    });
  }
  const kept = regions.filter(Boolean).sort((p, q) => q.pixels - p.pixels);
  return {
    w, h, diffPixels, threshold: thr,
    pctDiff: +(100 * diffPixels / n).toFixed(4),
    meanDelta: diffPixels ? Math.round(sumDelta / diffPixels) : 0,
    maxDelta,
    regions: kept,
    droppedRegions: regions.length - kept.length,
    mask,
  };
}

/* ------------------------------------------------------------------ *
 * 2. Where on the page is it, in words                                *
 * ------------------------------------------------------------------ */
const ROWS = ['top', 'upper-middle', 'middle', 'lower-middle', 'bottom'];
const COLS = ['left edge', 'left', 'centre', 'right', 'right edge'];
function zoneOf(r, w, h) {
  const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
  const col = COLS[Math.min(COLS.length - 1, Math.floor(cx / w * COLS.length))];
  const row = ROWS[Math.min(ROWS.length - 1, Math.floor(cy / h * ROWS.length))];
  return row + ' ' + col;
}
function describe(r, w, h, dpi) {
  const pt = v => Math.round(v * 72 / dpi);
  const ink = r.inkA === r.inkB ? 'same ink on both sides (' + r.inkA + ' dark px) - marks MOVED or reshaped, none added'
    : r.inkB > r.inkA ? (r.inkB - r.inkA) + ' more dark px in B - something PRINTED that A did not'
      : (r.inkA - r.inkB) + ' fewer dark px in B - something A printed is MISSING';
  return zoneOf(r, w, h) +
    ' — box ' + r.w + 'x' + r.h + ' px at (' + r.x + ',' + r.y + ') px = (' + pt(r.x) + ',' + pt(r.y) + ') pts from top-left; ' +
    r.pixels + ' differing px, mean delta ' + r.meanDelta + '/255, max ' + r.maxDelta + '; ' + ink;
}

/* ------------------------------------------------------------------ *
 * 3. The viewable diff image                                          *
 * ------------------------------------------------------------------ */
/** Side-by-side A | B, differing pixels tinted magenta, regions outlined red. */
function composite(a, b, d) {
  const gap = 12, W = a.w + gap + b.w, H = Math.max(a.h, b.h);
  const rgb = new Uint8Array(W * H * 3).fill(0x60);          // grey gutter/letterbox
  const put = (src, ox, tint) => {
    for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) {
      const v = src.data[y * src.w + x], o = (y * W + (x + ox)) * 3;
      if (tint && d.mask[y * src.w + x]) { rgb[o] = 255; rgb[o + 1] = Math.min(255, v); rgb[o + 2] = 255; }
      else { rgb[o] = v; rgb[o + 1] = v; rgb[o + 2] = v; }
    }
  };
  put(a, 0, true);
  put(b, a.w + gap, true);
  const box = (r, ox) => {
    const pad = 3;
    const x0 = Math.max(0, r.x - pad), y0 = Math.max(0, r.y - pad);
    const x1 = Math.min(a.w - 1, r.x + r.w - 1 + pad), y1 = Math.min(H - 1, r.y + r.h - 1 + pad);
    const px = (x, y) => { if (x < 0 || y < 0 || y >= H) return; const o = (y * W + (x + ox)) * 3; rgb[o] = 220; rgb[o + 1] = 0; rgb[o + 2] = 0; };
    for (let x = x0; x <= x1; x++) { px(x, y0); px(x, y1); }
    for (let y = y0; y <= y1; y++) { px(x0, y); px(x1, y); }
  };
  for (const r of d.regions) { box(r, 0); box(r, a.w + gap); }
  return { w: W, h: H, rgb };
}

/* ------------------------------------------------------------------ *
 * 4. The comparison itself                                            *
 * ------------------------------------------------------------------ */
function renderDiff(pdfA, pdfB, opts) {
  opts = opts || {};
  const dpi = opts.dpi || 110;
  const out = path.resolve(opts.out || path.join(os.tmpdir(), 'rcs-rdiff', 'run-' + process.pid));
  const A = L.pageInfo(pdfA), B = L.pageInfo(pdfB);
  const rep = {
    a: path.resolve(pdfA), b: path.resolve(pdfB), dpi, out,
    pagesA: A.pages, pagesB: B.pages, comparable: true, notes: [], pages: [],
    totalDiffPixels: 0, identical: true,
  };
  if (A.pages !== B.pages) {
    rep.comparable = false;
    rep.identical = false;
    rep.notes.push('page counts differ: A has ' + A.pages + ', B has ' + B.pages +
      '. Only the first ' + Math.min(A.pages, B.pages) + ' page(s) are diffed; the rest exist on one side only and are NOT compared.');
  }
  const n = Math.min(A.pages, B.pages);
  fs.mkdirSync(out, { recursive: true });
  for (let p = 1; p <= n; p++) {
    const sa = A.sizes[p - 1], sb = B.sizes[p - 1];
    if (sa && sb && (Math.abs(sa.w - sb.w) > 0.5 || Math.abs(sa.h - sb.h) > 0.5)) {
      rep.identical = false;
      rep.pages.push({
        page: p, comparable: false,
        note: 'page ' + p + ' sizes differ: ' + sa.w + 'x' + sa.h + ' pts vs ' + sb.w + 'x' + sb.h +
          ' pts. NOT diffed — a pixel diff of two different page geometries is nonsense.',
        sizeA: sa, sizeB: sb,
      });
      continue;
    }
    const ra = L.renderGray(pdfA, p, dpi), rb = L.renderGray(pdfB, p, dpi);
    if (ra.w !== rb.w || ra.h !== rb.h) {
      rep.identical = false;
      rep.pages.push({
        page: p, comparable: false,
        note: 'page ' + p + ' rasterised to different pixel sizes (' + ra.w + 'x' + ra.h + ' vs ' + rb.w + 'x' + rb.h + '). NOT diffed.',
      });
      continue;
    }
    const d = diffGray(ra, rb, opts);
    rep.totalDiffPixels += d.diffPixels;
    if (d.diffPixels) rep.identical = false;
    let img = null;
    if (d.diffPixels || opts.alwaysWriteImage) {
      img = L.writePNG(path.join(out, 'diff-p' + String(p).padStart(3, '0') + '-' + dpi + 'dpi.png'), composite(ra, rb, d));
    }
    rep.pages.push({
      page: p, comparable: true, width: d.w, height: d.h,
      diffPixels: d.diffPixels, pctDiff: d.pctDiff, threshold: d.threshold,
      meanDelta: d.meanDelta, maxDelta: d.maxDelta,
      regions: d.regions.map(r => Object.assign({}, r, { where: zoneOf(r, d.w, d.h), summary: describe(r, d.w, d.h, dpi) })),
      droppedRegions: d.droppedRegions,
      image: img,
    });
  }
  return rep;
}

/* ------------------------------------------------------------------ *
 * 5. CLI                                                              *
 * ------------------------------------------------------------------ */
const USAGE =
  'usage: node rdiff.js <a.pdf> <b.pdf> [--dpi 110] [--out DIR] [--threshold 16] [--min-region 4] [--json]\n';

function parseArgv(argv) {
  const o = { dpi: 110, out: null, threshold: 16, minRegion: 4, json: false, files: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--json') o.json = true;
    else if (a === '--dpi') o.dpi = Number(argv[++i]);
    else if (a === '--out') o.out = argv[++i];
    else if (a === '--threshold') o.threshold = Number(argv[++i]);
    else if (a === '--min-region') o.minRegion = Number(argv[++i]);
    else if (a === '-h' || a === '--help') o.help = true;
    else if (a.startsWith('-')) throw new Error('unknown option ' + a + '\n' + USAGE);
    else o.files.push(a);
  }
  if (o.help) return o;
  if (o.files.length !== 2) throw new Error('want exactly two PDFs, got ' + o.files.length + '\n' + USAGE);
  if (!Number.isFinite(o.dpi) || o.dpi <= 0) throw new Error('--dpi must be a positive number');
  if (!Number.isFinite(o.threshold) || o.threshold < 0 || o.threshold > 255) throw new Error('--threshold must be 0..255');
  if (!Number.isFinite(o.minRegion) || o.minRegion < 0) throw new Error('--min-region must be >= 0');
  return o;
}

function report(rep, maxRegions) {
  const out = [];
  out.push('A: ' + rep.a + '  (' + rep.pagesA + ' pages)');
  out.push('B: ' + rep.b + '  (' + rep.pagesB + ' pages)');
  out.push('rendered at ' + rep.dpi + ' dpi');
  for (const nt of rep.notes) out.push('! ' + nt);
  for (const p of rep.pages) {
    out.push('');
    if (!p.comparable) { out.push('page ' + p.page + ': NOT COMPARABLE — ' + p.note); continue; }
    out.push('page ' + p.page + ': ' + p.width + 'x' + p.height + ' px, ' +
      p.diffPixels + ' differing px (' + p.pctDiff + '%), ' + p.regions.length + ' region(s)' +
      (p.droppedRegions ? ', ' + p.droppedRegions + ' speckle region(s) below --min-region dropped' : ''));
    if (!p.diffPixels) { out.push('  identical'); continue; }
    out.push('  overall mean delta ' + p.meanDelta + '/255, max ' + p.maxDelta);
    const show = p.regions.slice(0, maxRegions);
    show.forEach((r, i) => out.push('  [' + (i + 1) + '] ' + r.summary));
    if (p.regions.length > show.length) out.push('  ... and ' + (p.regions.length - show.length) + ' more region(s) (--json for all)');
    if (p.image) out.push('  look at: ' + p.image);
  }
  out.push('');
  out.push(rep.identical
    ? 'IDENTICAL — 0 differing pixels across ' + rep.pages.length + ' page(s) at ' + rep.dpi + ' dpi'
    : 'DIFFERENT — ' + rep.totalDiffPixels + ' differing pixels across ' + rep.pages.length + ' compared page(s)' +
      (rep.comparable ? '' : ' (and the documents are not fully comparable — see above)'));
  return out.join('\n');
}

function main(argv) {
  let o;
  try { o = parseArgv(argv); } catch (e) { process.stderr.write(String(e.message) + '\n'); return 2; }
  if (o.help) { process.stdout.write(USAGE); return 0; }
  if (!L.haveRasterizer().ok) L.bailNoRasterizer();
  let rep;
  try { rep = renderDiff(o.files[0], o.files[1], o); }
  catch (e) { process.stderr.write('rdiff: ' + (e.message || e) + '\n'); return 1; }
  process.stdout.write((o.json ? JSON.stringify(rep, null, 2) : report(rep, 25)) + '\n');
  if (!rep.comparable || rep.pages.some(p => !p.comparable)) return 4;
  return rep.identical ? 0 : 1;
}

module.exports = { diffGray, zoneOf, describe, composite, renderDiff, report, parseArgv, main, BLOCK, USAGE };

if (require.main === module) process.exit(main(process.argv.slice(2)));
