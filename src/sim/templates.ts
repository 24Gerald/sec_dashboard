import type { AttackClass } from '@/types';
import type { FlowNode, FlowEdge, Stage } from './types';
import { node, edge } from './scenes';

export interface Template {
  headline: string;
  analogy: string;
  blastRadius: string;
  affects: string[];
  keyControl: string;
  tactics: string[];
  build: (ctx: TemplateCtx) => { nodes: FlowNode[]; edges: FlowEdge[]; stages: Stage[] };
}
export interface TemplateCtx {
  target: string;     // asset / component name
  dataLabel: string;  // what data/value is at risk
  entryLabel: string; // entry point
}

const A = (activeAt?: number) => node('attacker', 'Attacker', 'attacker', 0.06, 0.5, activeAt ?? 0);

/** Web app: attacker → endpoint → app server → database/users. */
function webChain(ctx: TemplateCtx, stages: Stage[], opts?: { hub?: string; data?: string }): { nodes: FlowNode[]; edges: FlowEdge[]; stages: Stage[] } {
  const nodes: FlowNode[] = [
    A(),
    node('entry', ctx.entryLabel, 'entry', 0.3, 0.5, 1),
    node('app', opts?.hub ?? ctx.target, 'system', 0.56, 0.5, 2),
    node('data', opts?.data ?? ctx.dataLabel, 'data', 0.86, 0.28, 3),
    node('users', 'Other users', 'user', 0.86, 0.72, 4),
  ];
  const edges: FlowEdge[] = [
    edge('attacker', 'entry', 1, 'crafted request'),
    edge('entry', 'app', 2, 'reaches backend'),
    edge('app', 'data', 3, 'reads / writes', 'exfil'),
    edge('app', 'users', 4, 'affects', 'lateral'),
  ];
  return { nodes, edges, stages };
}

const T: Partial<Record<AttackClass, Template>> = {
  'sql-injection': {
    headline: 'Attacker rewrites your database queries by typing into an input box.',
    analogy: 'Like a form that lets someone add "…and while you\'re at it, hand over the master key" to any request — and the system politely obliges.',
    blastRadius: 'The entire database behind the vulnerable input — often every user record at once.',
    affects: ['All customer/user records in the database', 'Login credentials and password hashes', 'Anything else stored in the same database'],
    keyControl: 'Parameterised queries / prepared statements (never build SQL by string concatenation).',
    tactics: ['Initial Access', 'Collection', 'Exfiltration'],
    build: (ctx) => webChain(ctx, [
      { phase: 'Recon', title: 'Attacker finds an input that talks to the database', narrative: `The attacker probes ${ctx.entryLabel} and notices the page behaves differently when they add a single quote (') to their input — a tell-tale sign the input is passed straight into a database query.`, technique: "Fuzzing input fields with SQL metacharacters (', --, OR 1=1).", defence: 'Reject / escape unexpected characters at the boundary.', mitre: 'T1190', activate: ['attacker', 'entry'], edge: 0 },
      { phase: 'Injection', title: 'They inject their own database commands', narrative: 'Instead of a normal search term, the attacker types a fragment of database code. Because the input is glued directly into the query, the database runs the attacker\'s code as if the application had asked for it.', technique: "UNION-based / boolean-blind SQL injection to append attacker-controlled clauses.", defence: 'Parameterised queries treat input as data, never as code.', mitre: 'T1190', activate: ['app'], edge: 1 },
      { phase: 'Exfiltration', title: 'They dump the whole database', narrative: `With a working injection, the attacker asks the database for everything — ${ctx.dataLabel}, password hashes, tokens — and it answers. This can be scripted to pull the entire dataset in minutes.`, technique: 'Automated extraction (e.g. sqlmap) of table contents.', defence: 'Least-privilege DB accounts + query allow-listing limit the blast radius.', mitre: 'T1005 / TA0010', activate: ['data'], edge: 2 },
      { phase: 'Impact', title: 'Every user is now exposed', narrative: 'Stolen credentials are reused to break into other accounts and services. Regulators must be notified, customers lose trust, and the data can be sold or leaked publicly.', technique: 'Credential reuse, resale on criminal markets, extortion.', defence: 'Hashing + unique passwords limit reuse; monitoring catches bulk reads.', mitre: 'TA0040', activate: ['users'], edge: 3 },
    ]),
  },
  rce: {
    headline: 'Attacker runs their own programs on your server.',
    analogy: 'Like handing a stranger the keys, the alarm code and a desk inside your building — they can now do anything an employee could, and more.',
    blastRadius: 'The whole server and everything it can reach on the internal network.',
    affects: ['The compromised server and its files', 'Any database or service it connects to', 'The wider internal network via that foothold'],
    keyControl: 'Patch the vulnerable component; run services with least privilege and strong input validation.',
    tactics: ['Initial Access', 'Execution', 'Persistence', 'Lateral Movement'],
    build: (ctx) => {
      const nodes = [
        A(),
        node('entry', ctx.entryLabel, 'entry', 0.28, 0.5, 1),
        node('app', ctx.target, 'system', 0.52, 0.5, 2),
        node('shell', 'Shell / foothold', 'system', 0.72, 0.28, 3),
        node('net', 'Internal network', 'network', 0.9, 0.5, 4),
        node('data', ctx.dataLabel, 'data', 0.9, 0.8, 4),
      ];
      const edges = [
        edge('attacker', 'entry', 1, 'malicious payload'),
        edge('entry', 'app', 2, 'triggers execution'),
        edge('app', 'shell', 3, 'code runs'),
        edge('shell', 'net', 4, 'pivots', 'lateral'),
        edge('shell', 'data', 4, 'steals', 'exfil'),
      ];
      const stages: Stage[] = [
        { phase: 'Delivery', title: 'A booby-trapped request arrives', narrative: `The attacker sends a specially crafted payload to ${ctx.entryLabel}. It looks like ordinary traffic but contains hidden instructions.`, technique: 'Payload targeting an injection / deserialization / upload flaw.', defence: 'Input validation and up-to-date components.', mitre: 'T1190', activate: ['attacker', 'entry'], edge: 0 },
        { phase: 'Execution', title: 'The server runs the attacker\'s code', narrative: 'The vulnerable component executes the hidden instructions with the same power the application itself has.', technique: 'Remote code execution → command shell.', defence: 'Sandboxing, least privilege, WAF.', mitre: 'T1059', activate: ['app', 'shell'], edge: 2 },
        { phase: 'Foothold', title: 'They set up camp', narrative: 'The attacker installs a backdoor so they can return at will, even after a reboot or password change.', technique: 'Persistence via cron, service, or web shell.', defence: 'File-integrity monitoring, EDR.', mitre: 'T1505.003', activate: ['shell'], edge: 3 },
        { phase: 'Spread', title: 'They move deeper', narrative: `From this foothold the attacker reaches the internal network and ${ctx.dataLabel}, hunting for more valuable systems.`, technique: 'Lateral movement + data theft.', defence: 'Network segmentation, monitoring.', mitre: 'TA0008 / TA0010', activate: ['net', 'data'], edge: 4 },
      ];
      return { nodes, edges, stages };
    },
  },
  xss: {
    headline: "Attacker plants hidden code that runs inside other users' browsers.",
    analogy: 'Like slipping a forged note into a shared noticeboard — everyone who reads it unknowingly follows the attacker\'s instructions.',
    blastRadius: 'Every user who views the poisoned page — potentially your entire user base.',
    affects: ['Logged-in users who view the page', 'Their session cookies and accounts', 'Actions performed as those users'],
    keyControl: 'Context-aware output encoding + a strict Content-Security-Policy.',
    tactics: ['Initial Access', 'Execution', 'Credential Access'],
    build: (ctx) => {
      const nodes = [
        A(),
        node('entry', ctx.entryLabel, 'entry', 0.3, 0.5, 1),
        node('app', ctx.target, 'system', 0.52, 0.5, 2),
        node('victim', 'Victim browser', 'user', 0.78, 0.32, 3),
        node('data', 'Session / account', 'data', 0.92, 0.68, 4),
      ];
      const edges = [
        edge('attacker', 'entry', 1, 'injects script'),
        edge('entry', 'app', 2, 'stored'),
        edge('app', 'victim', 3, 'served to victim', 'lateral'),
        edge('victim', 'data', 4, 'hijacks session', 'exfil'),
      ];
      const stages: Stage[] = [
        { phase: 'Injection', title: 'Attacker plants a script', narrative: `The attacker submits content through ${ctx.entryLabel} that secretly contains JavaScript instead of plain text.`, technique: 'Stored / reflected / DOM XSS payload.', defence: 'Encode output; treat all user content as untrusted.', mitre: 'T1059.007', activate: ['attacker', 'entry', 'app'], edge: 0 },
        { phase: 'Delivery', title: 'The site serves it to real users', narrative: 'When another user opens the page, the hidden script runs inside their browser as if the site itself wrote it.', technique: 'Script executes in the victim origin.', defence: 'Content-Security-Policy blocks inline/unknown scripts.', mitre: 'T1189', activate: ['victim'], edge: 2 },
        { phase: 'Theft', title: "It steals the victim's session", narrative: 'The script quietly copies the victim\'s login session and sends it to the attacker — who can now act as that user without a password.', technique: 'Session/cookie theft, keylogging, request forgery.', defence: 'HttpOnly cookies, CSP, short sessions.', mitre: 'T1539', activate: ['data'], edge: 3 },
        { phase: 'Impact', title: 'Accounts are taken over at scale', narrative: 'Every visitor to the poisoned page can be hit automatically. High-value targets (admins) give the attacker even more power.', technique: 'Mass account takeover; admin compromise.', defence: 'Monitoring, CSP reporting, least privilege.', mitre: 'TA0006', activate: [], edge: 3 },
      ];
      return { nodes, edges, stages };
    },
  },
  idor: {
    headline: "Attacker views other people's data just by changing a number in the URL.",
    analogy: 'Like a coat-check where any ticket number gets you any coat — the system never checks the coat is actually yours.',
    blastRadius: 'Every record of the same type — often the complete set of user documents or accounts.',
    affects: ["Other users' private records", 'Personal / financial documents', 'Regulated personal data (GDPR/PII)'],
    keyControl: "Server-side authorization check on every object access ('is this record owned by the caller?').",
    tactics: ['Discovery', 'Collection', 'Exfiltration'],
    build: (ctx) => {
      const nodes = [
        A(),
        node('entry', ctx.entryLabel, 'entry', 0.32, 0.5, 1),
        node('app', ctx.target, 'system', 0.58, 0.5, 2),
        node('data', ctx.dataLabel, 'data', 0.88, 0.5, 3),
      ];
      const edges = [
        edge('attacker', 'entry', 1, 'id = 1002'),
        edge('entry', 'app', 2, 'no ownership check'),
        edge('app', 'data', 3, 'returns victim record', 'exfil'),
      ];
      const stages: Stage[] = [
        { phase: 'Observe', title: 'Attacker notices an ID in the request', narrative: `Viewing their own data, the attacker sees a reference like ${ctx.entryLabel}?id=1001 and wonders what happens with id=1002.`, technique: 'Parameter analysis of object references.', defence: 'Use unguessable IDs — but never rely on that alone.', mitre: 'T1592', activate: ['attacker', 'entry'], edge: 0 },
        { phase: 'Tamper', title: 'They change the ID to someone else\'s', narrative: 'They swap in a different number. The server never checks whether that record belongs to them — it just returns it.', technique: 'Insecure Direct Object Reference (BOLA).', defence: 'Enforce per-object authorization server-side.', mitre: 'T1190', activate: ['app'], edge: 1 },
        { phase: 'Harvest', title: 'They script it to grab everything', narrative: `By counting through IDs the attacker downloads ${ctx.dataLabel} for every user — no password needed.`, technique: 'Automated enumeration of all object IDs.', defence: 'Rate limiting + authorization + anomaly detection.', mitre: 'T1530', activate: ['data'], edge: 2 },
        { phase: 'Impact', title: 'A full data breach', narrative: 'What looked like a small bug becomes a complete leak of personal data — with breach-notification and compliance consequences.', technique: 'Bulk PII exfiltration.', defence: 'Authorization by default; monitor bulk access.', mitre: 'TA0010', activate: [], edge: 2 },
      ];
      return { nodes, edges, stages };
    },
  },
  'auth-bypass': {
    headline: 'Attacker gets in without valid credentials.',
    analogy: 'Like a locked door whose latch never actually catches — a gentle push and you\'re inside.',
    blastRadius: 'Whatever the bypassed login protects — often full application or admin access.',
    affects: ['Protected application areas', 'Admin / privileged functions', 'All data behind the login'],
    keyControl: 'Enforce authentication on every route server-side; fail closed; add MFA.',
    tactics: ['Initial Access', 'Defense Evasion', 'Privilege Escalation'],
    build: (ctx) => webChain(ctx, [
      { phase: 'Probe', title: 'Attacker tests the login logic', narrative: `The attacker examines how ${ctx.entryLabel} decides who is allowed in, looking for a step that can be skipped or fooled.`, technique: 'Analysing auth flow, tokens, and redirects.', defence: 'Centralised, well-tested auth.', mitre: 'T1078', activate: ['attacker', 'entry'], edge: 0 },
      { phase: 'Bypass', title: 'They skip the check', narrative: 'A missing or flawed check lets them walk straight past the login — by forcing a response, reusing a token, or hitting a page directly.', technique: 'Forced browsing / logic flaw / token forgery.', defence: 'Fail closed; verify on every request.', mitre: 'T1211', activate: ['app'], edge: 1 },
      { phase: 'Access', title: 'They land inside as a real user', narrative: `Now authenticated in the system's eyes, the attacker reaches ${ctx.dataLabel} and protected features.`, technique: 'Authenticated access without credentials.', defence: 'MFA, session validation, monitoring.', mitre: 'TA0001', activate: ['data'], edge: 2 },
      { phase: 'Impact', title: 'Full compromise', narrative: 'If the bypass reaches admin, the attacker controls the application and every account in it.', technique: 'Account takeover / admin compromise.', defence: 'Least privilege, alerting on new admin actions.', mitre: 'TA0004', activate: ['users'], edge: 3 },
    ]),
  },
  'secrets-exposure': {
    headline: 'A password or API key was left where anyone can find it.',
    analogy: 'Like writing the safe combination on a sticky note and leaving it on the front door.',
    blastRadius: 'Every system that key unlocks — cloud accounts, payment providers, databases.',
    affects: ['Cloud infrastructure and billing', 'Third-party services (email, payments, storage)', 'Customer data reachable with the key'],
    keyControl: 'Rotate the exposed secret now; use a secrets manager; scan commits pre-push.',
    tactics: ['Credential Access', 'Initial Access', 'Lateral Movement'],
    build: (ctx) => {
      const nodes = [
        A(),
        node('entry', ctx.entryLabel, 'entry', 0.3, 0.5, 1),
        node('key', 'Exposed secret', 'data', 0.52, 0.5, 2),
        node('cloud', 'Cloud / 3rd-party', 'external', 0.82, 0.28, 3),
        node('data', ctx.dataLabel, 'data', 0.82, 0.72, 4),
      ];
      const edges = [
        edge('attacker', 'entry', 1, 'clones / scans'),
        edge('entry', 'key', 2, 'finds key'),
        edge('key', 'cloud', 3, 'authenticates', 'lateral'),
        edge('cloud', 'data', 4, 'accesses', 'exfil'),
      ];
      const stages: Stage[] = [
        { phase: 'Discovery', title: 'Attacker finds the secret', narrative: `Automated scanners crawl ${ctx.entryLabel} constantly. A committed key or exposed config file is found within minutes of being published.`, technique: 'Secret scanning of public repos/endpoints.', defence: 'Pre-commit secret scanning; never commit secrets.', mitre: 'T1552.001', activate: ['attacker', 'entry', 'key'], edge: 0 },
        { phase: 'Use', title: 'They log in with it', narrative: 'The key is valid, so the attacker uses it exactly as your own systems would — no exploit required, no alarm raised.', technique: 'Valid-account access via leaked credential.', defence: 'Rotate + scope keys; alert on new locations.', mitre: 'T1078.004', activate: ['cloud'], edge: 2 },
        { phase: 'Expand', title: 'They reach connected systems', narrative: `A single key often unlocks more than expected — reaching ${ctx.dataLabel} and other services that trust it.`, technique: 'Lateral movement through trusted credentials.', defence: 'Least-privilege scopes; separate keys per service.', mitre: 'TA0008', activate: ['data'], edge: 3 },
        { phase: 'Impact', title: 'Cloud takeover or data theft', narrative: 'Attackers can spin up costly resources (crypto-mining), delete backups, or exfiltrate everything the key touches.', technique: 'Resource abuse, data theft, ransom.', defence: 'Billing alerts, immutable backups, scoped keys.', mitre: 'TA0040', activate: [], edge: 3 },
      ];
      return { nodes, edges, stages };
    },
  },
  reentrancy: {
    headline: 'Attacker tricks a smart contract into paying out over and over before it updates its books.',
    analogy: 'Like an ATM that hands you cash first and only then checks your balance — so you keep asking before it catches up.',
    blastRadius: 'The entire balance held by the vulnerable contract — potentially the whole protocol treasury.',
    affects: ['Funds locked in the contract', 'Every liquidity provider / depositor', 'Protocol solvency and token price'],
    keyControl: 'Checks-Effects-Interactions ordering + a reentrancy guard (update state before external calls).',
    tactics: ['Execution', 'Financial Theft'],
    build: (ctx) => {
      const nodes = [
        A(),
        node('mal', 'Malicious contract', 'contract', 0.3, 0.5, 1),
        node('victim', ctx.target, 'contract', 0.58, 0.5, 2),
        node('funds', ctx.dataLabel || 'Contract funds', 'funds', 0.86, 0.5, 3),
      ];
      const edges = [
        edge('attacker', 'mal', 1, 'deploys'),
        edge('mal', 'victim', 2, 'withdraw()'),
        edge('victim', 'mal', 3, 'sends funds → re-enters', 'attack'),
        edge('victim', 'funds', 3, 'drains', 'exfil'),
      ];
      const stages: Stage[] = [
        { phase: 'Setup', title: 'Attacker deploys a trap contract', narrative: 'The attacker writes their own smart contract whose only job is to call back into the victim the instant it receives money.', technique: 'Malicious fallback/receive function.', defence: 'Reentrancy guard on state-changing functions.', mitre: 'Execution', activate: ['attacker', 'mal'], edge: 0 },
        { phase: 'Trigger', title: 'They request a withdrawal', narrative: `The trap contract calls ${ctx.target}'s withdraw function to take out a small legitimate deposit.`, technique: 'Initial legitimate withdrawal call.', defence: 'Update balances before sending funds.', mitre: 'Execution', activate: ['victim'], edge: 1 },
        { phase: 'Re-entry', title: 'It calls back before the books update', narrative: 'The victim contract sends the money first and updates its records second. In that gap, the trap immediately calls withdraw again — and again — each time before the balance is zeroed.', technique: 'Recursive reentrant calls draining the balance.', defence: 'Checks-Effects-Interactions pattern.', mitre: 'Execution', activate: ['funds'], edge: 2 },
        { phase: 'Drain', title: 'The treasury is emptied', narrative: `Within a single transaction the contract is drained of ${ctx.dataLabel || 'its entire balance'}. Funds are gone and usually unrecoverable.`, technique: 'Full balance exfiltration; laundering via mixers.', defence: 'Guards + audits + monitoring + pause switch.', mitre: 'Impact', activate: [], edge: 3 },
      ];
      return { nodes, edges, stages };
    },
  },
  'access-control-contract': {
    headline: 'A sensitive contract function has no owner check — anyone can call it.',
    analogy: 'Like a bank vault with a big red "empty the vault" button that has no lock on it.',
    blastRadius: 'Whatever the unprotected function controls — funds, minting, ownership, or a kill switch.',
    affects: ['Protocol funds and treasury', 'Token supply / ownership', 'Every user relying on the contract'],
    keyControl: 'Add access-control modifiers (onlyOwner / role checks) to every privileged function.',
    tactics: ['Privilege Escalation', 'Financial Theft'],
    build: (ctx) => {
      const nodes = [
        A(),
        node('fn', 'Unprotected function', 'entry', 0.34, 0.5, 1),
        node('victim', ctx.target, 'contract', 0.6, 0.5, 2),
        node('funds', ctx.dataLabel || 'Funds / ownership', 'funds', 0.88, 0.5, 3),
      ];
      const edges = [
        edge('attacker', 'fn', 1, 'calls directly'),
        edge('fn', 'victim', 2, 'no modifier'),
        edge('victim', 'funds', 3, 'seizes', 'exfil'),
      ];
      const stages: Stage[] = [
        { phase: 'Recon', title: 'Attacker reads the public code', narrative: 'All contract code is public on-chain. The attacker spots a powerful function — like withdraw, mint, or setOwner — that lacks an access check.', technique: 'Source review of deployed bytecode/ABI.', defence: 'Access-control modifiers on every privileged call.', mitre: 'Discovery', activate: ['attacker', 'fn'], edge: 0 },
        { phase: 'Invoke', title: 'They just call it', narrative: `Because there is no "only the owner may do this" check, the attacker calls the function on ${ctx.target} straight from their own wallet.`, technique: 'Direct privileged-function invocation.', defence: 'Fail closed; test authorization paths.', mitre: 'Privilege Escalation', activate: ['victim'], edge: 1 },
        { phase: 'Seize', title: 'They take control or funds', narrative: `The function does exactly what it was built to do — but for the attacker: transferring ${ctx.dataLabel || 'funds'}, minting tokens, or making themselves the owner.`, technique: 'Ownership takeover / fund transfer / mint.', defence: 'Multi-sig ownership, timelocks, audits.', mitre: 'Impact', activate: ['funds'], edge: 2 },
        { phase: 'Impact', title: 'Protocol compromised', narrative: 'The protocol can be drained or hijacked in one transaction, collapsing user trust and token value.', technique: 'Irreversible on-chain theft.', defence: 'Guardrails + monitoring + emergency pause.', mitre: 'Impact', activate: [], edge: 2 },
      ];
      return { nodes, edges, stages };
    },
  },
  'oracle-manipulation': {
    headline: 'Attacker fakes a price feed to trade against the protocol at a rigged rate.',
    analogy: 'Like bribing the referee to call the score however you like, then collecting the winnings.',
    blastRadius: 'Any protocol logic that trusts the manipulated price — lending, swaps, liquidations.',
    affects: ['Lending / trading pools', 'Collateral and liquidations', 'Protocol solvency'],
    keyControl: 'Use tamper-resistant price oracles (TWAP / multiple sources); never a single spot price.',
    tactics: ['Execution', 'Financial Theft'],
    build: (ctx) => {
      const nodes = [
        A(),
        node('flash', 'Flash loan', 'external', 0.28, 0.3, 1),
        node('oracle', 'Price oracle', 'system', 0.5, 0.5, 2),
        node('victim', ctx.target, 'contract', 0.72, 0.5, 3),
        node('funds', ctx.dataLabel || 'Pool funds', 'funds', 0.92, 0.5, 4),
      ];
      const edges = [
        edge('attacker', 'flash', 1, 'borrows big'),
        edge('flash', 'oracle', 2, 'skews price'),
        edge('oracle', 'victim', 3, 'feeds fake price'),
        edge('victim', 'funds', 4, 'mispriced trade', 'exfil'),
      ];
      const stages: Stage[] = [
        { phase: 'Fund', title: 'Attacker borrows a huge sum', narrative: 'Using a flash loan the attacker temporarily controls millions in capital — with no collateral, repaid in the same transaction.', technique: 'Flash loan to gain market-moving size.', defence: 'Design assuming any actor can be whale-sized.', mitre: 'Resource Development', activate: ['attacker', 'flash'], edge: 0 },
        { phase: 'Skew', title: 'They distort the price feed', narrative: `They dump the borrowed funds into the pool the protocol reads its price from, pushing the reported price far from reality.`, technique: 'Manipulating a spot-price source.', defence: 'TWAP / multi-source oracles resist single-block skew.', mitre: 'Execution', activate: ['oracle'], edge: 1 },
        { phase: 'Exploit', title: 'They trade at the rigged price', narrative: `${ctx.target} trusts the fake price and lets the attacker borrow, swap, or liquidate at terms hugely in their favour.`, technique: 'Undercollateralised borrow / arbitrage.', defence: 'Price sanity bounds, circuit breakers.', mitre: 'Execution', activate: ['victim', 'funds'], edge: 2 },
        { phase: 'Profit', title: 'They repay the loan and keep the difference', narrative: 'The flash loan is repaid within the same transaction; the attacker walks away with the protocol\'s funds as pure profit.', technique: 'Atomic profit extraction.', defence: 'Robust oracles are the only real fix.', mitre: 'Impact', activate: [], edge: 3 },
      ];
      return { nodes, edges, stages };
    },
  },
  'resource-exhaustion': {
    headline: 'Under enough load the system slows to a crawl or falls over.',
    analogy: 'Like a checkout with one till: fine at 10 customers, chaos at 500 — the queue never clears.',
    blastRadius: 'All users of the service during peak demand or a targeted flood.',
    affects: ['Availability for every user', 'Revenue during the outage', 'SLA / uptime commitments'],
    keyControl: 'Autoscaling + rate limiting + load testing to a known breaking point, with graceful degradation.',
    tactics: ['Impact'],
    build: (ctx) => {
      const nodes = [
        node('load', 'Traffic surge', 'attacker', 0.08, 0.5, 0),
        node('lb', ctx.entryLabel || 'Load balancer', 'entry', 0.3, 0.5, 1),
        node('app', ctx.target, 'system', 0.55, 0.5, 2),
        node('db', 'Datastore / pool', 'data', 0.82, 0.3, 3),
        node('users', 'All users', 'user', 0.82, 0.72, 4),
      ];
      const edges = [
        edge('load', 'lb', 1, 'spike in requests'),
        edge('lb', 'app', 2, 'saturates workers'),
        edge('app', 'db', 3, 'connection pool full', 'lateral'),
        edge('app', 'users', 4, 'timeouts', 'lateral'),
      ];
      const stages: Stage[] = [
        { phase: 'Baseline', title: 'Everything is fine at normal load', narrative: `At everyday traffic ${ctx.target} responds quickly and comfortably.`, technique: 'Nominal throughput within capacity.', defence: 'Know your headroom via load testing.', mitre: 'n/a', activate: ['lb', 'app'], edge: undefined },
        { phase: 'Surge', title: 'Traffic climbs past the safe limit', narrative: 'A marketing spike — or a deliberate flood — pushes requests beyond what the system was tuned for. Response times start to climb.', technique: 'Concurrency beyond tested capacity.', defence: 'Autoscaling + rate limiting + queueing.', mitre: 'T1499', activate: ['load'], edge: 0 },
        { phase: 'Saturation', title: 'A bottleneck maxes out', narrative: `A single resource — the database connection pool, CPU, or memory — hits 100%. Requests pile up waiting for it.`, technique: 'Resource contention / pool exhaustion.', defence: 'Bounded pools, backpressure, circuit breakers.', mitre: 'T1499.003', activate: ['db'], edge: 2 },
        { phase: 'Collapse', title: 'The service becomes unusable', narrative: 'Timeouts cascade, healthy requests fail alongside the flood, and every user sees errors. Recovery may need a manual restart.', technique: 'Cascading failure / brownout.', defence: 'Graceful degradation, load shedding, autoscale.', mitre: 'T1499', activate: ['users'], edge: 3 },
      ];
      return { nodes, edges, stages };
    },
  },
  dos: {
    headline: 'Attacker floods or crashes the service so real users can\'t get in.',
    analogy: 'Like a hundred fake callers jamming a phone line so genuine customers never get through.',
    blastRadius: 'The whole service for the duration of the attack.',
    affects: ['Every user (total outage)', 'Revenue and reputation', 'On-call / incident cost'],
    keyControl: 'Upstream DDoS protection + rate limiting + fixing the amplifying bug.',
    tactics: ['Impact'],
    build: (ctx) => {
      const nodes = [
        node('bots', 'Flood / bad input', 'attacker', 0.08, 0.5, 0),
        node('edge', ctx.entryLabel || 'Edge / endpoint', 'entry', 0.34, 0.5, 1),
        node('app', ctx.target, 'system', 0.62, 0.5, 2),
        node('users', 'Real users', 'user', 0.9, 0.5, 3),
      ];
      const edges = [
        edge('bots', 'edge', 1, 'overwhelms'),
        edge('edge', 'app', 2, 'exhausts resources'),
        edge('app', 'users', 3, 'blocked', 'lateral'),
      ];
      const stages: Stage[] = [
        { phase: 'Prep', title: 'Attacker finds the cheap-to-hit weak spot', narrative: `They locate a request to ${ctx.target} that costs them almost nothing to send but forces the server to do a lot of work.`, technique: 'Asymmetric / amplification vector, or botnet.', defence: 'Rate limits, input caps, cost analysis.', mitre: 'T1499', activate: ['bots', 'edge'], edge: 0 },
        { phase: 'Flood', title: 'They send it at massive scale', narrative: 'A flood of these requests (often from many machines) hits the service faster than it can cope.', technique: 'Volumetric / application-layer DDoS.', defence: 'Upstream scrubbing + WAF + autoscale.', mitre: 'T1498', activate: ['app'], edge: 1 },
        { phase: 'Outage', title: 'The service goes dark', narrative: 'Legitimate users get errors or timeouts. The business is effectively offline until the flood is filtered or the bug fixed.', technique: 'Denial of service.', defence: 'DDoS protection, load shedding, incident runbook.', mitre: 'T1498', activate: ['users'], edge: 2 },
      ];
      return { nodes, edges, stages };
    },
  },
  phishing: {
    headline: 'Attacker tricks a staff member into handing over their login.',
    analogy: 'Like a fake toll booth on your usual road — it looks official, so you hand over your card without thinking.',
    blastRadius: 'Everything the phished employee can access — and often more via their trust.',
    affects: ['The employee\'s accounts and mailbox', 'Internal systems they can reach', 'Colleagues and customers they can reach'],
    keyControl: 'Phishing-resistant MFA (passkeys/FIDO2) + email authentication (SPF/DKIM/DMARC) + training.',
    tactics: ['Initial Access', 'Credential Access', 'Lateral Movement'],
    build: (ctx) => {
      const nodes = [
        A(),
        node('mail', 'Phishing email', 'entry', 0.28, 0.3, 1),
        node('victim', 'Employee', 'user', 0.5, 0.5, 2),
        node('sso', ctx.entryLabel || 'Corporate login', 'system', 0.72, 0.5, 3),
        node('data', ctx.dataLabel || 'Internal systems', 'data', 0.92, 0.5, 4),
      ];
      const edges = [
        edge('attacker', 'mail', 1, 'sends lure'),
        edge('mail', 'victim', 2, 'is opened'),
        edge('victim', 'sso', 3, 'enters password', 'lateral'),
        edge('sso', 'data', 4, 'attacker logs in', 'exfil'),
      ];
      const stages: Stage[] = [
        { phase: 'Lure', title: 'A convincing message arrives', narrative: 'The attacker sends an email or message that looks like it\'s from IT, a supplier, or a colleague, creating urgency ("your account will be locked").', technique: 'Spear-phishing with spoofed branding.', defence: 'DMARC, banner warnings, reporting button.', mitre: 'T1566', activate: ['attacker', 'mail'], edge: 0 },
        { phase: 'Hook', title: 'The employee enters their password', narrative: `The link leads to a pixel-perfect fake of ${ctx.entryLabel || 'the login page'}. The employee types their credentials straight to the attacker.`, technique: 'Credential-harvesting page / real-time proxy.', defence: 'Passkeys/FIDO2 can\'t be phished this way.', mitre: 'T1056', activate: ['victim', 'sso'], edge: 2 },
        { phase: 'Access', title: 'The attacker logs in as them', narrative: `With valid credentials (and a stolen MFA code if used) the attacker signs in and reaches ${ctx.dataLabel || 'internal systems'}.`, technique: 'Valid-account access; MFA fatigue.', defence: 'Phishing-resistant MFA; impossible-travel alerts.', mitre: 'T1078', activate: ['data'], edge: 3 },
        { phase: 'Spread', title: 'They use that trust to go further', narrative: 'From inside, the attacker phishes colleagues, reads sensitive mail, or launches invoice fraud — all wearing the employee\'s identity.', technique: 'Internal phishing, BEC, lateral movement.', defence: 'Least privilege, monitoring, verification.', mitre: 'TA0008', activate: [], edge: 3 },
      ];
      return { nodes, edges, stages };
    },
  },
  'supply-chain': {
    headline: 'Attacker poisons a dependency or build step you already trust.',
    analogy: 'Like a factory that tampers with an ingredient — every product made after that is contaminated, but looks normal.',
    blastRadius: 'Every system that builds or ships with the poisoned component — potentially all environments.',
    affects: ['Your build pipeline and releases', 'Production and every customer of the release', 'Anything the malicious code can reach'],
    keyControl: 'Pin & verify dependencies (lockfiles, checksums), least-privilege CI, and SBOM review.',
    tactics: ['Initial Access', 'Execution', 'Persistence'],
    build: (ctx) => {
      const nodes = [
        A(),
        node('pkg', 'Dependency / CI step', 'external', 0.3, 0.5, 1),
        node('build', ctx.entryLabel || 'Build pipeline', 'system', 0.55, 0.5, 2),
        node('prod', ctx.target, 'system', 0.8, 0.32, 3),
        node('data', ctx.dataLabel || 'Prod data & users', 'data', 0.9, 0.74, 4),
      ];
      const edges = [
        edge('attacker', 'pkg', 1, 'poisons package'),
        edge('pkg', 'build', 2, 'pulled in'),
        edge('build', 'prod', 3, 'shipped', 'lateral'),
        edge('prod', 'data', 4, 'steals / backdoors', 'exfil'),
      ];
      const stages: Stage[] = [
        { phase: 'Poison', title: 'Attacker compromises something you import', narrative: 'They slip malicious code into a third-party package, a compromised CI action, or a typosquatted dependency name.', technique: 'Malicious package / dependency confusion.', defence: 'Pin versions, verify checksums, vet actions.', mitre: 'T1195.001', activate: ['attacker', 'pkg'], edge: 0 },
        { phase: 'Build', title: 'Your pipeline pulls it in', narrative: `${ctx.entryLabel || 'The build'} fetches the poisoned component and bundles it into your application — automatically, with full trust.`, technique: 'Trusted-dependency execution in CI.', defence: 'Lockfiles, isolated runners, SBOM.', mitre: 'T1195.002', activate: ['build'], edge: 1 },
        { phase: 'Ship', title: 'It reaches production', narrative: `The tainted build is deployed to ${ctx.target}. Everything looks normal — the malicious behaviour is hidden.`, technique: 'Backdoor in shipped artifact.', defence: 'Reproducible builds, artifact signing.', mitre: 'T1554', activate: ['prod'], edge: 2 },
        { phase: 'Impact', title: 'Attacker acts everywhere it runs', narrative: `The code quietly steals secrets, exfiltrates ${ctx.dataLabel || 'data'}, or opens a backdoor across every environment running the release.`, technique: 'Mass compromise via trusted channel.', defence: 'Egress monitoring, least privilege, rotation.', mitre: 'TA0010', activate: ['data'], edge: 3 },
      ];
      return { nodes, edges, stages };
    },
  },
  mitm: {
    headline: 'Attacker sits between users and the server, reading and altering traffic.',
    analogy: 'Like a dishonest translator relaying your conversation — quietly changing words and remembering your secrets.',
    blastRadius: 'Everyone on the shared/compromised network path.',
    affects: ['Credentials and session tokens in transit', 'The integrity of data exchanged', 'Any user on the same network'],
    keyControl: 'Enforce TLS everywhere (HSTS), validate certificates, and pin where feasible.',
    tactics: ['Collection', 'Credential Access'],
    build: (ctx) => {
      const nodes = [
        node('victim', 'User', 'user', 0.08, 0.5, 0),
        node('mitm', 'Attacker (in the middle)', 'attacker', 0.4, 0.3, 1),
        node('server', ctx.target, 'system', 0.72, 0.5, 2),
        node('data', ctx.dataLabel || 'Credentials in transit', 'data', 0.92, 0.7, 3),
      ];
      const edges = [
        edge('victim', 'mitm', 1, 'traffic intercepted'),
        edge('mitm', 'server', 2, 'relays (altered)'),
        edge('mitm', 'data', 3, 'captures', 'exfil'),
      ];
      const stages: Stage[] = [
        { phase: 'Position', title: 'Attacker gets onto the path', narrative: 'On shared Wi-Fi, a compromised router, or via DNS/ARP tricks, the attacker places themselves between the user and the server.', technique: 'ARP/DNS spoofing, rogue AP, SSL strip.', defence: 'HSTS, TLS everywhere, cert validation.', mitre: 'T1557', activate: ['victim', 'mitm'], edge: 0 },
        { phase: 'Intercept', title: 'They read the traffic', narrative: `Because traffic to ${ctx.target} isn't properly encrypted (or certs aren't checked), the attacker sees usernames, passwords and data in the clear.`, technique: 'Passive capture of cleartext / stripped TLS.', defence: 'Encrypt in transit; reject invalid certs.', mitre: 'T1040', activate: ['server', 'data'], edge: 1 },
        { phase: 'Tamper', title: 'They can change it too', narrative: 'The attacker can also alter responses — injecting content, redirecting payments, or swapping wallet addresses — without either side noticing.', technique: 'Active on-path modification.', defence: 'Integrity via TLS + signing.', mitre: 'T1565', activate: [], edge: 2 },
      ];
      return { nodes, edges, stages };
    },
  },
  'weak-crypto': {
    headline: 'Weak or misused cryptography can be broken to reveal protected data.',
    analogy: 'Like a diary "locked" with a code a child could guess — the lock is there, but it doesn\'t hold.',
    blastRadius: 'All data protected by the weak algorithm — stored or in transit.',
    affects: ['Stored passwords / sensitive fields', 'Encrypted traffic', 'Regulated data requiring strong crypto'],
    keyControl: 'Use modern algorithms (AES-GCM, Argon2/bcrypt, TLS 1.2+), strong keys, and secure randomness.',
    tactics: ['Credential Access', 'Collection'],
    build: (ctx) => {
      const nodes = [
        A(),
        node('cipher', 'Weak algorithm', 'system', 0.34, 0.5, 1),
        node('data', ctx.dataLabel || 'Protected data', 'data', 0.64, 0.5, 2),
        node('plain', 'Plaintext secrets', 'data', 0.9, 0.5, 3),
      ];
      const edges = [
        edge('attacker', 'cipher', 1, 'obtains ciphertext'),
        edge('cipher', 'data', 2, 'cracks / bypasses'),
        edge('data', 'plain', 3, 'recovers', 'exfil'),
      ];
      const stages: Stage[] = [
        { phase: 'Obtain', title: 'Attacker gets the protected data', narrative: `Through a breach, backup, or captured traffic, the attacker obtains data that ${ctx.target} "protected" with weak crypto.`, technique: 'Access to ciphertext/hashes.', defence: 'Defence in depth so crypto isn\'t the only wall.', mitre: 'T1552', activate: ['attacker', 'cipher'], edge: 0 },
        { phase: 'Break', title: 'They break the weak protection', narrative: 'Outdated algorithms (MD5, SHA1, DES) or predictable keys let the attacker reverse the "encryption" cheaply — sometimes with a lookup table.', technique: 'Hash cracking, known-plaintext, rainbow tables.', defence: 'Argon2/bcrypt with salt; modern ciphers.', mitre: 'T1110.002', activate: ['data'], edge: 1 },
        { phase: 'Reveal', title: 'Secrets are exposed', narrative: `The "protected" ${ctx.dataLabel || 'data'} — passwords, tokens, personal data — is now readable, undoing the entire point of encrypting it.`, technique: 'Plaintext recovery.', defence: 'Strong crypto + key management.', mitre: 'TA0006', activate: ['plain'], edge: 2 },
      ];
      return { nodes, edges, stages };
    },
  },
  misconfiguration: {
    headline: 'A careless setting leaves a door open that was never meant to be.',
    analogy: 'Like moving into a new office and never changing the locks or turning off the "everyone welcome" sign.',
    blastRadius: 'Whatever the misconfigured component exposes — sometimes an entire database or bucket.',
    affects: ['Exposed data stores or admin panels', 'Users whose data sits behind it', 'Overall attack surface'],
    keyControl: 'Harden by default; review configs; scan continuously; remove unused exposure.',
    tactics: ['Initial Access', 'Discovery'],
    build: (ctx) => webChain(ctx, [
      { phase: 'Scan', title: 'Attacker scans for loose settings', narrative: `Automated tools sweep the internet for exposed services. They flag ${ctx.entryLabel} because of a permissive or default configuration.`, technique: 'Internet-wide scanning (Shodan-style).', defence: 'Minimise exposure; secure defaults.', mitre: 'T1595', activate: ['attacker', 'entry'], edge: 0 },
      { phase: 'Access', title: 'They walk through the open door', narrative: 'A missing auth requirement, an open bucket, an exposed admin panel, or over-permissive CORS lets them access what should be private.', technique: 'Exploiting the misconfiguration directly.', defence: 'Least privilege; deny by default.', mitre: 'T1190', activate: ['app'], edge: 1 },
      { phase: 'Collect', title: 'They take what they find', narrative: `Behind the open door sits ${ctx.dataLabel} — read, copied, or modified with little effort.`, technique: 'Data access / config abuse.', defence: 'Config auditing + monitoring.', mitre: 'T1530', activate: ['data'], edge: 2 },
      { phase: 'Impact', title: 'Small mistake, large consequence', narrative: 'Misconfigurations are among the most common breach causes precisely because they\'re easy to make and easy for attackers to find.', technique: 'Breach via exposure.', defence: 'Continuous posture management.', mitre: 'TA0010', activate: ['users'], edge: 3 },
    ]),
  },
  'outdated-component': {
    headline: 'A known bug in old software has a ready-made exploit anyone can run.',
    analogy: 'Like a lock with a famous flaw printed in every burglar\'s handbook — and you never replaced it.',
    blastRadius: 'Every system still running the vulnerable version.',
    affects: ['The unpatched service', 'Data and systems it protects', 'Anything reachable after exploitation'],
    keyControl: 'Keep dependencies current; track CVEs; patch on a schedule; remove EOL software.',
    tactics: ['Initial Access', 'Execution'],
    build: (ctx) => webChain(ctx, [
      { phase: 'Fingerprint', title: 'Attacker identifies the version', narrative: `The attacker checks ${ctx.entryLabel} and sees it runs an old version of a component with a publicly known vulnerability.`, technique: 'Version fingerprinting.', defence: 'Hide versions; patch promptly.', mitre: 'T1595.002', activate: ['attacker', 'entry'], edge: 0 },
      { phase: 'Exploit', title: 'They run the public exploit', narrative: 'A working exploit already exists — often copy-paste. No skill required; the hard work was done and published for them.', technique: 'Exploiting a known CVE (n-day).', defence: 'Patch before exploits are weaponised.', mitre: 'T1203', activate: ['app'], edge: 1 },
      { phase: 'Take', title: 'They gain access', narrative: `Depending on the bug, the attacker reads ${ctx.dataLabel}, runs code, or takes over the service entirely.`, technique: 'Outcome depends on the CVE (RCE, disclosure…).', defence: 'Defence in depth + monitoring.', mitre: 'TA0002', activate: ['data'], edge: 2 },
      { phase: 'Impact', title: 'Avoidable compromise', narrative: 'Because the fix already existed, this class of breach is entirely preventable with timely patching.', technique: 'n-day compromise.', defence: 'Patch management + SBOM.', mitre: 'TA0040', activate: ['users'], edge: 3 },
    ]),
  },
  'business-logic': {
    headline: 'Attacker abuses the rules of your app in ways you didn\'t intend.',
    analogy: 'Like finding that "buy one get one free" also works with a quantity of minus one — so the shop pays you.',
    blastRadius: 'The financial or workflow logic being abused — often directly monetary.',
    affects: ['Revenue and pricing integrity', 'Order / account workflows', 'Trust in the platform'],
    keyControl: 'Validate business rules server-side; enforce invariants; test abuse cases, not just happy paths.',
    tactics: ['Execution', 'Financial Theft'],
    build: (ctx) => webChain(ctx, [
      { phase: 'Explore', title: 'Attacker maps how the feature works', narrative: `They use ${ctx.target} normally, watching each step of the workflow and every value the app trusts from the client.`, technique: 'Workflow analysis and value tampering.', defence: 'Never trust client-side values.', mitre: 'T1592', activate: ['attacker', 'entry'], edge: 0 },
      { phase: 'Bend', title: 'They break an unstated assumption', narrative: 'They send a negative quantity, replay a one-time discount, skip a payment step, or reorder actions — things the code never expected but doesn\'t forbid.', technique: 'Logic-flaw abuse (no injection needed).', defence: 'Enforce invariants server-side.', mitre: 'T1190', activate: ['app'], edge: 1 },
      { phase: 'Profit', title: 'They gain value unfairly', narrative: `The flaw yields free goods, inflated balances, or bypassed limits affecting ${ctx.dataLabel} — repeatable and often scriptable.`, technique: 'Automated abuse of the logic flaw.', defence: 'Rate limits, reconciliation, alerts.', mitre: 'TA0040', activate: ['data'], edge: 2 },
      { phase: 'Impact', title: 'Quiet, ongoing losses', narrative: 'Logic flaws rarely trip security alarms, so they can bleed money or corrupt data for a long time before anyone notices.', technique: 'Sustained financial/integrity damage.', defence: 'Business-rule monitoring & anomaly detection.', mitre: 'TA0040', activate: ['users'], edge: 3 },
    ]),
  },
  'open-port': {
    headline: 'A service that should be private is reachable from the internet.',
    analogy: 'Like leaving a side door to the server room propped open onto a public street.',
    blastRadius: 'The exposed service and anything it grants access to.',
    affects: ['The exposed database/admin/service', 'Data it holds', 'The internal network beyond it'],
    keyControl: 'Firewall to least exposure; put admin behind VPN; authenticate every service.',
    tactics: ['Reconnaissance', 'Initial Access'],
    build: (ctx) => {
      const nodes = [
        A(),
        node('port', ctx.entryLabel || 'Exposed service', 'entry', 0.34, 0.5, 1),
        node('host', ctx.target, 'system', 0.6, 0.5, 2),
        node('net', 'Internal network', 'network', 0.88, 0.3, 3),
        node('data', ctx.dataLabel || 'Sensitive data', 'data', 0.88, 0.72, 3),
      ];
      const edges = [
        edge('attacker', 'port', 1, 'port scan'),
        edge('port', 'host', 2, 'connects'),
        edge('host', 'net', 3, 'pivots', 'lateral'),
        edge('host', 'data', 3, 'reads', 'exfil'),
      ];
      const stages: Stage[] = [
        { phase: 'Scan', title: 'Attacker port-scans the range', narrative: 'The internet is scanned continuously. An exposed database, admin panel, or management port is found within hours of going live.', technique: 'Mass port scanning.', defence: 'Minimise exposed ports; firewall by default.', mitre: 'T1595.001', activate: ['attacker', 'port'], edge: 0 },
        { phase: 'Connect', title: 'They reach the service directly', narrative: `${ctx.entryLabel || 'The service'} answers from the open internet. If it also lacks authentication, they\'re straight in.`, technique: 'Direct connection to exposed service.', defence: 'VPN/bastion + authentication.', mitre: 'T1190', activate: ['host'], edge: 1 },
        { phase: 'Exploit', title: 'They read data or pivot inward', narrative: `From here the attacker accesses ${ctx.dataLabel || 'sensitive data'} or uses the host as a stepping stone into the internal network.`, technique: 'Data access / lateral movement.', defence: 'Segmentation + monitoring.', mitre: 'TA0008', activate: ['net', 'data'], edge: 2 },
      ];
      return { nodes, edges, stages };
    },
  },
  'cleartext-traffic': {
    headline: 'Sensitive data travels unencrypted and can be read off the wire.',
    analogy: 'Like mailing your passwords on the back of a postcard — anyone who handles it can read them.',
    blastRadius: 'Everyone on the network path between user and server.',
    affects: ['Credentials and data in transit', 'User sessions', 'Regulated data requiring encryption'],
    keyControl: 'Enforce TLS/HTTPS everywhere with HSTS; disable plaintext protocols.',
    tactics: ['Collection', 'Credential Access'],
    build: (ctx) => {
      const nodes = [
        node('user', 'User', 'user', 0.08, 0.5, 0),
        node('wire', ctx.entryLabel || 'Unencrypted channel', 'network', 0.38, 0.5, 1),
        node('attacker', 'Eavesdropper', 'attacker', 0.4, 0.16, 1),
        node('server', ctx.target, 'system', 0.72, 0.5, 2),
        node('data', ctx.dataLabel || 'Credentials', 'data', 0.92, 0.72, 3),
      ];
      const edges = [
        edge('user', 'wire', 1, 'sends in clear'),
        edge('attacker', 'wire', 1, 'listens'),
        edge('wire', 'server', 2, 'delivered'),
        edge('wire', 'data', 3, 'captured', 'exfil'),
      ];
      const stages: Stage[] = [
        { phase: 'Listen', title: 'Attacker taps the network', narrative: 'On shared Wi-Fi or a compromised network segment, the attacker passively records traffic — no interaction with the victim needed.', technique: 'Passive sniffing.', defence: 'Encrypt everything in transit.', mitre: 'T1040', activate: ['user', 'wire', 'attacker'], edge: 0 },
        { phase: 'Read', title: 'They read it in plain text', narrative: `Because ${ctx.target} sends ${ctx.dataLabel || 'credentials'} without encryption, everything is immediately readable — usernames, passwords, personal data.`, technique: 'Cleartext protocol capture.', defence: 'TLS 1.2+, HSTS, no HTTP fallback.', mitre: 'T1040', activate: ['server', 'data'], edge: 2 },
        { phase: 'Reuse', title: 'They reuse what they captured', narrative: 'Captured credentials and session tokens are replayed to log in as the victim, quietly and without triggering alarms.', technique: 'Credential/session replay.', defence: 'Encryption + token binding.', mitre: 'T1550', activate: [], edge: 3 },
      ];
      return { nodes, edges, stages };
    },
  },
};

// Family fallbacks for classes without a bespoke template.
const FAMILY: Record<string, AttackClass> = {
  'command-injection': 'rce', deserialization: 'rce', 'file-upload': 'rce',
  csrf: 'xss', ssrf: 'misconfiguration', xxe: 'misconfiguration', 'path-traversal': 'idor', 'info-disclosure': 'misconfiguration',
  'weak-credentials': 'auth-bypass', 'session-management': 'auth-bypass', 'jwt-flaw': 'auth-bypass', 'privilege-escalation': 'auth-bypass',
  'rate-limit': 'dos', 'race-condition': 'business-logic',
  'integer-overflow': 'access-control-contract', 'flash-loan': 'oracle-manipulation', 'front-running': 'oracle-manipulation',
  'unchecked-call': 'reentrancy', 'signature-replay': 'access-control-contract', upgradeability: 'access-control-contract', 'denial-of-service-contract': 'dos',
  'network-segmentation': 'open-port', 'lateral-movement': 'open-port', dns: 'mitm',
  'social-engineering': 'phishing', malware: 'supply-chain', insider: 'secrets-exposure',
};

export function templateFor(cls: AttackClass): { template: Template; usedClass: AttackClass } {
  if (T[cls]) return { template: T[cls]!, usedClass: cls };
  const fam = FAMILY[cls];
  if (fam && T[fam]) return { template: T[fam]!, usedClass: fam };
  return { template: GENERIC, usedClass: 'generic' };
}

const GENERIC: Template = {
  headline: 'Attacker exploits this weakness to reach data or systems they shouldn\'t.',
  analogy: 'Like finding one weak link in a chain — pull it, and what it was holding comes loose.',
  blastRadius: 'The affected component and the data or systems it protects.',
  affects: ['The vulnerable component', 'Data it can access', 'Connected systems'],
  keyControl: 'Fix the underlying weakness and add monitoring and least-privilege controls.',
  tactics: ['Initial Access', 'Impact'],
  build: (ctx) => webChain(ctx, [
    { phase: 'Discovery', title: 'Attacker finds the weakness', narrative: `The attacker probes ${ctx.entryLabel} and identifies the flaw.`, technique: 'Reconnaissance and testing.', defence: 'Reduce attack surface; validate input.', mitre: 'TA0043', activate: ['attacker', 'entry'], edge: 0 },
    { phase: 'Exploit', title: 'They take advantage of it', narrative: `They use the flaw to make ${ctx.target} behave in a way it shouldn't.`, technique: 'Exploitation of the vulnerability.', defence: 'Patch and harden.', mitre: 'TA0002', activate: ['app'], edge: 1 },
    { phase: 'Access', title: 'They reach protected assets', narrative: `This gives access to ${ctx.dataLabel}.`, technique: 'Unauthorised access.', defence: 'Least privilege + monitoring.', mitre: 'TA0009', activate: ['data'], edge: 2 },
    { phase: 'Impact', title: 'Damage follows', narrative: 'The consequences depend on what was reached — data loss, tampering, or downtime.', technique: 'Impact realisation.', defence: 'Defence in depth.', mitre: 'TA0040', activate: ['users'], edge: 3 },
  ]),
};
