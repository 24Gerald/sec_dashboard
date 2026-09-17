#!/usr/bin/env node
/**
 * Example SOC bot: the always-on agent that watches the system and reports issues.
 * This is a reference implementation — replace the `collect()` function with real
 * detections (log tailing, IDS alerts, scanner output, on-chain watchers, etc).
 *
 *   npm run soc:demo                       # send a few sample events
 *   API=http://localhost:8787 TOKEN=xyz node tools/soc-agent-example.js --watch
 */
const API = process.env.API || 'http://localhost:8787';
const TOKEN = process.env.TOKEN || process.env.INGEST_TOKEN || 'ark-dev-token';
const WATCH = process.argv.includes('--watch');

// Replace this with real detection logic.
function collect() {
  const samples = [
    { severity: 'high', category: 'auth', source: 'auth-service', rule: 'BRUTE_FORCE', title: 'Repeated failed logins for admin', message: '38 failed logins for user "admin" from 3 IPs in 5 minutes.', asset: 'ARK-A-2026-0001' },
    { severity: 'medium', category: 'anomaly', source: 'edge-waf', rule: 'SQLI_PROBE', title: 'SQL injection probing on /api/search', message: "Blocked 12 requests containing SQL metacharacters against /api/search." },
    { severity: 'critical', category: 'on-chain', source: 'chain-watcher', rule: 'LARGE_WITHDRAWAL', title: 'Unusual withdrawal from staking vault', message: 'Single-tx withdrawal of 480 ETH from Vault, 30x the daily average.', asset: 'ARK-A-2026-0004', promote: true, tags: ['on-chain', 'anomaly'], attack: { class: 'reentrancy' } },
    { severity: 'low', category: 'config-drift', source: 'posture-scan', rule: 'S3_PUBLIC', title: 'New public storage bucket detected', message: 'Bucket "ark-media-cache" became publicly readable.' },
  ];
  return [samples[Math.floor(Math.random() * samples.length)]];
}

async function send(events) {
  const res = await fetch(`${API}/api/ingest`, { method: 'POST', headers: { 'content-type': 'application/json', 'X-Ingest-Token': TOKEN }, body: JSON.stringify({ events }) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) { console.error(`✗ ${res.status}`, json.error || ''); return; }
  console.log(`→ ingested ${json.ingested} event(s): ${(json.ids || []).join(', ')}`);
}

async function main() {
  try { const h = await fetch(`${API}/api/health`); if (!h.ok) throw 0; } catch { console.error(`✗ Authoring server not reachable at ${API}. Run "npm run server" first.`); process.exit(1); }
  if (WATCH) {
    console.log(`SOC bot watching → ${API} (every 15s). Ctrl-C to stop.`);
    const tick = async () => send(collect());
    await tick();
    setInterval(tick, 15000);
  } else {
    console.log('SOC bot demo — sending a batch of sample events.');
    await send([
      { severity: 'high', category: 'auth', source: 'auth-service', rule: 'BRUTE_FORCE', title: 'Repeated failed logins for admin', message: '38 failed logins for user "admin" from 3 IPs in 5 minutes.' },
      { severity: 'medium', category: 'vuln-scan', source: 'nightly-scan', rule: 'OUTDATED_DEP', title: 'Outdated dependency with known CVE', message: 'lodash@4.17.11 has CVE-2021-23337 (command injection).' },
      { severity: 'critical', category: 'on-chain', source: 'chain-watcher', rule: 'ANOMALOUS_WITHDRAWAL', title: 'Anomalous withdrawal from staking vault', message: 'Single-tx withdrawal 30x the daily average from the staking vault.', promote: true, tags: ['on-chain'], attack: { class: 'reentrancy' }, affected: { contract: 'StakingVault.sol' } },
    ]);
  }
}
main();
