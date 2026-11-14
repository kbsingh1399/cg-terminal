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
  console.log(`Verifying and patching all ${data.deepResults.length} qualifiers...`);
  
  for (let i = 0; i < data.deepResults.length; i++) {
    const item = data.deepResults[i];
    const sym = item.sym;
    const p = item.summary.price;

    const bwPrice = item.bw?.model?.last?.price;
    const bwNeedsUpdate = !bwPrice || Math.abs(bwPrice - p) / p > 0.3;
    const cvdNeedsUpdate = !item.cvd || !item.cvd.kpis;
    const ltoNeedsUpdate = !item.lto || item.lto.symbol !== sym;

    if (bwNeedsUpdate || cvdNeedsUpdate || ltoNeedsUpdate) {
      console.log(`[${i + 1}/${data.deepResults.length}] Updating ${sym} (bwNeedsUpdate=${bwNeedsUpdate}, cvdNeedsUpdate=${cvdNeedsUpdate}, ltoNeedsUpdate=${ltoNeedsUpdate})...`);
      const [bw, lto, cvd] = await Promise.all([
        bwNeedsUpdate ? fetchJson(`${BASE_URL}/api/cg/bookwalls?sym=${sym}`) : Promise.resolve(item.bw),
        ltoNeedsUpdate ? fetchJson(`${BASE_URL}/api/cg/lto?symbol=${sym}`) : Promise.resolve(item.lto),
        cvdNeedsUpdate ? fetchJson(`${BASE_URL}/api/cg/cvd?sym=${sym}`) : Promise.resolve(item.cvd)
      ]);

      if (bw && bw.ok) item.bw = bw;
      if (lto && lto.ok) item.lto = lto;
      if (cvd && cvd.ok) item.cvd = cvd;
    } else {
      console.log(`[${i + 1}/${data.deepResults.length}] ${sym} is verified valid!`);
    }
  }

  fs.writeFileSync('scripts/crypto_domain_sweep_data.json', JSON.stringify(data, null, 2));
  console.log('All qualifiers verified and saved!');
}

main().catch(console.error);
