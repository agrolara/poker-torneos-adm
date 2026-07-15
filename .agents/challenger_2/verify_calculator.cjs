// verify_calculator.cjs
// Standalone empirical validation script for public blind structures explorer and simulator logic

const assert = require('assert');

// 1. Re-implementation of the exact math logic in Landing.tsx
function calculateSimulator({ simPlayers, simBuyIn, defaultsRake, payoutStructure }) {
  // Parse inputs using the same parsing logic in Landing.tsx
  let parsedPlayers = 0;
  if (simPlayers !== '') {
    let parsed = parseFloat(simPlayers);
    if (!isNaN(parsed)) {
      parsed = Math.round(parsed);
      if (parsed < 0) parsed = 0;
      parsedPlayers = parsed;
    }
  }

  let parsedBuyIn = 0;
  if (simBuyIn !== '') {
    let parsed = parseFloat(simBuyIn);
    if (!isNaN(parsed)) {
      if (parsed < 0) parsed = 0;
      parsedBuyIn = parsed;
    }
  }

  const rakePerPlayer = Math.min(parsedBuyIn, defaultsRake ?? 0);

  const grossPool = parsedPlayers * parsedBuyIn;
  const rakeDeduction = parsedPlayers * rakePerPlayer;
  const netPool = Math.max(0, grossPool - rakeDeduction);

  const payout = payoutStructure || [100];
  const prizeRows = payout.map((percentage, index) => {
    const position = index + 1;
    const prizeAmount = Math.round((netPool * percentage) / 100);
    return {
      position,
      percentage,
      amount: prizeAmount
    };
  });

  return {
    players: parsedPlayers,
    buyIn: parsedBuyIn,
    grossPool,
    rakeDeduction,
    netPool,
    prizeRows
  };
}

// 2. Test Cases
function runTests() {
  console.log("=== Running Empirical Calculator Verification ===");

  // Test Case 1: Standard inputs
  console.log("Test Case 1: Standard inputs (10 players, 10,000 buy-in, 3,000 rake, [50, 30, 20] payout)");
  const res1 = calculateSimulator({
    simPlayers: 10,
    simBuyIn: 10000,
    defaultsRake: 3000,
    payoutStructure: [50, 30, 20]
  });
  assert.strictEqual(res1.grossPool, 100000);
  assert.strictEqual(res1.rakeDeduction, 30000);
  assert.strictEqual(res1.netPool, 70000);
  assert.strictEqual(res1.prizeRows[0].amount, 35000); // 50%
  assert.strictEqual(res1.prizeRows[1].amount, 21000); // 30%
  assert.strictEqual(res1.prizeRows[2].amount, 14000); // 20%
  console.log("✓ Test Case 1 Passed!");

  // Test Case 2: Massive inputs (players = 1,000,000, buy-in = 1,000,000)
  console.log("Test Case 2: Massive inputs (1,000,000 players, 1,000,000 buy-in, 3,000 rake)");
  const res2 = calculateSimulator({
    simPlayers: 1000000,
    simBuyIn: 1000000,
    defaultsRake: 3000,
    payoutStructure: [50, 30, 20]
  });
  // grossPool = 1,000,000 * 1,000,000 = 1,000,000,000,000 (1e12)
  // rakeDeduction = 1,000,000 * 3,000 = 3,000,000,000 (3e9)
  // netPool = 1e12 - 3e9 = 997,000,000,000 (9.97e11)
  assert.strictEqual(res2.grossPool, 1000000000000);
  assert.strictEqual(res2.rakeDeduction, 3000000000);
  assert.strictEqual(res2.netPool, 997000000000);
  assert.strictEqual(res2.prizeRows[0].amount, 498500000000); // 50%
  assert.strictEqual(res2.prizeRows[1].amount, 299100000000); // 30%
  assert.strictEqual(res2.prizeRows[2].amount, 199400000000); // 20%
  console.log("✓ Test Case 2 Passed! (No overflow or precision failure)");

  // Test Case 3: Extreme Massive inputs close to MAX_SAFE_INTEGER
  console.log("Test Case 3: Extreme inputs (9,000,000 players, 1,000,000 buy-in)");
  const res3 = calculateSimulator({
    simPlayers: 9000000,
    simBuyIn: 1000000,
    defaultsRake: 1000,
    payoutStructure: [50, 30, 20]
  });
  // grossPool = 9e12
  // rakeDeduction = 9e9
  // netPool = 8.991e12
  assert.strictEqual(res3.grossPool, 9000000000000);
  assert.strictEqual(res3.netPool, 8991000000000);
  console.log("✓ Test Case 3 Passed!");

  // Test Case 4: Negative boundary inputs (should be treated as 0)
  console.log("Test Case 4: Negative inputs (players = -50, buy-in = -1000)");
  const res4 = calculateSimulator({
    simPlayers: -50,
    simBuyIn: -1000,
    defaultsRake: 3000,
    payoutStructure: [50, 30, 20]
  });
  assert.strictEqual(res4.players, 0);
  assert.strictEqual(res4.buyIn, 0);
  assert.strictEqual(res4.grossPool, 0);
  assert.strictEqual(res4.netPool, 0);
  console.log("✓ Test Case 4 Passed!");

  // Test Case 5: Float rounding behavior on players count (e.g. 10.7)
  console.log("Test Case 5: Float players count (10.7 players -> rounded to 11)");
  const res5 = calculateSimulator({
    simPlayers: 10.7,
    simBuyIn: 10000,
    defaultsRake: 3000,
    payoutStructure: [50, 30, 20]
  });
  assert.strictEqual(res5.players, 11);
  assert.strictEqual(res5.grossPool, 110000);
  console.log("✓ Test Case 5 Passed!");

  // Test Case 6: Rake greater than buy-in (rakePerPlayer capped at buyIn)
  console.log("Test Case 6: Rake (5,000) greater than Buy-in (3,000)");
  const res6 = calculateSimulator({
    simPlayers: 10,
    simBuyIn: 3000,
    defaultsRake: 5000,
    payoutStructure: [100]
  });
  // rakePerPlayer should be min(3000, 5000) = 3000
  // grossPool = 30000
  // rakeDeduction = 30000
  // netPool = 0
  assert.strictEqual(res6.rakeDeduction, 30000);
  assert.strictEqual(res6.netPool, 0);
  console.log("✓ Test Case 6 Passed!");

  // Test Case 7: Non-integer netPool rounding discrepancy (verify individual rounding)
  console.log("Test Case 7: Payout rounding discrepancy (netPool = 1003, payouts [50, 30, 20])");
  const res7 = calculateSimulator({
    simPlayers: 1,
    simBuyIn: 1003,
    defaultsRake: 0,
    payoutStructure: [50, 30, 20]
  });
  // 1st: round(501.5) = 502
  // 2nd: round(300.9) = 301
  // 3rd: round(200.6) = 201
  // Total of prize rows = 502 + 301 + 201 = 1004. Discrepancy is 1.
  assert.strictEqual(res7.prizeRows[0].amount, 502);
  assert.strictEqual(res7.prizeRows[1].amount, 301);
  assert.strictEqual(res7.prizeRows[2].amount, 201);
  const totalPrizes = res7.prizeRows.reduce((a, b) => a + b.amount, 0);
  console.log(`  netPool: ${res7.netPool}, sum of rounded prizes: ${totalPrizes} (Discrepancy: ${totalPrizes - res7.netPool})`);
  console.log("✓ Test Case 7 Passed!");

  console.log("=== All Empirical Test Cases Passed Successfully! ===");
}

runTests();
