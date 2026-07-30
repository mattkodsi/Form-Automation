/* test_look.js — the render-and-look instrument, held to what it claims.

   These two tools exist because every other comparator on this project reads
   VALUES: extract.js strips "$" and "," from what it pulls, compare.js strips
   a leading "$" again before comparing, and so a 34-property audit reported
   success against a rent schedule that was visibly dropping dollar signs and
   printing blanks where the form prints 0. A tool that claims to see
   appearance has to be pinned to appearance, or it is the same failure one
   layer up.

   So the fixtures here are PDFs this file BUILDS, byte by byte, with a black
   rectangle at a page position the test computed itself. That makes every
   claim checkable in absolute terms: not "the diff found something" but "the
   diff found it at pixel (611,919), which is where 400,150 in PDF points lands
   at 110 dpi with the origin flipped". A region reported in the wrong place is
   the failure mode that would make this instrument worse than useless — it
   would send a reviewer to look at the wrong cell and come back reassured.

   Skips LOUDLY (and the run_tests.sh line still passes, but says so) when
   poppler is not installed. It never reads a missing rasteriser as a pass. */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');
const { spawnSync } = require('child_process');

const MIN_CHECKS = 159;                // the count this file is known to run to the end
let n = 0, fails = 0, verdict = null;
const BAR = '='.repeat(68);
function fail(msg, err) {
  fails++; console.log('  X ' + msg + (err ? ': ' + (err && err.message || err) : ''));
  if (err && err.stack) console.log(String(err.stack).split('\n').slice(1, 4).join('\n'));
}
function eq(label, got, want) {
  n++;
  const a = JSON.stringify(got), b = JSON.stringify(want);
  if (a === b) console.log('  + ' + label); else fail(label + ': got ' + a + ' want ' + b);
}
const T = (label, v) => eq(label, !!v, true);
/** got must be within tol of want — for pixel positions, where poppler's
    rounding is its own business and ±2px is not a defect. */
function near(label, got, want, tol) {
  n++;
  if (Math.abs(got - want) <= tol) console.log('  + ' + label + ' (' + got + ' ~ ' + want + ' ±' + tol + ')');
  else fail(label + ': got ' + got + ', want ' + want + ' ±' + tol);
}
function throws(label, fn, re) {
  n++;
  let e = null; try { fn(); } catch (err) { e = err; }
  if (!e) return fail(label + ': did not throw');
  if (re && !re.test(String(e.message))) return fail(label + ': threw the wrong thing: ' + e.message);
  console.log('  + ' + label);
}
function finish() {
  console.log('\n' + BAR);
  if (fails) {
    verdict = 'X LOOK SUITE FAILED (' + n + ' checks ran, ' + fails + ' failed)';
    console.log('  XXX  LOOK SUITE FAILED  XXX');
    console.log('  ' + fails + ' of ' + n + ' checks failed - see the X lines above');
  } else if (n < MIN_CHECKS) {
    fails = 1;
    verdict = 'X LOOK SUITE FAILED (only ' + n + ' of ' + MIN_CHECKS + ' checks ran)';
    console.log('  XXX  LOOK SUITE FAILED  XXX');
    console.log('  only ' + n + ' of the expected ' + MIN_CHECKS + ' checks ran - the suite died partway, or checks were deleted without lowering MIN_CHECKS on purpose');
  } else verdict = '+ ALL ' + n + ' LOOK CHECKS PASSED';
  console.log(fails ? (BAR + '\n') : '');
  console.log(verdict);
  process.exit(fails ? 1 : 0);
}

const D = path.join(__dirname, '..') + path.sep;               // app/full-mp/
const LOOK = path.join(__dirname, 'look.js');
const RDIFF = path.join(__dirname, 'rdiff.js');
const L = require(LOOK);
const R = require(RDIFF);

/* ------------------------------------------------------------------ *
 * 0. No rasteriser -> skip LOUDLY, never as a pass                    *
 * ------------------------------------------------------------------ */
if (!L.haveRasterizer().ok) {
  console.log('\n' + BAR);
  console.log('  !!! LOOK SUITE SKIPPED - no pdftoppm on PATH');
  console.log('  ' + L.haveRasterizer().why);
  console.log('  Nothing about rendering was verified. This is NOT a pass.');
  console.log(BAR);
  console.log('! LOOK SUITE SKIPPED (no rasteriser)');
  process.exit(0);
}

/* pid-scoped: parallel agents share /tmp, and a suite reading another run's
   artefacts is a failure this repo has already paid for once. */
const TMP = path.join(os.tmpdir(), 'rcs-test-look-' + process.pid);
fs.rmSync(TMP, { recursive: true, force: true });
fs.mkdirSync(TMP, { recursive: true });
process.on('exit', () => { try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

/* ------------------------------------------------------------------ *
 * 1. Fixtures we build ourselves, so every coordinate is known        *
 * ------------------------------------------------------------------ */
/** A minimal, uncompressed, valid PDF. pages = [{w,h,content}] in points. */
function makePDF(pages) {
  const objs = []; const kids = []; const plan = [];
  let id = 3;
  for (const p of pages) { const pid = id++, cid = id++; kids.push(pid); plan.push({ pid, cid, p }); }
  objs[1] = '<</Type/Catalog/Pages 2 0 R>>';
  objs[2] = '<</Type/Pages/Kids[' + kids.map(k => k + ' 0 R').join(' ') + ']/Count ' + pages.length + '>>';
  for (const { pid, cid, p } of plan) {
    objs[pid] = '<</Type/Page/Parent 2 0 R/MediaBox[0 0 ' + p.w + ' ' + p.h + ']/Contents ' + cid + ' 0 R/Resources<<>>>>';
    objs[cid] = '<</Length ' + Buffer.byteLength(p.content, 'latin1') + '>>stream\n' + p.content + '\nendstream';
  }
  let out = '%PDF-1.4\n'; const off = [];
  for (let i = 1; i < id; i++) { off[i] = out.length; out += i + ' 0 obj\n' + objs[i] + '\nendobj\n'; }
  const xref = out.length;
  out += 'xref\n0 ' + id + '\n0000000000 65535 f \n';
  for (let i = 1; i < id; i++) out += String(off[i]).padStart(10, '0') + ' 00000 n \n';
  out += 'trailer\n<</Size ' + id + '/Root 1 0 R>>\nstartxref\n' + xref + '\n%%EOF\n';
  return Buffer.from(out, 'latin1');
}
const rect = (x, y, w, h) => '0 0 0 rg ' + x + ' ' + y + ' ' + w + ' ' + h + ' re f\n';
const write = (name, buf) => { const p = path.join(TMP, name); fs.writeFileSync(p, buf); return p; };

/* The one mark on the base page. PDF's origin is BOTTOM-left; a raster's is
   TOP-left. Getting that flip wrong is the single most plausible way for this
   instrument to point a reviewer at the wrong cell, so it is asserted below
   from numbers computed here rather than from anything the tools return. */
const PW = 612, PH = 792;
const MARK = { x: 100, y: 600, w: 50, h: 40 };            // points, bottom-left origin
const ADD = { x: 400, y: 150, w: 60, h: 40 };            // the deliberate alteration
const topY = m => PH - (m.y + m.h);                       // points from the TOP
const px = (v, dpi) => v * dpi / 72;

const BASE = write('base.pdf', makePDF([{ w: PW, h: PH, content: rect(MARK.x, MARK.y, MARK.w, MARK.h) }]));
const ALTERED = write('altered.pdf', makePDF([{ w: PW, h: PH, content: rect(MARK.x, MARK.y, MARK.w, MARK.h) + rect(ADD.x, ADD.y, ADD.w, ADD.h) }]));
const TWOPAGE = write('twopage.pdf', makePDF([
  { w: PW, h: PH, content: rect(MARK.x, MARK.y, MARK.w, MARK.h) },
  { w: PW, h: PH, content: rect(200, 300, 40, 40) }]));
const TALL = write('tall.pdf', makePDF([{ w: PW, h: 1008, content: rect(MARK.x, MARK.y, MARK.w, MARK.h) }]));

/* ------------------------------------------------------------------ *
 * 2. An independent PNG reader — deliberately NOT look.js's helpers,  *
 *    so "we wrote a PNG" is not checked by the thing that wrote it.   *
 * ------------------------------------------------------------------ */
function crc32ref(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return (~c) >>> 0;
}
function readPNGref(file) {
  const b = fs.readFileSync(file);
  if (b.slice(0, 8).toString('hex') !== '89504e470d0a1a0a') throw new Error('bad PNG signature');
  let i = 8; const chunks = []; let ihdr = null; const idat = [];
  while (i < b.length) {
    const len = b.readUInt32BE(i), type = b.slice(i + 4, i + 8).toString('ascii');
    const data = b.slice(i + 8, i + 8 + len), crc = b.readUInt32BE(i + 8 + len);
    if (crc32ref(b.slice(i + 4, i + 8 + len)) !== crc) throw new Error('bad CRC on chunk ' + type);
    chunks.push(type);
    if (type === 'IHDR') ihdr = { w: data.readUInt32BE(0), h: data.readUInt32BE(4), depth: data[8], color: data[9] };
    if (type === 'IDAT') idat.push(data);
    i += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = 1 + ihdr.w * 3;
  const rgb = Buffer.alloc(ihdr.w * ihdr.h * 3);
  for (let y = 0; y < ihdr.h; y++) {
    if (raw[y * stride] !== 0) throw new Error('unexpected PNG filter ' + raw[y * stride] + ' on row ' + y);
    raw.copy(rgb, y * ihdr.w * 3, y * stride + 1, y * stride + 1 + ihdr.w * 3);
  }
  return Object.assign({}, ihdr, { chunks, rgb });
}

/* ------------------------------------------------------------------ *
 * 3. The checks                                                       *
 * ------------------------------------------------------------------ */
try {
  console.log(BAR);
  console.log('  look.js / rdiff.js — pdftoppm ' + L.haveRasterizer().version);
  console.log(BAR);

  /* ---- unit conversion, stated once and asserted ---- */
  console.log('\n-- points, pixels and page ranges --');
  eq('72 dpi is 1 px per point', L.pointsToPx(612, 72), 612);
  eq('110 dpi scales letter width', L.pointsToPx(612, 110), 935);
  eq('110 dpi scales letter height', L.pointsToPx(792, 110), 1210);
  eq('300 dpi scales letter width', L.pointsToPx(612, 300), 2550);
  eq('expectedPx returns both axes', L.expectedPx(612, 792, 110), { width: 935, height: 1210 });

  eq('pages "all" expands', L.parsePages('all', 3), [1, 2, 3]);
  eq('pages undefined means all', L.parsePages(undefined, 2), [1, 2]);
  eq('a single page', L.parsePages('2', 3), [2]);
  eq('a range', L.parsePages('2-3', 3), [2, 3]);
  eq('a list', L.parsePages('1,3', 3), [1, 3]);
  eq('duplicates collapse, order kept', L.parsePages('3,1,3', 3), [3, 1]);
  throws('a page past the end is refused, not clamped', () => L.parsePages('4', 3), /has 3/);
  throws('a reversed range is refused', () => L.parsePages('3-1', 3), /bad page range/);
  throws('nonsense is refused', () => L.parsePages('two', 3), /bad --pages/);

  eq('crop parses to ints', L.parseCrop('10,20,30,40'), { x: 10, y: 20, w: 30, h: 40 });
  eq('no crop is null', L.parseCrop(null), null);
  throws('a 3-value crop is refused', () => L.parseCrop('1,2,3'), /bad --crop/);
  throws('a zero-width crop is refused', () => L.parseCrop('1,2,0,4'), /positive/);
  throws('a negative origin is refused', () => L.parseCrop('-1,2,3,4'), /negative/);

  /* ---- what is in the file ---- */
  console.log('\n-- pageInfo --');
  const iBase = L.pageInfo(BASE), iTwo = L.pageInfo(TWOPAGE), iTall = L.pageInfo(TALL);
  eq('one page in the base fixture', iBase.pages, 1);
  eq('and its size in points', iBase.sizes[0], { w: 612, h: 792 });
  eq('two pages in the two-page fixture', iTwo.pages, 2);
  eq('the tall fixture is taller', iTall.sizes[0], { w: 612, h: 1008 });
  throws('a missing file is refused', () => L.pageInfo(path.join(TMP, 'nope.pdf')), /no such file/);

  /* ---- rasterise: page count and PIXEL DIMENSIONS ---- */
  console.log('\n-- rasterize --');
  const out1 = path.join(TMP, 'r1');
  const r110 = L.rasterize({ pdf: BASE, dpi: 110, out: out1 });
  eq('one page in, one PNG out', r110.length, 1);
  eq('it is page 1', r110[0].page, 1);
  eq('935 px wide at 110 dpi', r110[0].width, 935);
  eq('1210 px tall at 110 dpi', r110[0].height, 1210);
  T('the path it printed exists', fs.existsSync(r110[0].path));
  T('and is absolute', path.isAbsolute(r110[0].path));

  const r72 = L.rasterize({ pdf: BASE, dpi: 72, out: out1 });
  eq('612x792 px at 72 dpi', [r72[0].width, r72[0].height], [612, 792]);
  T('a second dpi does NOT overwrite the first render', r72[0].path !== r110[0].path);
  T('and the 110 dpi file is still there', fs.existsSync(r110[0].path));

  const r300 = L.rasterize({ pdf: BASE, dpi: 300, out: out1 });
  eq('2550x3300 px at 300 dpi', [r300[0].width, r300[0].height], [2550, 3300]);

  const rTwo = L.rasterize({ pdf: TWOPAGE, pages: 'all', dpi: 110, out: out1 });
  eq('both pages of a two-page file', rTwo.map(f => f.page), [1, 2]);
  const rP2 = L.rasterize({ pdf: TWOPAGE, pages: '2', dpi: 110, out: out1 });
  eq('and one page when one is asked for', rP2.map(f => f.page), [2]);
  throws('asking for page 3 of a 2-page file is refused', () => L.rasterize({ pdf: TWOPAGE, pages: '3', dpi: 110, out: out1 }), /has 2/);

  /* ---- crop: exact dimensions, and the right part of the page ---- */
  console.log('\n-- crop --');
  const rc = L.rasterize({ pdf: BASE, dpi: 110, out: out1, crop: '50,100,300,200' });
  eq('a crop is exactly its requested width', rc[0].width, 300);
  eq('and exactly its requested height', rc[0].height, 200);
  const rc2 = L.rasterize({ pdf: BASE, dpi: 300, out: out1, crop: { x: 0, y: 0, w: 640, h: 480 } });
  eq('a crop object works too, at another dpi', [rc2[0].width, rc2[0].height], [640, 480]);
  T('the two crops did not collide on disk', rc[0].path !== rc2[0].path);

  /* Crop tightly around the mark and assert the crop actually holds ink —
     a crop with the right dimensions and the wrong contents is exactly the
     kind of near-miss that would let a reviewer "confirm" the wrong cell. */
  const dpi = 110;
  const mx0 = Math.round(px(MARK.x, dpi)), my0 = Math.round(px(topY(MARK), dpi));
  const mw = Math.round(px(MARK.w, dpi)), mh = Math.round(px(MARK.h, dpi));
  const gCrop = L.renderGray(BASE, 1, dpi, { x: mx0 + 4, y: my0 + 4, w: mw - 8, h: mh - 8 });
  let darkInCrop = 0;
  for (let i = 0; i < gCrop.data.length; i++) if (gCrop.data[i] < 128) darkInCrop++;
  eq('a crop inside the mark is entirely ink', darkInCrop, gCrop.data.length);
  const gAway = L.renderGray(BASE, 1, dpi, { x: 500, y: 900, w: 100, h: 100 });
  let darkAway = 0;
  for (let i = 0; i < gAway.data.length; i++) if (gAway.data[i] < 128) darkAway++;
  eq('a crop of blank page is entirely paper', darkAway, 0);

  /* ---- renderGray: raw pixels, and the coordinate flip ---- */
  console.log('\n-- renderGray + the PDF/raster origin flip --');
  const g = L.renderGray(BASE, 1, dpi);
  eq('grayscale raster is 935 px wide', g.w, 935);
  eq('and 1210 px tall', g.h, 1210);
  eq('one byte per pixel', g.data.length, 935 * 1210);
  const at = (x, y) => g.data[y * g.w + x];
  T('the centre of the mark is ink', at(mx0 + (mw >> 1), my0 + (mh >> 1)) < 128);
  T('40 px above the mark is paper', at(mx0 + (mw >> 1), my0 - 40) > 200);
  T('40 px below the mark is paper', at(mx0 + (mw >> 1), my0 + mh + 40) > 200);
  T('40 px left of the mark is paper', at(mx0 - 40, my0 + (mh >> 1)) > 200);
  T('the far corner is paper', at(900, 1180) > 200);
  T('the MIRROR of the mark about the page centre is paper (the flip is not upside down)',
    at(mx0 + (mw >> 1), g.h - (my0 + (mh >> 1))) > 200);

  /* ---- PNM parsing ---- */
  console.log('\n-- PNM --');
  const p5 = L.readPNM(Buffer.concat([Buffer.from('P5\n2 2\n255\n', 'ascii'), Buffer.from([1, 2, 3, 4])]));
  eq('P5 header', [p5.w, p5.h, p5.chan], [2, 2, 1]);
  eq('P5 pixels', Array.from(p5.data), [1, 2, 3, 4]);
  const p6 = L.readPNM(Buffer.concat([Buffer.from('P6\n# a comment\n1 2\n255\n', 'ascii'), Buffer.from([1, 2, 3, 4, 5, 6])]));
  eq('P6 with a comment', [p6.w, p6.h, p6.chan, p6.data.length], [1, 2, 3, 6]);
  throws('a non-PNM is refused', () => L.readPNM(Buffer.from('hello')), /not a PNM/);
  throws('a P3 ASCII PNM is refused rather than misread', () => L.readPNM(Buffer.from('P3\n1 1\n255\n0 0 0')), /unsupported PNM/);
  throws('a truncated PNM is refused', () => L.readPNM(Buffer.concat([Buffer.from('P5\n4 4\n255\n'), Buffer.from([1, 2])])), /truncated/);

  /* ---- the PNG encoder, checked by a reader that does not share its code -- */
  console.log('\n-- the dependency-free PNG writer --');
  const W = 7, H = 5;
  const rgb = new Uint8Array(W * H * 3);
  for (let i = 0; i < W * H; i++) { rgb[i * 3] = i * 3 & 255; rgb[i * 3 + 1] = 200; rgb[i * 3 + 2] = 255 - (i & 255); }
  const pngPath = L.writePNG(path.join(TMP, 'enc.png'), { w: W, h: H, rgb });
  const dec = readPNGref(pngPath);
  eq('IHDR width survives', dec.w, W);
  eq('IHDR height survives', dec.h, H);
  eq('8-bit truecolour', [dec.depth, dec.color], [8, 2]);
  eq('the chunk order is IHDR, IDAT, IEND', dec.chunks, ['IHDR', 'IDAT', 'IEND']);
  eq('every pixel round-trips byte for byte', Buffer.compare(dec.rgb, Buffer.from(rgb)), 0);
  eq('look.js reads back its own IHDR', L.pngSize(pngPath), { width: W, height: H });
  throws('a wrong-sized buffer is refused, not silently padded',
    () => L.writePNG(path.join(TMP, 'bad.png'), { w: 2, h: 2, rgb: new Uint8Array(5) }), /rgb is 5 bytes/);

  /* ---- diffGray, on rasters we construct ---- */
  console.log('\n-- diffGray --');
  const mk = (w, h, fn) => { const d = new Uint8Array(w * h).fill(255); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (fn(x, y)) d[y * w + x] = 0; return { w, h, data: d }; };
  const flat = mk(64, 64, () => false);
  eq('a raster against itself: no differing pixels', R.diffGray(flat, flat).diffPixels, 0);
  eq('and no regions', R.diffGray(flat, flat).regions.length, 0);
  const oneBox = mk(64, 64, (x, y) => x >= 10 && x < 20 && y >= 30 && y < 40);
  const d1 = R.diffGray(flat, oneBox);
  eq('one 10x10 block differs in 100 pixels', d1.diffPixels, 100);
  eq('reported as one region', d1.regions.length, 1);
  eq('with the exact bbox', [d1.regions[0].x, d1.regions[0].y, d1.regions[0].w, d1.regions[0].h], [10, 30, 10, 10]);
  eq('ink appeared on the B side only', [d1.regions[0].inkA, d1.regions[0].inkB], [0, 100]);
  eq('and the delta is full contrast', d1.regions[0].maxDelta, 255);
  const d1r = R.diffGray(oneBox, flat);
  eq('reversing the arguments reverses the ink verdict', [d1r.regions[0].inkA, d1r.regions[0].inkB], [100, 0]);

  const twoFar = mk(64, 64, (x, y) => (x < 4 && y < 4) || (x >= 58 && y >= 58));
  eq('two marks at opposite corners stay two regions', R.diffGray(flat, twoFar).regions.length, 2);
  const twoNear = mk(64, 64, (x, y) => y >= 10 && y < 14 && ((x >= 10 && x < 14) || (x >= 18 && x < 22)));
  eq('two marks 4 px apart merge into one region', R.diffGray(flat, twoNear).regions.length, 1);
  eq('and the merged bbox spans both', R.diffGray(flat, twoNear).regions[0].w, 12);

  const faint = { w: 64, h: 64, data: new Uint8Array(64 * 64).fill(245) };
  eq('a 10/255 shift is below the default threshold', R.diffGray(flat, faint).diffPixels, 0);
  eq('and is found when the threshold is lowered', R.diffGray(flat, faint, { threshold: 5 }).diffPixels, 64 * 64);
  const speck = mk(64, 64, (x, y) => x === 5 && y === 5);
  eq('a single-pixel speck is dropped by --min-region', R.diffGray(flat, speck).regions.length, 0);
  eq('but its pixel is still counted', R.diffGray(flat, speck).diffPixels, 1);
  eq('and it is reported as dropped, not hidden', R.diffGray(flat, speck).droppedRegions, 1);
  eq('--min-region 1 keeps it', R.diffGray(flat, speck, { minRegion: 1 }).regions.length, 1);
  throws('rasters of different sizes are refused', () => R.diffGray(flat, mk(32, 32, () => false)), /sizes differ/);

  /* ---- where on the page, in words ---- */
  console.log('\n-- zone naming --');
  eq('top-left corner', R.zoneOf({ x: 0, y: 0, w: 10, h: 10 }, 1000, 1000), 'top left edge');
  eq('dead centre', R.zoneOf({ x: 495, y: 495, w: 10, h: 10 }, 1000, 1000), 'middle centre');
  eq('bottom-right corner', R.zoneOf({ x: 990, y: 990, w: 10, h: 10 }, 1000, 1000), 'bottom right edge');
  T('the summary names the zone and gives points',
    /middle centre/.test(R.describe({ x: 495, y: 495, w: 10, h: 10, pixels: 100, meanDelta: 200, maxDelta: 255, inkA: 0, inkB: 100 }, 1000, 1000, 110)));
  T('and says outright when marks appeared rather than moved',
    /PRINTED that A did not/.test(R.describe({ x: 1, y: 1, w: 10, h: 10, pixels: 100, meanDelta: 200, maxDelta: 255, inkA: 0, inkB: 100 }, 1000, 1000, 110)));
  T('and when they are missing',
    /MISSING/.test(R.describe({ x: 1, y: 1, w: 10, h: 10, pixels: 100, meanDelta: 200, maxDelta: 255, inkA: 100, inkB: 0 }, 1000, 1000, 110)));

  /* ---- rdiff end to end, on real renderings ---- */
  console.log('\n-- rdiff: a file against itself --');
  const same = R.renderDiff(BASE, BASE, { dpi, out: path.join(TMP, 'd0') });
  eq('same file, same page count', [same.pagesA, same.pagesB], [1, 1]);
  T('reported comparable', same.comparable);
  T('reported identical', same.identical);
  eq('zero differing pixels', same.totalDiffPixels, 0);
  eq('and zero regions', same.pages[0].regions.length, 0);
  eq('no diff image is written when there is nothing to look at', same.pages[0].image, null);

  console.log('\n-- rdiff: a deliberate alteration, in the RIGHT PLACE --');
  const diff = R.renderDiff(BASE, ALTERED, { dpi, out: path.join(TMP, 'd1') });
  T('reported different', !diff.identical);
  eq('exactly one region', diff.pages[0].regions.length, 1);
  const rg = diff.pages[0].regions[0];
  /* The whole instrument rests on this: the added rectangle is at 400,150 in
     PDF points from the BOTTOM-left, 60x40. At 110 dpi with the origin flipped
     that is x 611..702, y 919..980 from the TOP-left. If the box lands anywhere
     else, the tool sends a reviewer to the wrong cell. */
  near('region x is where 400 pt lands', rg.x, Math.round(px(ADD.x, dpi)), 2);
  near('region y is where the FLIPPED 150 pt lands', rg.y, Math.round(px(topY(ADD), dpi)), 2);
  near('region width is 60 pt of pixels', rg.w, Math.round(px(ADD.w, dpi)), 2);
  near('region height is 40 pt of pixels', rg.h, Math.round(px(ADD.h, dpi)), 2);
  near('differing pixel count matches the rectangle area', rg.pixels, Math.round(px(ADD.w, dpi) * px(ADD.h, dpi)), 400);
  eq('the region says the ink is new, not moved', rg.inkA, 0);
  T('and that B has it', rg.inkB > 5000);
  T('it names where on the page it falls', /lower-middle/.test(rg.where));
  T('a diff image was written', !!diff.pages[0].image && fs.existsSync(diff.pages[0].image));
  const comp = readPNGref(diff.pages[0].image);
  eq('the diff image is the two renders side by side', comp.w, 935 * 2 + 12);
  eq('and full page height', comp.h, 1210);
  /* the unchanged mark must NOT be outlined — a diff that highlights
     everything highlights nothing */
  T('the untouched mark is outside every reported region',
    !diff.pages[0].regions.some(r => mx0 >= r.x - 4 && mx0 <= r.x + r.w + 4 && my0 >= r.y - 4 && my0 <= r.y + r.h + 4));

  console.log('\n-- rdiff: things that are not comparable --');
  const pc = R.renderDiff(BASE, TWOPAGE, { dpi, out: path.join(TMP, 'd2') });
  T('a page-count mismatch does not throw', true);
  T('it is reported not comparable', !pc.comparable);
  T('and says so in words', /page counts differ/.test(pc.notes.join(' ')));
  eq('the common page is still diffed', pc.pages.length, 1);
  eq('and that page matched', pc.pages[0].diffPixels, 0);
  T('the run as a whole is not called identical', !pc.identical);

  const ps = R.renderDiff(BASE, TALL, { dpi, out: path.join(TMP, 'd3') });
  T('a page-size mismatch does not throw', true);
  T('the page is marked not comparable', !ps.pages[0].comparable);
  T('and says so rather than diffing nonsense', /sizes differ/.test(ps.pages[0].note));
  T('the run is not called identical', !ps.identical);

  /* ---- the CLIs. Captured rather than let loose on the console: a suite that
         floods the terminal with its own fixtures' JSON is a suite nobody
         reads the verdict of. Capturing also lets the OUTPUT be asserted,
         which is the part a human actually consumes. ---- */
  console.log('\n-- the command lines --');
  function capture(fn) {
    const o = process.stdout.write, e = process.stderr.write;
    let out = '', err = '';
    process.stdout.write = c => { out += c; return true; };
    process.stderr.write = c => { err += c; return true; };
    let code; try { code = fn(); } finally { process.stdout.write = o; process.stderr.write = e; }
    return { code, out, err };
  }
  let c;
  c = capture(() => L.main(['--help']));
  eq('look --help exits 0', c.code, 0);
  T('and prints the usage', /usage: node look\.js/.test(c.out));
  c = capture(() => L.main([]));
  eq('look with no file is a usage error', c.code, 2);
  T('and says so on stderr, not stdout', /no PDF given/.test(c.err) && c.out === '');
  eq('look with an unknown flag is a usage error', capture(() => L.main(['x.pdf', '--nope'])).code, 2);
  c = capture(() => L.main([path.join(TMP, 'nope.pdf'), '--out', path.join(TMP, 'x')]));
  eq('look on a missing file exits 1', c.code, 1);
  T('and names the file it could not find', /no such file/.test(c.err));

  c = capture(() => L.main([TWOPAGE, '--pages', '1-2', '--dpi', '110', '--out', path.join(TMP, 'cli1')]));
  eq('look on a real file exits 0', c.code, 0);
  T('it states the page count and page size', /2 pages, 612 x 792 pts @ 110 dpi/.test(c.out));
  T('it prints one absolute path per page', c.out.split('\n').filter(l => /\/.*\.png$/.test(l.trim())).length === 2);
  T('with the pixel dimensions beside each', /935x1210 px/.test(c.out));
  for (const line of c.out.split('\n')) {
    const m = /(\/\S+\.png)$/.exec(line.trim());
    if (m) { n++; if (fs.existsSync(m[1])) console.log('  + the path it printed is openable: ' + path.basename(m[1])); else fail('printed a path that does not exist: ' + m[1]); }
  }
  c = capture(() => L.main([BASE, '--dpi', '110', '--out', path.join(TMP, 'cli2'), '--json']));
  const man = JSON.parse(c.out);
  eq('--json gives a manifest with the dpi', man.dpi, 110);
  eq('and the file list', man.files.length, 1);

  eq('rdiff --help exits 0', capture(() => R.main(['--help'])).code, 0);
  eq('rdiff with one file is a usage error', capture(() => R.main([BASE])).code, 2);
  c = capture(() => R.main([BASE, BASE, '--out', path.join(TMP, 'c0')]));
  eq('rdiff of a file with itself exits 0', c.code, 0);
  T('and the LAST line is the verdict, so a pipe still shows it',
    /^IDENTICAL/.test(c.out.trim().split('\n').pop()));
  c = capture(() => R.main([BASE, ALTERED, '--out', path.join(TMP, 'c1')]));
  eq('rdiff of two different files exits 1', c.code, 1);
  T('the verdict is the last line here too', /^DIFFERENT/.test(c.out.trim().split('\n').pop()));
  T('and it points at an image to look at', /look at: \//.test(c.out));
  c = capture(() => R.main([BASE, TALL, '--out', path.join(TMP, 'c2'), '--json']));
  eq('rdiff of incomparable files exits 4', c.code, 4);
  T('the JSON says which page could not be compared', JSON.parse(c.out).pages[0].comparable === false);
  c = capture(() => R.main([BASE, TWOPAGE, '--out', path.join(TMP, 'c3')]));
  eq('a page-count mismatch also exits 4', c.code, 4);
  T('and the mismatch is stated before the verdict', /! page counts differ/.test(c.out));

  /* ---- no rasteriser: LOUD, non-zero, never a silent pass ---- */
  console.log('\n-- a missing rasteriser --');
  const noPath = { PATH: path.join(TMP, 'no-such-bin'), HOME: process.env.HOME || '/tmp' };
  for (const [name, tool, args] of [['look', LOOK, [BASE]], ['rdiff', RDIFF, [BASE, BASE]]]) {
    const r = spawnSync(process.execPath, [tool, ...args], { env: noPath, encoding: 'utf8' });
    eq(name + ' exits 3 when pdftoppm is gone', r.status, 3);
    T(name + ' says so on stderr, loudly', /NO PDF RASTERIZER/.test(r.stderr));
    T(name + ' does not print a path as if it rendered something', !/\.png/.test(r.stdout || ''));
  }

  /* ---- the real artefact: HUD-92458 as this project ships it ---- */
  console.log('\n-- the shipped HUD-92458 template --');
  global.window = global.window || {};
  new Function('window', fs.readFileSync(D + 'templates.js', 'utf8'))(global.window);
  const tplPdf = write('tpl-rs.pdf', Buffer.from(global.window.RCSTemplates.rentSchedule, 'base64'));
  const ti = L.pageInfo(tplPdf);
  eq('the shipped rent-schedule template is 3 pages', ti.pages, 3);
  eq('US letter', ti.sizes[0], { w: 612, h: 792 });
  const tr = L.rasterize({ pdf: tplPdf, pages: 'all', dpi: 110, out: path.join(TMP, 'tpl') });
  eq('all three render', tr.length, 3);
  eq('each at 935x1210', tr.map(f => f.width + 'x' + f.height), ['935x1210', '935x1210', '935x1210']);
  for (const p of [1, 2, 3]) {
    const gp = L.renderGray(tplPdf, p, 110);
    let ink = 0; for (let i = 0; i < gp.data.length; i++) if (gp.data[i] < 128) ink++;
    T('page ' + p + ' has ink on it (' + ink + ' dark px) - it is not a blank render', ink > 3000);
  }
  T('the template renders identically to itself', R.renderDiff(tplPdf, tplPdf, { dpi: 110, out: path.join(TMP, 'tplself') }).identical);

} catch (e) { fail('the suite threw', e); }
finish();
