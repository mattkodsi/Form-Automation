#!/usr/bin/env node
/* look.js — turn a PDF into something a person can actually LOOK AT.

   Why this exists. Every comparator on this project reads a PDF's *values*:
   extract.js strips "$" and "," out of every field it pulls, and compare.js
   strips a leading "$" again before it compares. So a generated rent schedule
   that printed "1850" where the filed one printed "$1,850" compared as a
   perfect match, and a 34-property audit reported success while the document
   was visibly wrong. The comparator could not have seen it: it never looked at
   a rendering. This tool renders.

   It shells out to poppler's pdftoppm — already on this box, no npm anything —
   and prints the absolute path of every PNG it wrote, so a human (or another
   agent) can open the files directly.

   Usage
     node look.js <file.pdf> [--pages 1-3] [--dpi 110] [--out DIR]
                             [--crop x,y,w,h] [--json]

     --pages   1     |  2-3  |  all      (default: all)
     --dpi     N                          (default: 110)
     --crop    x,y,w,h  in OUTPUT PIXELS at the chosen --dpi, origin top-left.
               Pixels, not points, because that is what pdftoppm's -x/-y/-W/-H
               take and a silent unit conversion is exactly the class of bug
               this tool exists to catch. To crop by page points, multiply by
               dpi/72 yourself — or use pointsToPx() from this module.
     --out     directory to write into (default: a pid-scoped temp dir, so two
               agents running in parallel cannot clobber each other's renders).
     --json    print a JSON manifest instead of plain paths.

   Worked example — read the "Total Rent Loss" box on page 2 of a HUD-92458
   closely enough to tell a "$0" from a "0" from an empty cell:

     node app/full-mp/corpus/look.js form.pdf --pages 2 --dpi 300 \
          --crop 1200,2400,1350,260 --out /tmp/look

   If pdftoppm is missing this SKIPS LOUDLY and exits non-zero. It never exits
   0 having produced nothing — a silent no-op is how a broken check reads as a
   passing one.

   Also usable as a module:  const L = require('./look.js')
     L.haveRasterizer()                  -> {ok, why, version}
     L.pageInfo(pdf)                     -> {pages, sizes:[{w,h}], ...}   (points)
     L.rasterize({pdf,pages,dpi,out,crop}) -> [{page,path,width,height}]
     L.renderGray(pdf, page, dpi, crop)  -> {w,h,data:Uint8Array}         (1 byte/px)
     L.writePNG(path, {w,h,rgb})         -> path        (zlib only, no deps)
     L.readPNM(buf)                      -> {w,h,chan,data}
*/
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');
const { execFileSync, spawnSync } = require('child_process');

/* ------------------------------------------------------------------ *
 * 0. Is there a rasterizer at all?                                    *
 * ------------------------------------------------------------------ */
let _have = null;
function haveRasterizer() {
  if (_have) return _have;
  const r = spawnSync('pdftoppm', ['-v'], { encoding: 'utf8' });
  if (r.error || r.status === null) {
    _have = { ok: false, why: 'pdftoppm not found on PATH (install poppler: brew install poppler)', version: null };
  } else {
    // pdftoppm -v prints its banner on stderr and exits 0 on modern poppler.
    const banner = String(r.stderr || '') + String(r.stdout || '');
    const m = /pdftoppm version ([\d.]+)/.exec(banner);
    _have = { ok: true, why: null, version: m ? m[1] : 'unknown' };
  }
  return _have;
}

/** Print the skip banner and exit non-zero. Never returns. */
function bailNoRasterizer() {
  const h = haveRasterizer();
  process.stderr.write(
    '\n' + '='.repeat(68) + '\n' +
    '  !!! SKIPPED - NO PDF RASTERIZER  !!!\n' +
    '  ' + h.why + '\n' +
    '  Nothing was rendered. This is NOT a pass.\n' +
    '='.repeat(68) + '\n');
  process.exit(3);
}

/* ------------------------------------------------------------------ *
 * 1. What is in the file (page count, page sizes in points)           *
 * ------------------------------------------------------------------ */
function pageInfo(pdf) {
  if (!fs.existsSync(pdf)) throw new Error('no such file: ' + pdf);
  let txt;
  try {
    txt = execFileSync('pdfinfo', ['-l', '9999', pdf], { encoding: 'utf8', maxBuffer: 1 << 24 });
  } catch (e) {
    throw new Error('pdfinfo failed on ' + pdf + ': ' + (e.message || e));
  }
  const pages = Number((/^Pages:\s+(\d+)/m.exec(txt) || [])[1] || 0);
  // pdfinfo -l N prints "Page  N size: 612 x 792 pts" for each page; a
  // single-size document prints one "Page size:" line instead.
  const sizes = [];
  const per = /^Page\s+(\d+)\s+size:\s+([\d.]+)\s+x\s+([\d.]+)\s+pts/gm;
  let m;
  while ((m = per.exec(txt))) sizes[Number(m[1]) - 1] = { w: +m[2], h: +m[3] };
  if (!sizes.length) {
    const one = /^Page size:\s+([\d.]+)\s+x\s+([\d.]+)\s+pts/m.exec(txt);
    if (one) for (let i = 0; i < pages; i++) sizes[i] = { w: +one[1], h: +one[2] };
  }
  return { pages, sizes, raw: txt };
}

/** Page points -> output pixels at a DPI. The only place the conversion lives. */
const pointsToPx = (pt, dpi) => Math.round(pt * dpi / 72);

/** What pdftoppm will produce for a page of `w`x`h` points at `dpi`. */
function expectedPx(w, h, dpi) {
  // poppler rounds each axis independently, to nearest.
  return { width: Math.round(w * dpi / 72), height: Math.round(h * dpi / 72) };
}

/* ------------------------------------------------------------------ *
 * 2. Page-range parsing                                               *
 * ------------------------------------------------------------------ */
function parsePages(spec, total) {
  if (!spec || spec === 'all') return Array.from({ length: total }, (_, i) => i + 1);
  const out = [];
  for (const part of String(spec).split(',')) {
    const s = part.trim();
    if (!s) continue;
    const m = /^(\d+)(?:\s*-\s*(\d+))?$/.exec(s);
    if (!m) throw new Error('bad --pages value: ' + JSON.stringify(spec) + ' (want 1, 2-3, 1,3 or all)');
    const a = Number(m[1]), b = m[2] ? Number(m[2]) : a;
    if (a < 1 || b < a) throw new Error('bad page range: ' + s);
    for (let p = a; p <= b; p++) out.push(p);
  }
  const seen = new Set(), uniq = [];
  for (const p of out) { if (!seen.has(p)) { seen.add(p); uniq.push(p); } }
  const over = uniq.filter(p => p > total);
  if (over.length) throw new Error('page(s) ' + over.join(',') + ' requested but the document has ' + total);
  return uniq;
}

function parseCrop(spec) {
  if (!spec) return null;
  const n = String(spec).split(',').map(s => Number(s.trim()));
  if (n.length !== 4 || n.some(v => !Number.isFinite(v)))
    throw new Error('bad --crop value: ' + JSON.stringify(spec) + ' (want x,y,w,h in pixels)');
  if (n[2] <= 0 || n[3] <= 0) throw new Error('--crop width and height must be positive');
  if (n[0] < 0 || n[1] < 0) throw new Error('--crop x and y must not be negative');
  return { x: Math.round(n[0]), y: Math.round(n[1]), w: Math.round(n[2]), h: Math.round(n[3]) };
}

/* ------------------------------------------------------------------ *
 * 3. Rasterize                                                        *
 * ------------------------------------------------------------------ */
function cropArgs(crop) {
  return crop ? ['-x', String(crop.x), '-y', String(crop.y), '-W', String(crop.w), '-H', String(crop.h)] : [];
}

/** Read a PNG's IHDR. We wrote or poppler wrote it; either way it is byte 16. */
function pngSize(file) {
  const fd = fs.openSync(file, 'r');
  const b = Buffer.alloc(24);
  fs.readSync(fd, b, 0, 24, 0);
  fs.closeSync(fd);
  if (b.slice(0, 8).toString('binary') !== '\x89PNG\r\n\x1a\n') throw new Error('not a PNG: ' + file);
  return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
}

function defaultOutDir(pdf, dpi) {
  // pid-scoped: parallel agents share /tmp, and a run that reads another run's
  // output is the single most confusing failure mode this repo has hit.
  const base = path.basename(pdf).replace(/\.pdf$/i, '').replace(/[^\w.-]+/g, '_');
  return path.join(os.tmpdir(), 'rcs-look', base + '-' + dpi + 'dpi-' + process.pid);
}

/**
 * Rasterize pages to PNG.
 * @returns [{page, path, width, height}]  — path is absolute.
 */
function rasterize(opts) {
  const h = haveRasterizer();
  if (!h.ok) throw new Error('SKIP: ' + h.why);
  const pdf = path.resolve(opts.pdf);
  const dpi = opts.dpi || 110;
  const info = pageInfo(pdf);
  if (!info.pages) throw new Error('pdfinfo reports 0 pages in ' + pdf);
  const pages = Array.isArray(opts.pages) ? opts.pages : parsePages(opts.pages, info.pages);
  const crop = opts.crop && typeof opts.crop === 'string' ? parseCrop(opts.crop) : (opts.crop || null);
  const out = path.resolve(opts.out || defaultOutDir(pdf, dpi));
  fs.mkdirSync(out, { recursive: true });

  const stem = path.basename(pdf).replace(/\.pdf$/i, '').replace(/[^\w.-]+/g, '_');
  const wrote = [];
  for (const p of pages) {
    // dpi + crop go in the NAME, not just the directory: rendering page 2 at
    // 110 dpi and then cropped at 300 into the same --out must not silently
    // overwrite the first render with the second.
    const tag = '-p' + String(p).padStart(3, '0') + '-' + dpi + 'dpi' +
                (crop ? '-c' + crop.x + '_' + crop.y + '_' + crop.w + 'x' + crop.h : '');
    const prefix = path.join(out, stem + tag);
    execFileSync('pdftoppm', [
      '-png', '-r', String(dpi), '-f', String(p), '-l', String(p), '-singlefile',
      ...cropArgs(crop), pdf, prefix,
    ], { stdio: ['ignore', 'ignore', 'pipe'], maxBuffer: 1 << 26 });
    const file = prefix + '.png';
    if (!fs.existsSync(file)) throw new Error('pdftoppm wrote nothing for page ' + p);
    const sz = pngSize(file);
    wrote.push({ page: p, path: file, width: sz.width, height: sz.height });
  }
  return wrote;
}

/* ------------------------------------------------------------------ *
 * 4. Raw pixels — PGM/PPM, for the maths in rdiff.js                  *
 * ------------------------------------------------------------------ */
/** Parse a binary PGM (P5) or PPM (P6). Returns {w,h,chan,data}. */
function readPNM(buf) {
  if (buf.length < 2 || buf[0] !== 0x50) throw new Error('not a PNM (no P magic)');
  const kind = buf[1];
  if (kind !== 0x35 && kind !== 0x36) throw new Error('unsupported PNM type P' + (kind - 0x30) + ' (want P5 or P6)');
  const chan = kind === 0x35 ? 1 : 3;
  let i = 2, fields = [];
  const isWS = c => c === 0x20 || c === 0x09 || c === 0x0a || c === 0x0d;
  while (fields.length < 3) {
    while (i < buf.length && isWS(buf[i])) i++;
    if (buf[i] === 0x23) { while (i < buf.length && buf[i] !== 0x0a) i++; continue; } // comment
    let s = i;
    while (i < buf.length && !isWS(buf[i])) i++;
    if (i === s) throw new Error('truncated PNM header');
    fields.push(Number(buf.slice(s, i).toString('ascii')));
  }
  i++; // exactly one whitespace byte after maxval
  const [w, h, maxval] = fields;
  if (maxval !== 255) throw new Error('PNM maxval ' + maxval + ' unsupported (want 255)');
  const need = w * h * chan;
  if (buf.length - i < need) throw new Error('PNM truncated: want ' + need + ' bytes, have ' + (buf.length - i));
  return { w, h, chan, data: new Uint8Array(buf.buffer, buf.byteOffset + i, need) };
}

/** Render one page to 8-bit grayscale pixels. No temp PNG, no decode. */
function renderGray(pdf, page, dpi, crop) {
  const h = haveRasterizer();
  if (!h.ok) throw new Error('SKIP: ' + h.why);
  // NOTE: poppler writes to stdout only when the output ROOT is omitted
  // entirely. Passing "-" as the root does not mean stdout — it silently
  // creates a file literally named "-.pgm" and exits 0, which is exactly the
  // shape of failure this whole tool exists to stop: a success code and
  // nothing rendered. Verified against pdftoppm 26.07.0.
  const r = spawnSync('pdftoppm', [
    '-gray', '-r', String(dpi), '-f', String(page), '-l', String(page),
    ...cropArgs(crop || null), path.resolve(pdf),
  ], { maxBuffer: 1 << 28 });
  if (r.status !== 0) throw new Error('pdftoppm failed on page ' + page + ': ' + String(r.stderr || '').trim());
  if (!r.stdout || !r.stdout.length)
    throw new Error('pdftoppm exited 0 but wrote no pixels for page ' + page + ' of ' + pdf);
  return readPNM(r.stdout);
}

/* ------------------------------------------------------------------ *
 * 5. A minimal PNG writer (zlib only — no npm)                        *
 * ------------------------------------------------------------------ */
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td), 0);
  return Buffer.concat([len, td, crc]);
}
/** img = {w, h, rgb: Uint8Array(w*h*3)} */
function writePNG(file, img) {
  const { w, h, rgb } = img;
  if (rgb.length !== w * h * 3) throw new Error('writePNG: rgb is ' + rgb.length + ' bytes, want ' + (w * h * 3));
  const raw = Buffer.alloc(h * (1 + w * 3));
  for (let y = 0; y < h; y++) {
    raw[y * (1 + w * 3)] = 0;                                   // filter: none
    Buffer.from(rgb.buffer, rgb.byteOffset + y * w * 3, w * 3)
      .copy(raw, y * (1 + w * 3) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;  // 8-bit RGB
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 6 })),
    chunk('IEND', Buffer.alloc(0)),
  ]));
  return path.resolve(file);
}

/* ------------------------------------------------------------------ *
 * 6. CLI                                                              *
 * ------------------------------------------------------------------ */
const USAGE =
  'usage: node look.js <file.pdf> [--pages 1-3] [--dpi 110] [--out DIR] [--crop x,y,w,h] [--json]\n' +
  '       --crop is in OUTPUT PIXELS at the chosen --dpi, origin top-left.\n';

function parseArgv(argv) {
  const o = { pdf: null, pages: 'all', dpi: 110, out: null, crop: null, json: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--json') o.json = true;
    else if (a === '--pages') o.pages = argv[++i];
    else if (a === '--dpi') o.dpi = Number(argv[++i]);
    else if (a === '--out') o.out = argv[++i];
    else if (a === '--crop') o.crop = argv[++i];
    else if (a === '-h' || a === '--help') o.help = true;
    else if (a.startsWith('-')) throw new Error('unknown option ' + a + '\n' + USAGE);
    else if (!o.pdf) o.pdf = a;
    else throw new Error('unexpected extra argument ' + a + '\n' + USAGE);
  }
  if (!o.help) {
    if (!o.pdf) throw new Error('no PDF given\n' + USAGE);
    if (!Number.isFinite(o.dpi) || o.dpi <= 0) throw new Error('--dpi must be a positive number');
  }
  return o;
}

function main(argv) {
  let o;
  try { o = parseArgv(argv); } catch (e) { process.stderr.write(String(e.message) + '\n'); return 2; }
  if (o.help) { process.stdout.write(USAGE); return 0; }
  if (!haveRasterizer().ok) bailNoRasterizer();
  let files, info;
  try {
    info = pageInfo(o.pdf);
    files = rasterize(o);
  } catch (e) { process.stderr.write('look: ' + (e.message || e) + '\n'); return 1; }
  if (o.json) {
    process.stdout.write(JSON.stringify({ pdf: path.resolve(o.pdf), dpi: o.dpi, pages: info.pages, crop: parseCrop(o.crop), files }, null, 2) + '\n');
  } else {
    const sz = info.sizes[0];
    process.stdout.write(path.basename(o.pdf) + ': ' + info.pages + ' page' + (info.pages === 1 ? '' : 's') +
      (sz ? ', ' + sz.w + ' x ' + sz.h + ' pts' : '') + ' @ ' + o.dpi + ' dpi' +
      (o.crop ? ', crop ' + o.crop + ' px' : '') + '\n');
    for (const f of files) process.stdout.write('  page ' + f.page + '  ' + f.width + 'x' + f.height + ' px  ' + f.path + '\n');
  }
  return 0;
}

module.exports = {
  haveRasterizer, bailNoRasterizer, pageInfo, pointsToPx, expectedPx,
  parsePages, parseCrop, rasterize, renderGray, readPNM, writePNG, pngSize,
  defaultOutDir, parseArgv, main, USAGE,
};

if (require.main === module) process.exit(main(process.argv.slice(2)));
