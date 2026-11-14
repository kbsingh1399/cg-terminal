import fs from 'node:fs';

const BASE_URL = 'http://127.0.0.1:3000';
const data = JSON.parse(fs.readFileSync('scripts/crypto_domain_sweep_data.json', 'utf8'));

async function fetchJson(url, timeoutMs = 10000) {
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
  console.log(`Patching CVD for ${data.deepResults.length} qualifiers...`);
  const concurrency = 4;
  for (let i = 0; i < data.deepResults.length; i += concurrency) {
    const chunk = data.deepResults.slice(i, i + concurrency);
    await Promise.all(
      chunk.map(async (item) => {
        const cvd = await fetchJson(`${BASE_URL}/api/cg/cvd?sym=${item.sym}`);
        if (cvd && cvd.ok) {
          item.cvd = cvd;
          console.log(`Fetched CVD for ${item.sym}: kpis=${!!cvd.kpis}, divs=${cvd.divergences?.length || 0}`);
        }
      })
    );
  }

  fs.writeFileSync('scripts/crypto_domain_sweep_data.json', JSON.stringify(data, null, 2));
  console.log('Successfully updated CVD in scripts/crypto_domain_sweep_data.json!');
}

main().catch(console.error);
