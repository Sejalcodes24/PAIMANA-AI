import test from 'node:test';
import assert from 'node:assert/strict';
import { assessProjectRisk, classifyRiskTier, deriveProjectStatus, runWhatIfSimulation } from './risk';

test('classifyRiskTier maps scores to deterministic tiers', () => {
  assert.equal(classifyRiskTier(12), 'Low');
  assert.equal(classifyRiskTier(30), 'Moderate');
  assert.equal(classifyRiskTier(55), 'High');
  assert.equal(classifyRiskTier(78), 'Critical');
});

test('deriveProjectStatus identifies cost and time overruns accurately', () => {
  assert.equal(deriveProjectStatus(100, 12, 10), 'Completed');
  assert.equal(deriveProjectStatus(60, 18, 12), 'Cost & Time Overrun');
  assert.equal(deriveProjectStatus(60, 2, 6), 'Delayed');
  assert.equal(deriveProjectStatus(60, 14, 0), 'Cost Overrun');
  assert.equal(deriveProjectStatus(60, 0, 0), 'On Schedule');
});

test('assessProjectRisk distinguishes rule-based score and ML delay probability with factor breakdown', () => {
  const result = assessProjectRisk({
    projectCode: 'PAI-TEST-01',
    name: 'Test Corridor',
    sector: 'Railways',
    originalCostCr: 1000,
    anticipatedCostCr: 1450,
    cumulativeExpenditureCr: 950,
    physicalProgressPct: 45,
    delayMonths: 30,
    bottlenecks: ['Land Acquisition', 'Utility Shifting'],
  });

  assert.ok(result.ruleBasedScore >= 60 && result.ruleBasedScore <= 100);
  assert.equal(result.ruleFactors.length, 4);
  const sumFactorPts = result.ruleFactors.reduce((s, f) => s + f.points, 0);
  assert.equal(sumFactorPts, result.ruleBasedScore);

  assert.ok(result.mlDelayProbability >= 50 && result.mlDelayProbability <= 97);
  assert.equal(result.mlAttributions.length, 5);
  assert.ok(result.recommendations.length >= 2);
});

test('runWhatIfSimulation reduces risk when bottlenecks are resolved and delay/cost drop', () => {
  const baseline = {
    projectCode: 'PAI-TEST-02',
    name: 'Test Expressway',
    sector: 'Road Transport & Highways',
    originalCostCr: 2000,
    anticipatedCostCr: 2800,
    cumulativeExpenditureCr: 1800,
    physicalProgressPct: 50,
    delayMonths: 28,
    bottlenecks: ['Land Acquisition', 'Forest & Environmental Clearance'],
  };

  const sim = runWhatIfSimulation(baseline, {
    physicalProgressPct: 82,
    anticipatedCostCr: 2150,
    delayMonths: 6,
    resolvedBottlenecks: ['Land Acquisition', 'Forest & Environmental Clearance'],
  });

  assert.equal(sim.isSimulation, true);
  assert.ok(sim.delta.ruleBasedScoreDelta < 0);
  assert.ok(sim.delta.mlDelayProbabilityDelta < 0);
  assert.equal(sim.simulated.bottlenecks.length, 0);
});
