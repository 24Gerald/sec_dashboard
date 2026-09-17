import type { Finding, AttackClass } from '@/types';

/** CWE / SWC identifiers → attack class. Extend freely; first match wins in array order. */
const CWE_MAP: Record<string, AttackClass> = {
  'CWE-89': 'sql-injection', 'CWE-564': 'sql-injection', 'CWE-943': 'sql-injection',
  'CWE-77': 'command-injection', 'CWE-78': 'command-injection', 'CWE-917': 'command-injection', 'CWE-1336': 'command-injection',
  'CWE-79': 'xss', 'CWE-80': 'xss', 'CWE-116': 'xss',
  'CWE-352': 'csrf', 'CWE-1021': 'csrf',
  'CWE-918': 'ssrf', 'CWE-611': 'xxe', 'CWE-776': 'xxe',
  'CWE-22': 'path-traversal', 'CWE-23': 'path-traversal', 'CWE-36': 'path-traversal', 'CWE-73': 'path-traversal',
  'CWE-502': 'deserialization', 'CWE-915': 'deserialization',
  'CWE-94': 'rce', 'CWE-95': 'rce', 'CWE-96': 'rce', 'CWE-98': 'rce', 'CWE-1104': 'outdated-component',
  'CWE-434': 'file-upload', 'CWE-646': 'file-upload',
  'CWE-287': 'auth-bypass', 'CWE-288': 'auth-bypass', 'CWE-306': 'auth-bypass', 'CWE-290': 'auth-bypass', 'CWE-302': 'auth-bypass', 'CWE-294': 'auth-bypass',
  'CWE-521': 'weak-credentials', 'CWE-259': 'weak-credentials', 'CWE-1392': 'weak-credentials', 'CWE-620': 'weak-credentials', 'CWE-640': 'weak-credentials',
  'CWE-798': 'secrets-exposure', 'CWE-540': 'secrets-exposure', 'CWE-615': 'secrets-exposure', 'CWE-312': 'secrets-exposure', 'CWE-522': 'secrets-exposure', 'CWE-256': 'secrets-exposure',
  'CWE-384': 'session-management', 'CWE-613': 'session-management', 'CWE-614': 'session-management', 'CWE-1004': 'session-management', 'CWE-565': 'session-management',
  'CWE-639': 'idor', 'CWE-284': 'idor', 'CWE-285': 'idor', 'CWE-862': 'idor', 'CWE-863': 'idor', 'CWE-566': 'idor',
  'CWE-269': 'privilege-escalation', 'CWE-250': 'privilege-escalation', 'CWE-266': 'privilege-escalation', 'CWE-274': 'privilege-escalation',
  'CWE-347': 'jwt-flaw', 'CWE-345': 'jwt-flaw', 'CWE-1270': 'jwt-flaw',
  'CWE-200': 'info-disclosure', 'CWE-209': 'info-disclosure', 'CWE-532': 'info-disclosure', 'CWE-538': 'info-disclosure', 'CWE-548': 'info-disclosure', 'CWE-497': 'info-disclosure', 'CWE-359': 'info-disclosure',
  'CWE-319': 'cleartext-traffic', 'CWE-295': 'mitm', 'CWE-297': 'mitm', 'CWE-300': 'mitm', 'CWE-757': 'mitm',
  'CWE-16': 'misconfiguration', 'CWE-693': 'misconfiguration', 'CWE-732': 'misconfiguration', 'CWE-276': 'misconfiguration', 'CWE-1188': 'misconfiguration', 'CWE-942': 'misconfiguration', 'CWE-1032': 'misconfiguration',
  'CWE-1395': 'outdated-component', 'CWE-937': 'outdated-component', 'CWE-1035': 'outdated-component',
  'CWE-327': 'weak-crypto', 'CWE-328': 'weak-crypto', 'CWE-326': 'weak-crypto', 'CWE-330': 'weak-crypto', 'CWE-338': 'weak-crypto', 'CWE-916': 'weak-crypto', 'CWE-1240': 'weak-crypto',
  'CWE-840': 'business-logic', 'CWE-841': 'business-logic', 'CWE-20': 'business-logic', 'CWE-472': 'business-logic',
  'CWE-362': 'race-condition', 'CWE-367': 'race-condition',
  'CWE-770': 'rate-limit', 'CWE-799': 'rate-limit', 'CWE-307': 'rate-limit', 'CWE-837': 'rate-limit',
  'CWE-400': 'dos', 'CWE-405': 'dos', 'CWE-406': 'dos', 'CWE-1333': 'dos', 'CWE-409': 'resource-exhaustion', 'CWE-401': 'resource-exhaustion', 'CWE-404': 'resource-exhaustion', 'CWE-834': 'resource-exhaustion',
  'CWE-190': 'integer-overflow', 'CWE-191': 'integer-overflow', 'CWE-682': 'integer-overflow',
  'CWE-1327': 'open-port', 'CWE-923': 'network-segmentation', 'CWE-350': 'dns', 'CWE-291': 'dns',
  'CWE-1357': 'supply-chain', 'CWE-829': 'supply-chain', 'CWE-494': 'supply-chain', 'CWE-506': 'supply-chain', 'CWE-1104x': 'supply-chain',
  'CWE-507': 'malware', 'CWE-451': 'phishing', 'CWE-1022': 'phishing',
  // Smart Contract Weakness Classification
  'SWC-107': 'reentrancy', 'SWC-101': 'integer-overflow', 'SWC-105': 'access-control-contract', 'SWC-106': 'access-control-contract', 'SWC-100': 'access-control-contract', 'SWC-108': 'access-control-contract', 'SWC-115': 'access-control-contract', 'SWC-112': 'access-control-contract',
  'SWC-104': 'unchecked-call', 'SWC-114': 'front-running', 'SWC-116': 'business-logic', 'SWC-120': 'oracle-manipulation', 'SWC-121': 'signature-replay', 'SWC-122': 'signature-replay', 'SWC-117': 'signature-replay',
  'SWC-113': 'denial-of-service-contract', 'SWC-128': 'denial-of-service-contract', 'SWC-126': 'unchecked-call', 'SWC-136': 'info-disclosure', 'SWC-124': 'upgradeability', 'SWC-118': 'upgradeability',
};

/** Tag / category words → class. Matched as whole tokens. */
const TAG_MAP: Record<string, AttackClass> = {
  sqli: 'sql-injection', 'sql-injection': 'sql-injection', nosqli: 'sql-injection', injection: 'sql-injection',
  rce: 'rce', 'command-injection': 'command-injection', 'os-command': 'command-injection',
  xss: 'xss', 'cross-site-scripting': 'xss', csrf: 'csrf', clickjacking: 'csrf', ssrf: 'ssrf', xxe: 'xxe', lfi: 'path-traversal', rfi: 'path-traversal', 'path-traversal': 'path-traversal', 'directory-traversal': 'path-traversal',
  deserialization: 'deserialization', 'file-upload': 'file-upload', upload: 'file-upload',
  'auth-bypass': 'auth-bypass', authentication: 'auth-bypass', 'broken-auth': 'auth-bypass', mfa: 'auth-bypass', 'default-credentials': 'weak-credentials', 'weak-password': 'weak-credentials', 'password-policy': 'weak-credentials', 'credential-stuffing': 'weak-credentials', bruteforce: 'weak-credentials', 'brute-force': 'weak-credentials',
  session: 'session-management', 'session-fixation': 'session-management', cookie: 'session-management',
  idor: 'idor', bola: 'idor', 'access-control': 'idor', authorization: 'idor', 'broken-access-control': 'idor', bfla: 'privilege-escalation', 'privilege-escalation': 'privilege-escalation', privesc: 'privilege-escalation',
  jwt: 'jwt-flaw', oauth: 'jwt-flaw', saml: 'jwt-flaw',
  secrets: 'secrets-exposure', 'hardcoded-secret': 'secrets-exposure', 'api-key': 'secrets-exposure', 'leaked-credentials': 'secrets-exposure', 'private-key': 'secrets-exposure', 'exposed-env': 'secrets-exposure',
  'info-disclosure': 'info-disclosure', 'information-disclosure': 'info-disclosure', 'verbose-errors': 'info-disclosure', 'stack-trace': 'info-disclosure', 'debug-mode': 'info-disclosure',
  misconfiguration: 'misconfiguration', misconfig: 'misconfiguration', 'security-headers': 'misconfiguration', cors: 'misconfiguration', 's3-bucket': 'misconfiguration', 'open-bucket': 'misconfiguration', 'cloud-config': 'misconfiguration',
  'outdated-component': 'outdated-component', 'vulnerable-dependency': 'outdated-component', cve: 'outdated-component', 'end-of-life': 'outdated-component', eol: 'outdated-component', 'known-vulnerability': 'outdated-component',
  crypto: 'weak-crypto', 'weak-crypto': 'weak-crypto', tls: 'weak-crypto', 'weak-cipher': 'weak-crypto', 'weak-hash': 'weak-crypto', randomness: 'weak-crypto',
  'business-logic': 'business-logic', logic: 'business-logic', 'race-condition': 'race-condition', toctou: 'race-condition',
  'rate-limit': 'rate-limit', 'rate-limiting': 'rate-limit', dos: 'dos', ddos: 'dos', 'denial-of-service': 'dos', availability: 'dos', 'load-test': 'resource-exhaustion', 'resource-exhaustion': 'resource-exhaustion', performance: 'resource-exhaustion', 'memory-leak': 'resource-exhaustion', capacity: 'resource-exhaustion',
  reentrancy: 'reentrancy', 'reentrancy-attack': 'reentrancy', 'integer-overflow': 'integer-overflow', overflow: 'integer-overflow', underflow: 'integer-overflow',
  'access-control-contract': 'access-control-contract', 'onlyowner': 'access-control-contract', 'missing-modifier': 'access-control-contract', 'unprotected-function': 'access-control-contract',
  oracle: 'oracle-manipulation', 'price-manipulation': 'oracle-manipulation', 'oracle-manipulation': 'oracle-manipulation', 'flash-loan': 'flash-loan', flashloan: 'flash-loan',
  'front-running': 'front-running', frontrunning: 'front-running', mev: 'front-running', sandwich: 'front-running', 'unchecked-call': 'unchecked-call', 'unchecked-return': 'unchecked-call',
  'signature-replay': 'signature-replay', replay: 'signature-replay', 'upgradeability': 'upgradeability', proxy: 'upgradeability', 'uninitialized': 'upgradeability', 'contract-dos': 'denial-of-service-contract', 'gas-griefing': 'denial-of-service-contract',
  mitm: 'mitm', 'man-in-the-middle': 'mitm', 'ssl-stripping': 'mitm', cleartext: 'cleartext-traffic', plaintext: 'cleartext-traffic', 'unencrypted': 'cleartext-traffic', http: 'cleartext-traffic',
  'open-port': 'open-port', 'exposed-service': 'open-port', 'exposed-port': 'open-port', 'exposed-admin': 'open-port', segmentation: 'network-segmentation', 'flat-network': 'network-segmentation', 'lateral-movement': 'lateral-movement', dns: 'dns', 'dns-spoofing': 'dns', 'subdomain-takeover': 'dns',
  phishing: 'phishing', 'social-engineering': 'social-engineering', pretexting: 'social-engineering', 'supply-chain': 'supply-chain', dependency: 'supply-chain', 'typosquatting': 'supply-chain', 'ci-cd': 'supply-chain', malware: 'malware', ransomware: 'malware', insider: 'insider',
};

/** Keyword patterns with weights for free-text classification. */
const KEYWORDS: [AttackClass, RegExp, number][] = [
  ['sql-injection', /\b(sql|nosql|mongo)\s*injection|sqli|union\s+select|or\s+1\s*=\s*1|blind\s+sql|sqlmap/i, 5],
  ['command-injection', /\b(command|os|shell)\s*injection|\bexec\(|\bsystem\(|\$\(.*\)|subprocess|;\s*cat\s+\/etc\/passwd/i, 5],
  ['xss', /\bcross[- ]site\s+scripting|\bxss\b|<script|onerror=|dom[- ]based|stored\s+script/i, 5],
  ['csrf', /\bcsrf\b|cross[- ]site\s+request\s+forgery|clickjack/i, 5],
  ['ssrf', /\bssrf\b|server[- ]side\s+request\s+forgery|169\.254\.169\.254|metadata\s+service/i, 5],
  ['xxe', /\bxxe\b|xml\s+external\s+entit|<!ENTITY/i, 5],
  ['path-traversal', /path\s+traversal|directory\s+traversal|\.\.\/|local\s+file\s+inclusion|\blfi\b|\brfi\b|arbitrary\s+file\s+read/i, 5],
  ['deserialization', /deserializ|unserialize|pickle\.loads|ObjectInputStream|gadget\s+chain/i, 5],
  ['rce', /remote\s+code\s+execution|\brce\b|arbitrary\s+code|code\s+execution|template\s+injection|\bssti\b|eval\(/i, 5],
  ['file-upload', /unrestricted\s+(file\s+)?upload|upload.*(webshell|\.php|\.jsp|executable)|file\s+upload\s+(bypass|vulnerab)/i, 4],
  ['auth-bypass', /auth(entication)?\s+bypass|bypass(es|ed)?\s+(the\s+)?(login|authentication|mfa|2fa)|missing\s+authentication|unauthenticated\s+access|without\s+(logging\s+in|authentication)/i, 5],
  ['weak-credentials', /default\s+(credential|password)|weak\s+password|password\s+policy|brute[- ]?forc|credential\s+stuffing|admin\s*\/\s*admin|guessable/i, 4],
  ['session-management', /session\s+(fixation|hijack|token|expir|management)|cookie\s+(without|missing|lacks)|httponly|samesite|logout\s+does\s+not/i, 4],
  ['idor', /\bidor\b|insecure\s+direct\s+object|broken\s+object\s+level|\bbola\b|(other|another|others'?|different)\s+(user'?s?|customer'?s?|account'?s?|people'?s?)?\s*(data|records?|orders?|invoices?|documents?|files?|profiles?|messages?)|ownership\s+check|no\s+(authorization|authorisation|ownership|access)\s+(check|control|validation)|horizontal\s+(privilege|access)|access\s+control\s+(missing|bypass|flaw)|(any|other)\s+users?\s+(can\s+)?(view|read|access|see|retrieve)|changing\s+the\s+(id|identifier|user_?id|account)/i, 4],
  ['privilege-escalation', /privilege\s+escalation|privesc|escalat(e|ion)\s+to\s+(admin|root)|vertical\s+(privilege|access)|become\s+admin|admin\s+function|\bbfla\b|role\s+(bypass|manipulation)/i, 5],
  ['jwt-flaw', /\bjwt\b|json\s+web\s+token|alg\s*[:=]\s*none|algorithm\s+confusion|signature\s+(not\s+)?(verif|check)|oauth|open\s+redirect|saml/i, 4],
  ['secrets-exposure', /hard[- ]?coded\s+(secret|password|key|credential)|api\s*key\s+(exposed|leak|in\s+source|committed)|leaked\s+(secret|credential|key)|private\s+key\s+(exposed|in\s+repo|committed)|\.env\s+(file\s+)?(exposed|committed|public)|secret\s+(in|committed\s+to)\s+(git|repo|source)|aws_secret|plaintext\s+(password|secret)/i, 5],
  ['info-disclosure', /information\s+(disclosure|leak)|verbose\s+error|stack\s+trace|debug\s+(mode|endpoint)|exposes?\s+(internal|sensitive)\s+(info|data|path)|server\s+version|directory\s+listing|source\s+code\s+disclosure|\.git\/?\s+(exposed|accessible)/i, 3],
  ['cleartext-traffic', /clear[- ]?text|plain[- ]?text\s+(traffic|transmission|protocol|http)|unencrypted\s+(traffic|channel|connection|transmission)|over\s+http\b|telnet|\bftp\b\s+(credential|plaintext)|credentials?\s+(sent|transmitted)\s+(in|over)/i, 5],
  ['mitm', /man[- ]in[- ]the[- ]middle|\bmitm\b|certificate\s+(validation|pinning)\s+(missing|disabled|bypass)|ssl\s+strip|arp\s+(spoof|poison)|self[- ]signed\s+cert|accepts?\s+any\s+certificate/i, 5],
  ['misconfiguration', /misconfig|security\s+header|\bcors\b|wildcard\s+origin|s3\s+bucket|public\s+bucket|world[- ]readable|permissive\s+(policy|permission|iam)|debug\s+enabled|directory\s+listing|default\s+config|hsts|x-frame-options|content-security-policy|open\s+(redirect|proxy)/i, 3],
  ['outdated-component', /outdated|end[- ]of[- ]life|\beol\b|vulnerable\s+(version|dependency|library|component)|known\s+(cve|vulnerabilit)|cve-\d{4}-\d+|unpatched|no\s+longer\s+(supported|maintained)|upgrade\s+to\s+version/i, 4],
  ['weak-crypto', /weak\s+(cipher|hash|crypto|encryption|random)|\bmd5\b|\bsha1\b|\bdes\b|\brc4\b|tls\s*1\.[01]|sslv[23]|ecb\s+mode|hard[- ]coded\s+iv|insufficient\s+entropy|math\.random|predictable\s+(token|seed|random)/i, 4],
  ['business-logic', /business\s+logic|logic\s+flaw|negative\s+(quantity|amount|price)|price\s+manipulation|coupon|discount\s+abuse|workflow\s+bypass|step\s+skip|state\s+machine|timestamp\s+dependence|block\.timestamp/i, 3],
  ['race-condition', /race\s+condition|\btoctou\b|double[- ]spend|concurrent\s+request|parallel\s+request|time[- ]of[- ]check/i, 5],
  ['rate-limit', /rate[- ]limit|no\s+throttl|unlimited\s+(attempts|requests)|otp\s+(brute|bypass)|enumerat(e|ion)|captcha\s+(missing|bypass)/i, 4],
  ['dos', /denial[- ]of[- ]service|\bddos\b|\bdos\b|crash(es|ed)?\s+(the\s+)?(server|service|app)|regex\s+dos|\bredos\b|amplification|slowloris|zip\s+bomb|billion\s+laughs/i, 4],
  ['resource-exhaustion', /resource\s+exhaustion|memory\s+leak|cpu\s+(spike|exhaust|100%)|connection\s+pool\s+exhaust|load\s+test|stress\s+test|degrad(es|ed|ation)\s+under\s+load|throughput|latency\s+(spike|exceed)|p9[59]\s+latency|requests?\s+per\s+second|\brps\b|concurrency|breaking\s+point|fails?\s+(at|above|under)\s+\d+\s+(users|rps|concurrent)|scal(ing|ability)/i, 4],
  ['reentrancy', /re-?entran(cy|t)|call\.value|external\s+call\s+before\s+state|checks[- ]effects[- ]interactions|nonReentrant/i, 6],
  ['integer-overflow', /integer\s+(overflow|underflow)|arithmetic\s+overflow|unchecked\s+(math|arithmetic)|safemath|overflow|underflow|wrap[- ]?around/i, 4],
  ['access-control-contract', /onlyOwner|missing\s+(access\s+control|modifier|auth)|unprotected\s+(function|initializ|selfdestruct|withdraw)|anyone\s+can\s+(call|withdraw|mint|burn|pause|upgrade|set)|owner(ship)?\s+(can\s+be\s+)?(taken|hijack|transfer)|tx\.origin/i, 5],
  ['oracle-manipulation', /oracle\s+manipulat|price\s+(oracle|feed)|spot\s+price|twap|manipulat(e|ion)\s+(of\s+)?(the\s+)?(price|reserve)|chainlink|stale\s+price|getReserves/i, 5],
  ['flash-loan', /flash[- ]?loan|flash\s+(swap|mint)|atomic\s+arbitrage|single[- ]transaction\s+attack/i, 6],
  ['front-running', /front[- ]?run|sandwich|\bmev\b|mempool|transaction\s+ordering|slippage\s+(not\s+set|unprotected|zero)|deadline\s+(not\s+set|missing)/i, 5],
  ['unchecked-call', /unchecked\s+(call|return|send|transfer|low[- ]level)|return\s+value\s+(not\s+checked|ignored)|\.call\{value|\.send\(|low[- ]level\s+call/i, 4],
  ['signature-replay', /signature\s+(replay|malleab)|replay\s+attack|missing\s+nonce|ecrecover|permit\s+replay|chain\s*id\s+(not\s+)?(included|checked)|cross[- ]chain\s+replay/i, 5],
  ['upgradeability', /upgradeab|proxy\s+(pattern|contract|admin)|uninitiali[sz]ed\s+(proxy|implementation|contract)|initializ(e|er)\s+(can\s+be\s+called|unprotected|missing)|storage\s+(collision|layout)|delegatecall|selfdestruct/i, 4],
  ['denial-of-service-contract', /gas\s+(limit|griefing|exhaustion)|unbounded\s+(loop|array)|block\s+gas|revert\s+(in\s+)?(loop|fallback)|push\s+payment|denial\s+of\s+service\s+(in|on)\s+(the\s+)?contract/i, 4],
  ['open-port', /open\s+port|exposed\s+(service|port|admin\s+panel|database|redis|mongo|elastic|rdp|ssh|jenkins|kubernetes|dashboard)|listening\s+on\s+0\.0\.0\.0|publicly\s+(accessible|reachable)\s+(service|port|database|admin)|nmap|port\s+scan|management\s+interface\s+exposed/i, 4],
  ['network-segmentation', /segmentation|flat\s+network|vlan|no\s+(network\s+)?isolation|reach(able|es)\s+(internal|production)\s+(network|host)|east[- ]west|firewall\s+rule|any[- ]any/i, 4],
  ['lateral-movement', /lateral\s+movement|pivot|pass[- ]the[- ]hash|kerberoast|domain\s+admin|smb\s+relay|credential\s+reuse\s+across|move\s+between\s+(hosts|systems)/i, 5],
  ['dns', /\bdns\b|subdomain\s+takeover|dangling\s+(cname|dns|record)|zone\s+transfer|axfr|dns\s+(spoof|poison|hijack|rebind)/i, 5],
  ['phishing', /phish|spoofed\s+(email|login|page)|credential\s+harvest|fake\s+login|spf|dkim|dmarc|lookalike\s+domain|email\s+spoof/i, 5],
  ['social-engineering', /social\s+engineer|pretext|vishing|smishing|tailgat|impersonat(e|ion)\s+(of\s+)?(staff|support|employee)|helpdesk\s+reset/i, 5],
  ['supply-chain', /supply[- ]chain|third[- ]party\s+(package|dependency|script)|typosquat|dependency\s+confusion|malicious\s+(package|dependency|npm|pypi)|ci\/?cd\s+(pipeline|secret|runner)|build\s+pipeline|github\s+action|compromised\s+(package|library|vendor)|lockfile/i, 4],
  ['malware', /malware|ransomware|trojan|backdoor|web\s*shell|c2\s+(beacon|server)|command[- ]and[- ]control|crypto[- ]?miner|infostealer|keylogger/i, 5],
  ['insider', /insider|disgruntled|excessive\s+(privilege|permission)|leaver\s+(access|account)|shared\s+account|over[- ]privileged\s+(staff|employee|user)/i, 4],
];

const ENGAGEMENT_DEFAULT: Record<string, AttackClass> = {
  'smart-contract-audit': 'access-control-contract',
  'load-test': 'resource-exhaustion',
  'network-traffic-analysis': 'cleartext-traffic',
  'penetration-test': 'auth-bypass',
  'vulnerability-assessment': 'outdated-component',
  'bug-hunt': 'idor',
  'red-team': 'phishing',
  'soc-monitoring': 'malware',
};

export interface Classification { cls: AttackClass; confidence: number; reason: string }

export function classifyFinding(f: Finding, engagementType?: string): Classification {
  if (f.attack?.class && f.attack.class !== 'auto') return { cls: f.attack.class, confidence: 1, reason: 'Set explicitly on the finding' };
  for (const c of f.cwe ?? []) {
    const key = c.toUpperCase().replace(/\s+/g, '');
    if (CWE_MAP[key]) return { cls: CWE_MAP[key], confidence: 0.95, reason: `Mapped from ${key}` };
  }
  const tokens = [...(f.tags ?? []), f.category ?? ''].map((t) => t.toLowerCase().trim()).filter(Boolean);
  for (const t of tokens) if (TAG_MAP[t]) return { cls: TAG_MAP[t], confidence: 0.85, reason: `Mapped from tag "${t}"` };

  const text = [f.title, f.summary, f.description ?? '', f.impact ?? '', (f.stepsToReproduce ?? []).join(' '), f.affected?.component ?? '', f.affected?.endpoint ?? ''].join('\n');
  const scores = new Map<AttackClass, number>();
  for (const [cls, re, w] of KEYWORDS) {
    const m = text.match(new RegExp(re.source, re.flags + (re.flags.includes('g') ? '' : 'g')));
    if (m) scores.set(cls, (scores.get(cls) ?? 0) + w * Math.min(m.length, 3) + (re.test(f.title) ? w : 0));
  }
  let best: AttackClass | null = null; let bestScore = 0;
  for (const [cls, s] of scores) if (s > bestScore) { best = cls; bestScore = s; }
  if (best && bestScore >= 4) return { cls: best, confidence: Math.min(0.8, 0.4 + bestScore / 40), reason: 'Inferred from the finding text' };
  if (engagementType && ENGAGEMENT_DEFAULT[engagementType]) return { cls: ENGAGEMENT_DEFAULT[engagementType], confidence: 0.3, reason: `Default for ${engagementType} engagements` };
  return { cls: 'generic', confidence: 0.2, reason: 'No specific signal — generic model' };
}
