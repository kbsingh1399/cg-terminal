import fs from 'node:fs';

const BASE_URL = 'http://127.0.0.1:3000';
const data = JSON.parse(fs.readFileSync('scripts/crypto_domain_sweep_data.json', 'utf8'));

async function fetchJson(url, timeoutMs = 8000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(id);
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    clearTimeout(id);
    return null;
  }
}

async function main() {
  console.log(`Patching bookwalls and lto for ${data.deepResults.length} qualifiers...`);
  
  for (let i = 0; i < data.deepResults.length; i++) {
    const item = data.deepResults[i];
    const sym = item.sym;
    console.log(`[${i + 1}/${data.deepResults.length}] Fetching bw & lto for ${sym}...`);
    
    const [bw, lto] = await Promise.all([
      fetchJson(`${BASE_URL}/api/cg/bookwalls?sym=${sym}`),
      fetchJson(`${BASE_URL}/api/cg/lto?symbol=${sym}`)
    ]);

    if (bw && bw.ok) {
      item.bw = bw;
    }
    if (lto && lto.ok) {
      item.lto = lto;
    }
  }

  fs.writeFileSync('scripts/crypto_domain_sweep_data.json', JSON.stringify(data, null, 2));
  console.log('Successfully updated scripts/crypto_domain_sweep_data.json with accurate per-asset bookwalls and LTO!');
}

main().catch(console.error);
