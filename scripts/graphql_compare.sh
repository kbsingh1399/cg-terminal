#!/bin/bash
# Query getTrader for comparison wallets via page-context fetch (auto session)
QUERY='query($address:String!){getTrader(address:$address){address label verified tag pnl perpsEquity winrate winrateLifetime winrate30d totalTrades trades7d trades30d totalLongTrades totalShortTrades totalWinningTrades totalLosingTrades sharpe sharpe30d sortino30d drawdown drawdown30d drawdown180d pnlCohort sizeCohort copyScoreV2}}'
for ADDR in "0x023a3d058020fb76cca98f01b3c48c8938a22355" "0xf5d81a135f756ca16544e53c20fc20643ec3ad53" "0xfc667adba8d4837586078f4fdcdc29804337ca06" "0x0c4926daf1250b8da7b9fc339f304d923b94d346" "0x091144e651b334341eabdbbbfed644ad0100023e" "0x7be1cba648ebe1ab8084244d23f28d68a86480d8" "0x7ab80d2c05e5ed068454f4a7553047c8d0ff8136" "0xd89e1de57f0495550e8030397834471b9e71949c" "0xb640e18c1ef6cf37b23fe8cfe4961d023c88a3de" "0x020ca66c30bec2c4fe3861a94e4db4a498a35872"; do
  agent-browser eval "fetch('https://api.hyperdash.com/graphql',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query:\`$QUERY\`,variables:{address:'$ADDR'}})}).then(r=>r.json()).then(d=>JSON.stringify(d.data?d.data.getTrader:d))" 2>/dev/null | tail -1
  sleep 0.5
done
