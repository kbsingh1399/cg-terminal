const fs = require('fs');
const d = JSON.parse(fs.readFileSync('scripts/deep_telemetry_360.json'));

console.log('=== BTC KEY LIQUIDATION LEVELS ABOVE ===');
console.log(JSON.stringify(d.BTC?.liq?.stats?.keyLevels?.above, null, 2));

console.log('=== BTC KEY LIQUIDATION LEVELS BELOW ===');
console.log(JSON.stringify(d.BTC?.liq?.stats?.keyLevels?.below, null, 2));

console.log('=== BTC TOP CONFIRMED WALLS ===');
for (const w of (d.BTC?.walls?.model?.walls || []).slice(0, 10)) {
  console.log(w.side.toUpperCase() + ' @ ' + w.price + ': $' + (w.notional/1e6).toFixed(2) + 'M | age: ' + (w.ageMin ? w.ageMin.toFixed(0) : 0) + 'm | touches: ' + (w.touches || 0));
}

console.log('=== BTC MARKET VWAP ===');
console.log(JSON.stringify(d.BTC?.mkt?.vwap, null, 2));
