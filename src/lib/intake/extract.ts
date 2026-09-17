/**
 * Turn a dropped report into plain text — entirely in the browser, so the
 * document never leaves the analyst's machine.
 *
 *   .txt/.md/.log/.csv/.json  read as-is
 *   .docx                     unzip word/document.xml and strip the XML
 *   .pdf                      inflate the content streams and read the text operators
 *
 * PDFs that hold scanned images (no text layer) can't be read — the caller gets
 * a warning and can paste the text instead.
 */
import type { IntakeMeta } from '@/types';

export type IntakeFileType = NonNullable<IntakeMeta['fileType']>;

export interface Extracted {
  text: string;
  type: IntakeFileType;
  fileName?: string;
  warnings: string[];
}

const TEXT_EXT = ['txt', 'md', 'markdown', 'log', 'csv', 'json', 'yml', 'yaml', 'text'];
export const ACCEPTED_EXT = ['txt', 'md', 'pdf', 'docx', 'log', 'csv', 'json'];
export const ACCEPT_ATTR = '.txt,.md,.markdown,.pdf,.docx,.log,.csv,.json,text/plain,application/pdf';

export function fileExt(name: string): string {
  return name.split('.').pop()?.toLowerCase() ?? '';
}

export async function extractText(file: File): Promise<Extracted> {
  const ext = fileExt(file.name);
  const warnings: string[] = [];

  if (ext === 'docx') {
    const text = await docxToText(await file.arrayBuffer(), warnings);
    return { text, type: 'docx', fileName: file.name, warnings };
  }
  if (ext === 'pdf') {
    const text = await pdfToText(await file.arrayBuffer(), warnings);
    return { text, type: 'pdf', fileName: file.name, warnings };
  }
  if (ext === 'doc') {
    warnings.push('Old .doc files can’t be read — save it as .docx, or paste the text.');
    return { text: '', type: 'docx', fileName: file.name, warnings };
  }
  if (!TEXT_EXT.includes(ext)) warnings.push(`Read "${file.name}" as plain text — drop a .md, .txt, .pdf or .docx for the best results.`);
  const text = await file.text();
  return { text, type: ext === 'md' || ext === 'markdown' ? 'md' : 'txt', fileName: file.name, warnings };
}

/** Printable characters, used to judge whether an extraction actually worked. */
function readableChars(s: string): number {
  return (s.match(/[A-Za-z0-9]/g) ?? []).length;
}

// ---------------------------------------------------------------- shared codecs

const latin1 = (b: Uint8Array) => {
  let s = '';
  for (let i = 0; i < b.length; i += 8192) s += String.fromCharCode(...b.subarray(i, i + 8192));
  return s;
};

async function inflate(bytes: Uint8Array, format: 'deflate' | 'deflate-raw'): Promise<Uint8Array | null> {
  if (typeof DecompressionStream === 'undefined') return null;
  try {
    const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream(format));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  } catch { return null; }
}

function decodeXmlEntities(s: string): string {
  return s
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_m, d) => String.fromCharCode(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_m, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&amp;/g, '&');
}

// ---------------------------------------------------------------------- docx

/** Minimal zip reader: pull one entry out of a zip archive by name. */
async function unzipEntry(buf: ArrayBuffer, wanted: string): Promise<Uint8Array | null> {
  const bytes = new Uint8Array(buf);
  const raw = latin1(bytes);
  const eocd = raw.lastIndexOf('PK\x05\x06');
  if (eocd < 0) return null;
  const view = new DataView(buf);
  const count = view.getUint16(eocd + 10, true);
  let p = view.getUint32(eocd + 16, true);
  for (let i = 0; i < count && p + 46 <= bytes.length; i++) {
    if (raw.slice(p, p + 4) !== 'PK\x01\x02') break;
    const method = view.getUint16(p + 10, true);
    const compressed = view.getUint32(p + 20, true);
    const nameLen = view.getUint16(p + 28, true);
    const extraLen = view.getUint16(p + 30, true);
    const commentLen = view.getUint16(p + 32, true);
    const localOffset = view.getUint32(p + 42, true);
    const name = raw.slice(p + 46, p + 46 + nameLen);
    if (name === wanted) {
      const lNameLen = view.getUint16(localOffset + 26, true);
      const lExtraLen = view.getUint16(localOffset + 28, true);
      const start = localOffset + 30 + lNameLen + lExtraLen;
      const data = bytes.subarray(start, start + compressed);
      if (method === 0) return data;
      if (method === 8) return await inflate(data, 'deflate-raw');
      return null;
    }
    p += 46 + nameLen + extraLen + commentLen;
  }
  return null;
}

async function docxToText(buf: ArrayBuffer, warnings: string[]): Promise<string> {
  const entry = await unzipEntry(buf, 'word/document.xml');
  if (!entry) {
    warnings.push('Couldn’t unpack this .docx — paste the text instead.');
    return '';
  }
  const xml = new TextDecoder('utf-8').decode(entry);
  const paragraphs: string[] = [];
  for (const p of xml.split(/<w:p[\s>]/).slice(1)) {
    const heading = p.match(/<w:pStyle[^>]*w:val="Heading(\d)"/);
    const listed = /<w:numPr[\s>]/.test(p);
    const runs = [...p.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)].map((m) => decodeXmlEntities(m[1]));
    let text = runs.join('').replace(/<w:tab\/>/g, '\t').trim();
    if (!text) { paragraphs.push(''); continue; }
    if (heading) text = `${'#'.repeat(Math.min(6, Number(heading[1]) + 1))} ${text}`;
    else if (listed) text = `- ${text}`;
    paragraphs.push(text);
  }
  const text = paragraphs.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  if (readableChars(text) < 20) warnings.push('This .docx looks empty — paste the text instead.');
  return text;
}

// ----------------------------------------------------------------------- pdf

/** Streams that never hold page text — skipping them keeps binary out of the result. */
const NON_TEXT_STREAM = /\/Subtype\s*\/Image|\/FontFile\d?|\/ObjStm|\/Metadata|\/XRef|\/EmbeddedFile/;

interface PdfObject { dict: string; start: number; end: number; hasStream: boolean }
/** code → text, plus how many bytes make up one code (1 for simple fonts, 2 for CID fonts). */
interface CMap { codeSize: number; map: Map<number, string> }

/** Index every `N 0 obj … endobj` so streams can be resolved by object number. */
function parseObjects(raw: string, bytes: Uint8Array): Map<number, PdfObject> {
  const objs = new Map<number, PdfObject>();
  const re = /(\d+)\s+\d+\s+obj\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw))) {
    const bodyStart = m.index + m[0].length;
    const objEnd = raw.indexOf('endobj', bodyStart);
    const body = raw.slice(bodyStart, objEnd < 0 ? raw.length : objEnd);
    const kw = body.search(/\bstream\r?\n?/);
    if (kw < 0) {
      objs.set(Number(m[1]), { dict: body, start: 0, end: 0, hasStream: false });
      if (objEnd > 0) re.lastIndex = objEnd;
      continue;
    }
    const kwAbs = bodyStart + kw;
    const dict = raw.slice(bodyStart, kwAbs);
    const dataStart = kwAbs + (raw.slice(kwAbs, kwAbs + 8).match(/^stream\r?\n?/)?.[0].length ?? 6);
    const close = raw.indexOf('endstream', dataStart);
    if (close < 0) break;
    const declared = Number(dict.match(/\/Length\s+(\d+)\s*(?:\/|>>)/)?.[1] ?? NaN);
    const end = Number.isFinite(declared) && dataStart + declared <= close + 2 ? dataStart + declared : trimTrailingEol(bytes, close);
    objs.set(Number(m[1]), { dict, start: dataStart, end, hasStream: true });
    re.lastIndex = close + 'endstream'.length;
  }
  return objs;
}

/** ASCII85 (as ReportLab and friends emit it) → bytes. */
function ascii85Decode(input: string): Uint8Array | null {
  const body = input.replace(/^<~/, '').replace(/~>[\s\S]*$/, '').replace(/\s+/g, '');
  const out: number[] = [];
  let group: number[] = [];
  for (const ch of body) {
    if (ch === 'z' && !group.length) { out.push(0, 0, 0, 0); continue; }
    const v = ch.charCodeAt(0) - 33;
    if (v < 0 || v > 84) return null;
    group.push(v);
    if (group.length === 5) {
      let n = 0;
      for (const g of group) n = n * 85 + g;
      out.push((n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255);
      group = [];
    }
  }
  if (group.length) {
    const missing = 5 - group.length;
    let n = 0;
    for (const g of [...group, ...Array(missing).fill(84)]) n = n * 85 + g;
    const full = [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
    out.push(...full.slice(0, 4 - missing));
  }
  return new Uint8Array(out);
}

function asciiHexDecode(input: string): Uint8Array {
  const clean = input.replace(/[^0-9A-Fa-f]/g, '');
  const out = new Uint8Array(Math.floor(clean.length / 2));
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  return out;
}

/** Run a stream through its /Filter chain. Returns null for filters we can't read (images, LZW). */
async function streamText(obj: PdfObject | undefined, bytes: Uint8Array): Promise<string | null> {
  if (!obj?.hasStream) return null;
  let data: Uint8Array | null = bytes.subarray(obj.start, obj.end);
  if (data.length < 2 || data.length > 12_000_000) return null;
  const filters = [...(obj.dict.match(/\/Filter\s*(\[[^\]]*\]|\/[A-Za-z0-9]+)/)?.[1] ?? '').matchAll(/\/([A-Za-z0-9]+)/g)].map((m) => m[1]);
  for (const filter of filters) {
    if (!data) return null;
    switch (filter) {
      case 'FlateDecode': data = await inflate(data, 'deflate'); break;
      case 'ASCII85Decode': data = ascii85Decode(latin1(data)); break;
      case 'ASCIIHexDecode': data = asciiHexDecode(latin1(data)); break;
      default: return null;
    }
  }
  return data ? latin1(data) : null;
}

/** UTF-16BE hex (as CMap destinations are written) → string. */
function hexToUnicode(hex: string): string {
  const clean = hex.replace(/[^0-9A-Fa-f]/g, '');
  if (clean.length === 2) return String.fromCharCode(parseInt(clean, 16));
  let out = '';
  for (let i = 0; i + 4 <= clean.length; i += 4) out += String.fromCharCode(parseInt(clean.slice(i, i + 4), 16));
  return out;
}

/** Parse a /ToUnicode CMap — this is what makes subset-font PDFs readable. */
function parseCMap(cmap: string): CMap {
  const map = new Map<number, string>();
  let codeSize = 1;
  for (const block of cmap.match(/beginbfchar([\s\S]*?)endbfchar/g) ?? []) {
    for (const pair of block.matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g)) {
      codeSize = Math.max(codeSize, Math.ceil(pair[1].length / 2));
      map.set(parseInt(pair[1], 16), hexToUnicode(pair[2]));
    }
  }
  for (const block of cmap.match(/beginbfrange([\s\S]*?)endbfrange/g) ?? []) {
    for (const row of block.matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*(\[[\s\S]*?\]|<[0-9A-Fa-f]+>)/g)) {
      const lo = parseInt(row[1], 16);
      const hi = parseInt(row[2], 16);
      codeSize = Math.max(codeSize, Math.ceil(row[1].length / 2));
      if (hi < lo || hi - lo > 65_535) continue;
      if (row[3].startsWith('[')) {
        [...row[3].matchAll(/<([0-9A-Fa-f]+)>/g)].forEach((x, i) => map.set(lo + i, hexToUnicode(x[1])));
      } else {
        const base = hexToUnicode(row[3]);
        const tail = base.charCodeAt(base.length - 1);
        for (let c = lo; c <= hi; c++) map.set(c, base.slice(0, -1) + String.fromCharCode(tail + (c - lo)));
      }
    }
  }
  return { codeSize, map };
}

async function pdfToText(buf: ArrayBuffer, warnings: string[]): Promise<string> {
  const bytes = new Uint8Array(buf);
  const raw = latin1(bytes);
  const objs = parseObjects(raw, bytes);
  const refs = (s?: string) => [...(s ?? '').matchAll(/(\d+)\s+\d+\s+R/g)].map((m) => Number(m[1]));

  const cmapCache = new Map<number, CMap | null>();
  const cmapFor = async (fontNum: number): Promise<CMap | null> => {
    if (cmapCache.has(fontNum)) return cmapCache.get(fontNum)!;
    cmapCache.set(fontNum, null); // guard against cycles
    const font = objs.get(fontNum);
    let result: CMap | null = null;
    const toUnicode = refs(font?.dict.match(/\/ToUnicode\s+(\d+\s+\d+\s+R)/)?.[1])[0];
    if (toUnicode !== undefined) {
      const body = await streamText(objs.get(toUnicode), bytes);
      if (body) result = parseCMap(body);
    }
    if (!result) {
      for (const child of refs(font?.dict.match(/\/DescendantFonts\s*\[?([^\]]*)\]?/)?.[1])) {
        const nested = await cmapFor(child);
        if (nested) { result = nested; break; }
      }
    }
    cmapCache.set(fontNum, result);
    return result;
  };

  const dictOf = (num?: number) => (num === undefined ? '' : objs.get(num)?.dict ?? '');
  const pieces: string[] = [];
  const done = new Set<number>();

  for (const [, page] of objs) {
    if (!/\/Type\s*\/Page\b/.test(page.dict)) continue;
    const resources = /\/Resources\s*<</.test(page.dict)
      ? page.dict.slice(page.dict.indexOf('/Resources'))
      : dictOf(refs(page.dict.match(/\/Resources\s+(\d+\s+\d+\s+R)/)?.[1])[0]);
    const fontBlock = resources.match(/\/Font\s*<<([\s\S]*?)>>/)?.[1]
      ?? dictOf(refs(resources.match(/\/Font\s+(\d+\s+\d+\s+R)/)?.[1])[0]);
    const fonts = new Map<string, CMap | null>();
    for (const f of (fontBlock ?? '').matchAll(/\/([A-Za-z0-9_.+-]+)\s+(\d+)\s+\d+\s+R/g)) fonts.set(f[1], await cmapFor(Number(f[2])));

    for (const contentNum of refs(page.dict.match(/\/Contents\s*(\[[^\]]*\]|\d+\s+\d+\s+R)/)?.[1])) {
      if (done.has(contentNum)) continue;
      done.add(contentNum);
      const content = await streamText(objs.get(contentNum), bytes);
      if (content) pieces.push(pdfContentToText(content, fonts));
    }
  }

  // No page tree we could follow: fall back to reading every stream that shows text.
  if (!pieces.length) {
    for (const [num, obj] of objs) {
      if (done.has(num) || NON_TEXT_STREAM.test(obj.dict)) continue;
      const content = await streamText(obj, bytes);
      if (content && /\bT[Jj]\b/.test(content)) pieces.push(pdfContentToText(content, new Map()));
    }
  }

  const text = pieces.join('\n\n')
    .split('\n').filter(looksLikeText).join('\n')
    .replace(/[ \t]{2,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  if ((text.match(/[A-Za-z]{3,}/g) ?? []).length < 15) {
    warnings.push('Couldn’t read text from this PDF (it may be a scan, or use fonts with no text mapping) — paste the text instead.');
    return '';
  }
  return text;
}

/** Guard against fonts with custom encodings turning into line noise. */
function looksLikeText(line: string): boolean {
  if (!line) return true;
  const printable = (line.match(/[\x20-\x7e]/g) ?? []).length / line.length;
  if (printable < 0.85 || !/[A-Za-z]{3,}/.test(line)) return false;
  // Short strings dense in symbols are decorative glyphs, not words.
  return line.length >= 12 || (line.match(/[^A-Za-z0-9\s.,:;()/-]/g) ?? []).length < 3;
}

function trimTrailingEol(bytes: Uint8Array, end: number): number {
  let e = end;
  while (e > 0 && (bytes[e - 1] === 0x0a || bytes[e - 1] === 0x0d)) e--;
  return e;
}

const OCTAL_ESCAPE: Record<string, string> = { n: '\n', r: '\n', t: '\t', b: '', f: '', '(': '(', ')': ')', '\\': '\\' };

/** Read a PDF literal string starting at `i` (which points at the opening paren). */
function readPdfString(s: string, i: number): { text: string; next: number } {
  let depth = 0;
  let out = '';
  let p = i;
  for (; p < s.length; p++) {
    const c = s[p];
    if (c === '\\') {
      const n = s[p + 1];
      if (n >= '0' && n <= '7') {
        let oct = '';
        while (oct.length < 3 && s[p + 1] >= '0' && s[p + 1] <= '7') { oct += s[p + 1]; p++; }
        out += String.fromCharCode(parseInt(oct, 8));
      } else if (n === '\n' || n === '\r') { p++; }
      else { out += OCTAL_ESCAPE[n] ?? n; p++; }
      continue;
    }
    if (c === '(') { depth++; if (depth > 1) out += c; continue; }
    if (c === ')') { depth--; if (depth === 0) { p++; break; } out += c; continue; }
    out += c;
  }
  return { text: out, next: p };
}

/** Decode a shown string: through the font's CMap when there is one, else as Latin-1. */
function decodeShown(chars: number[], cmap: CMap | null | undefined): string {
  if (!cmap || !cmap.map.size) {
    return chars.map((c) => (c >= 32 && c < 127 ? String.fromCharCode(c) : c === 9 || c === 10 ? ' ' : '')).join('');
  }
  const codes: number[] = [];
  if (cmap.codeSize === 2) for (let i = 0; i + 1 < chars.length; i += 2) codes.push((chars[i] << 8) | chars[i + 1]);
  else codes.push(...chars);
  let mapped = 0;
  let out = '';
  for (const code of codes) {
    const text = cmap.map.get(code);
    if (text !== undefined) { out += text; mapped++; }
    else if (code >= 32 && code < 127) out += String.fromCharCode(code);
  }
  // A mapping that explains almost nothing is worse than the raw bytes — but only keep
  // those bytes if they read as words, so decorative glyph runs don't become line noise.
  if (codes.length > 3 && mapped / codes.length < 0.5) {
    const raw = decodeShown(chars, null);
    return /[A-Za-z]{3,}/.test(raw) ? raw : '';
  }
  return out;
}

const codesOfHex = (hex: string): number[] => {
  const clean = hex.replace(/[^0-9A-Fa-f]/g, '');
  const out: number[] = [];
  for (let i = 0; i + 1 < clean.length; i += 2) out.push(parseInt(clean.slice(i, i + 2), 16));
  return out;
};
const codesOfString = (s: string): number[] => [...s].map((c) => c.charCodeAt(0));

type Matrix = readonly [number, number, number, number, number, number];
const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];

/** Rough per-glyph advance in ems — enough to tell a word gap from ordinary kerning. */
function emWidth(text: string): number {
  let em = 0;
  for (const ch of text) {
    if (/[ .,;:'`|!ijltI()[\]]/.test(ch)) em += 0.3;
    else if (/[mMW@]/.test(ch)) em += 0.9;
    else if (/[A-Z0-9&%$#]/.test(ch)) em += 0.68;
    else em += 0.52;
  }
  return em;
}

function mul(m: Matrix, n: Matrix): Matrix {
  return [
    m[0] * n[0] + m[1] * n[2], m[0] * n[1] + m[1] * n[3],
    m[2] * n[0] + m[3] * n[2], m[2] * n[1] + m[3] * n[3],
    m[4] * n[0] + m[5] * n[2] + n[4], m[4] * n[1] + m[5] * n[3] + n[5],
  ];
}

/**
 * Pull the shown text out of a PDF content stream.
 *
 * Line breaks come from where the text is actually placed on the page, not from the
 * positioning operators themselves: producers like the Google Docs renderer emit one
 * `Tj` per glyph, each preceded by a `Td`, so breaking on every operator would put
 * every character on its own line.
 */
function pdfContentToText(s: string, fonts: Map<string, CMap | null>): string {
  const lines: string[] = [];
  let line = '';
  let ctm: Matrix = IDENTITY;
  const ctmStack: Matrix[] = [];
  let tm: Matrix = IDENTITY;
  let tlm: Matrix = IDENTITY;
  let leading = 0;
  let fontSize = 1;
  let font: CMap | null | undefined;
  let lastName = '';
  let nums: number[] = [];
  let pending = '';
  let gapBefore = 0; // kerning from a TJ array, in thousandths of an em
  let pen: { x: number; y: number; size: number } | null = null;

  const flush = () => { lines.push(line); line = ''; };
  const show = (text: string) => {
    if (!text) return;
    const [a, b, c, d, x, y] = mul(tm, ctm);
    const xScale = Math.hypot(a, b) || 1;
    const size = fontSize * (Math.hypot(c, d) || 1);
    const width = emWidth(text) * fontSize * xScale; // no glyph metrics: estimate from the characters
    if (pen) {
      // A vertical shift, or a carriage return to the left of where we were, starts a line.
      if (Math.abs(y - pen.y) > Math.max(0.5, size * 0.3) || x < pen.x - size) flush();
      else if (x - pen.x > size * 0.3) line += ' ';
    }
    line += text;
    pen = { x: x + width, y, size };
  };
  const nextLine = (tx: number, ty: number) => { tlm = mul([1, 0, 0, 1, tx, ty], tlm); tm = tlm; };

  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === '(') {
      const r = readPdfString(s, i);
      if (gapBefore <= -180) pending += ' ';
      gapBefore = 0;
      pending += decodeShown(codesOfString(r.text), font);
      i = r.next;
      continue;
    }
    if (c === '<' && s[i + 1] !== '<') {
      const end = s.indexOf('>', i);
      if (end < 0) break;
      if (gapBefore <= -180) pending += ' ';
      gapBefore = 0;
      pending += decodeShown(codesOfHex(s.slice(i + 1, end)), font);
      i = end + 1;
      continue;
    }
    if (c === '/') {
      let j = i + 1;
      while (j < s.length && /[A-Za-z0-9_.+-]/.test(s[j])) j++;
      lastName = s.slice(i + 1, j);
      i = j;
      continue;
    }
    if (c === '%') { const nl = s.indexOf('\n', i); i = nl < 0 ? s.length : nl + 1; continue; }
    if (c === '-' || c === '+' || c === '.' || (c >= '0' && c <= '9')) {
      let j = i + 1;
      while (j < s.length && /[0-9.eE+-]/.test(s[j])) j++;
      const n = Number(s.slice(i, j));
      if (Number.isFinite(n)) { nums.push(n); gapBefore = n; }
      i = j;
      continue;
    }
    if (/[A-Za-z'"]/.test(c)) {
      let j = i + 1;
      while (j < s.length && /[A-Za-z0-9*'"]/.test(s[j])) j++;
      const op = s.slice(i, j);
      const n = nums;
      switch (op) {
        case 'BI': { // inline image: its binary data must not be scanned as operators
          const ei = s.indexOf('EI', i);
          i = ei < 0 ? s.length : ei + 2;
          nums = [];
          continue;
        }
        case 'q': ctmStack.push(ctm); break;
        case 'Q': ctm = ctmStack.pop() ?? IDENTITY; break;
        case 'cm': if (n.length >= 6) ctm = mul(n.slice(-6) as unknown as Matrix, ctm); break;
        case 'BT': tm = tlm = IDENTITY; break;
        case 'Tf': font = fonts.get(lastName); if (n.length) fontSize = n[n.length - 1]; break;
        case 'TL': if (n.length) leading = n[n.length - 1]; break;
        case 'Tm': if (n.length >= 6) tm = tlm = n.slice(-6) as unknown as Matrix; break;
        case 'Td': if (n.length >= 2) nextLine(n[n.length - 2], n[n.length - 1]); break;
        case 'TD': if (n.length >= 2) { leading = -n[n.length - 1]; nextLine(n[n.length - 2], n[n.length - 1]); } break;
        case 'T*': nextLine(0, -leading); break;
        case 'Tj': case 'TJ': show(pending); pending = ''; break;
        case "'": case '"': nextLine(0, -leading); show(pending); pending = ''; break;
        default: break;
      }
      nums = [];
      gapBefore = 0;
      i = j;
      continue;
    }
    i++;
  }
  show(pending);
  flush();
  return lines.map((l) => l.trim()).filter((l, idx, arr) => l || arr[idx - 1]).join('\n');
}
