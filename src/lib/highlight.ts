/**
 * Minimal syntax highlighter for evidence snippets. Produces safe HTML: every
 * character is escaped before class spans are inserted.
 */
const KEYWORDS: Record<string, string[]> = {
  common: ['if', 'else', 'for', 'while', 'return', 'function', 'const', 'let', 'var', 'class', 'new', 'import', 'export', 'from', 'async', 'await', 'try', 'catch', 'throw', 'switch', 'case', 'break', 'default', 'null', 'true', 'false', 'undefined', 'this', 'typeof', 'instanceof', 'interface', 'type', 'extends', 'implements', 'public', 'private', 'protected', 'static', 'void', 'in', 'of', 'do', 'continue', 'yield', 'delete'],
  solidity: ['pragma', 'solidity', 'contract', 'function', 'modifier', 'mapping', 'address', 'uint', 'uint256', 'uint8', 'int', 'bool', 'string', 'bytes', 'bytes32', 'memory', 'storage', 'calldata', 'public', 'private', 'external', 'internal', 'view', 'pure', 'payable', 'returns', 'return', 'require', 'revert', 'emit', 'event', 'struct', 'enum', 'if', 'else', 'for', 'while', 'msg', 'sender', 'value', 'block', 'timestamp', 'constructor', 'override', 'virtual', 'immutable', 'constant', 'import', 'is', 'library', 'using', 'interface', 'assert', 'true', 'false', 'delete', 'new', 'this', 'selfdestruct', 'transfer', 'call', 'send', 'indexed', 'unchecked', 'receive', 'fallback', 'abstract'],
  python: ['def', 'class', 'import', 'from', 'return', 'if', 'elif', 'else', 'for', 'while', 'try', 'except', 'finally', 'with', 'as', 'lambda', 'yield', 'None', 'True', 'False', 'and', 'or', 'not', 'in', 'is', 'pass', 'raise', 'global', 'async', 'await', 'self', 'print'],
  go: ['func', 'package', 'import', 'return', 'if', 'else', 'for', 'range', 'var', 'const', 'type', 'struct', 'interface', 'map', 'chan', 'go', 'defer', 'select', 'switch', 'case', 'default', 'break', 'continue', 'nil', 'true', 'false', 'error', 'string', 'int', 'byte', 'bool'],
  sql: ['select', 'from', 'where', 'and', 'or', 'not', 'insert', 'into', 'values', 'update', 'set', 'delete', 'union', 'all', 'join', 'left', 'right', 'inner', 'on', 'group', 'by', 'order', 'limit', 'offset', 'having', 'as', 'like', 'in', 'is', 'null', 'create', 'table', 'drop', 'alter', 'exec', 'execute', 'declare', 'cast', 'concat', 'sleep', 'benchmark', 'information_schema'],
  bash: ['if', 'then', 'else', 'fi', 'for', 'do', 'done', 'while', 'echo', 'export', 'curl', 'sudo', 'cat', 'grep', 'awk', 'sed', 'chmod', 'chown', 'rm', 'cp', 'mv', 'nmap', 'python3', 'bash', 'sh', 'exit', 'function', 'local', 'return', 'nc', 'wget'],
  rust: ['fn', 'let', 'mut', 'pub', 'struct', 'enum', 'impl', 'trait', 'use', 'mod', 'match', 'if', 'else', 'for', 'while', 'loop', 'return', 'self', 'Self', 'unsafe', 'as', 'in', 'ref', 'where', 'move', 'async', 'await', 'true', 'false', 'Some', 'None', 'Ok', 'Err', 'msg', 'require', 'anchor_lang'],
};
const ALIASES: Record<string, string> = { js: 'common', javascript: 'common', ts: 'common', typescript: 'common', tsx: 'common', jsx: 'common', java: 'common', cs: 'common', php: 'common', sol: 'solidity', py: 'python', shell: 'bash', sh: 'bash', zsh: 'bash', rs: 'rust', http: 'http', json: 'json', yaml: 'yaml', yml: 'yaml' };

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function highlight(code: string, language = ''): string {
  const lang = ALIASES[language.toLowerCase()] ?? language.toLowerCase();
  if (lang === 'http') return highlightHttp(code);
  if (lang === 'json' || lang === 'yaml') return highlightData(code);
  const kw = new Set([...(KEYWORDS[lang] ?? []), ...(lang === 'sql' || lang === 'bash' ? [] : KEYWORDS.common)]);
  const isSql = lang === 'sql';
  const lineComment = lang === 'python' || lang === 'bash' || lang === 'yaml' ? '#' : isSql ? '--' : '//';
  const re = /("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`)|(\/\*[\s\S]*?\*\/)|((?:\/\/|#|--)[^\n]*)|(\b\d+(?:\.\d+)?(?:e[+-]?\d+)?\b|\b0x[0-9a-fA-F]+\b)|(\b[A-Za-z_][A-Za-z0-9_]*\b)(?=\s*\()|(\b[A-Za-z_][A-Za-z0-9_]*\b)|([{}()[\];,.<>=+\-*/%!&|^~?:@])/g;
  let out = '';
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(code))) {
    out += esc(code.slice(last, m.index));
    const [tok, str, bcom, lcom, num, fn, ident, op] = m;
    if (str) out += `<span class="tok-s">${esc(tok)}</span>`;
    else if (bcom) out += `<span class="tok-c">${esc(tok)}</span>`;
    else if (lcom) {
      const starts = tok.startsWith(lineComment) || (lang === 'common' && tok.startsWith('//'));
      out += starts ? `<span class="tok-c">${esc(tok)}</span>` : esc(tok);
    } else if (num) out += `<span class="tok-n">${esc(tok)}</span>`;
    else if (fn) out += kw.has(isSql ? fn.toLowerCase() : fn) ? `<span class="tok-k">${esc(tok)}</span>` : `<span class="tok-f">${esc(tok)}</span>`;
    else if (ident) {
      const key = isSql ? ident.toLowerCase() : ident;
      if (kw.has(key)) out += `<span class="tok-k">${esc(tok)}</span>`;
      else if (/^[A-Z][A-Za-z0-9]+$/.test(ident)) out += `<span class="tok-t">${esc(tok)}</span>`;
      else out += esc(tok);
    } else if (op) out += `<span class="tok-o">${esc(tok)}</span>`;
    else out += esc(tok);
    last = m.index + tok.length;
  }
  out += esc(code.slice(last));
  return out;
}

function highlightHttp(code: string): string {
  return code.split('\n').map((line, i) => {
    if (i === 0 && /^(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD|HTTP\/)/.test(line)) return `<span class="tok-k">${esc(line)}</span>`;
    const h = line.match(/^([A-Za-z-]+):\s*(.*)$/);
    if (h) return `<span class="tok-t">${esc(h[1])}</span>: <span class="tok-s">${esc(h[2])}</span>`;
    return esc(line);
  }).join('\n');
}
function highlightData(code: string): string {
  return esc(code)
    .replace(/(&quot;[^&]*?&quot;)(\s*:)/g, '<span class="tok-t">$1</span>$2')
    .replace(/:\s*(&quot;[^&]*?&quot;)/g, (m, s) => m.replace(s, `<span class="tok-s">${s}</span>`))
    .replace(/\b(true|false|null)\b/g, '<span class="tok-k">$1</span>')
    .replace(/\b(-?\d+(?:\.\d+)?)\b/g, '<span class="tok-n">$1</span>');
}
