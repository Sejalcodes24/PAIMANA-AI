import type {
  MlFeatureAttribution,
  ProjectStatus,
  RiskAssessment,
  RiskFactorContribution,
  RiskTier,
  WhatIfResult,
} from './types';

export interface RiskInput {
  projectCode: string;
  name: string;
  sector: string;
  originalCostCr: number;
  anticipatedCostCr: number;
  cumulativeExpenditureCr: number;
  physicalProgressPct: number;
  delayMonths: number;
  bottlenecks: string[];
}

export function classifyRiskTier(score: number): RiskTier {
  if (score >= 70) return 'Critical';
  if (score >= 48) return 'High';
  if (score >= 25) return 'Moderate';
  return 'Low';
}

export function deriveProjectStatus(
  physicalProgressPct: number,
  costOverrunPct: number,
  delayMonths: number,
): ProjectStatus {
  if (physicalProgressPct >= 100) return 'Completed';
  const hasCostOverrun = costOverrunPct > 5;
  const hasDelay = delayMonths > 0;
  if (hasCostOverrun && hasDelay) return 'Cost & Time Overrun';
  if (hasDelay) return 'Delayed';
  if (hasCostOverrun) return 'Cost Overrun';
  return 'On Schedule';
}

const BOTTLENECK_WEIGHTS: Record<string, number> = {
  'Land Acquisition': 8,
  'Forest & Environmental Clearance': 7,
  'Utility Shifting': 4,
  'Right of Way (RoW)': 6,
  'Contractor Mobilization': 5,
  'Law & Order / Local Resistance': 6,
  'Fund Flow / State Share': 5,
  'Tender / Award Delay': 4,
  'Geological / Terrain Challenge': 5,
};

const RECOMMENDATION_MAP: Record<string, string> = {
  'Land Acquisition':
    'Escalate pending land compensation awards to the District Collector and state revenue nodal officer via PRAGATI review.',
  'Forest & Environmental Clearance':
    'Fast-track Stage-II compliance on PARIVESH portal and coordinate compensatory afforestation verification with MoEFCC.',
  'Utility Shifting':
    'Convene joint utility-shifting corridor meeting with state DISCOMs and water boards to finalize relocation estimates.',
  'Right of Way (RoW)':
    'Issue joint RoW demarcation schedule with state administration and deploy phased work fronts on cleared stretches.',
  'Contractor Mobilization':
    'Issue cure notice with weekly milestone recovery plan and evaluate sub-package splitting for lagging stretches.',
  'Law & Order / Local Resistance':
    'Coordinate with state home department for site security and hold local stakeholder compensation grievance camps.',
  'Fund Flow / State Share':
    'Reconcile state counterpart release schedule and initiate interim central tranche drawdown against certified bills.',
  'Tender / Award Delay':
    'Standardize technical bid evaluation timelines and re-tender unbid packages under EPC mode.',
  'Geological / Terrain Challenge':
    'Commission targeted geotechnical reassessment and adopt revised tunnelling/slope-stabilization methodology.',
};

/**
 * Computes both:
 * 1) Rule-Based Risk Score (deterministic MoSPI-style weighted rubric, 0–100)
 * 2) Calibrated Logistic ML Delay Probability (distinct statistical model, 0–100%)
 * Both include full factor/feature attributions so analysts can inspect why a project is flagged.
 */
export function assessProjectRisk(input: RiskInput): RiskAssessment {
  const safeOriginalCost = Math.max(input.originalCostCr, 1);
  const costOverrunCr = Math.max(0, input.anticipatedCostCr - safeOriginalCost);
  const costOverrunPct = (costOverrunCr / safeOriginalCost) * 100;
  const financialProgressPct = Math.min(
    125,
    (Math.max(0, input.cumulativeExpenditureCr) / Math.max(input.anticipatedCostCr, safeOriginalCost)) * 100,
  );
  const physicalPct = Math.max(0, Math.min(100, input.physicalProgressPct));
  const delayMonths = Math.max(0, input.delayMonths);
  const bottlenecks = input.bottlenecks.filter(Boolean);

  // --- 1. Rule-Based Score (Max 100 pts) ---
  // Factor A: Schedule Slippage (0-35 pts)
  let schedulePoints = 0;
  if (delayMonths >= 36) schedulePoints = 35;
  else if (delayMonths >= 24) schedulePoints = 29;
  else if (delayMonths >= 12) schedulePoints = 21;
  else if (delayMonths >= 6) schedulePoints = 13;
  else if (delayMonths > 0) schedulePoints = 6;

  // Factor B: Cost Escalation (0-30 pts)
  let costPoints = 0;
  if (costOverrunPct >= 50) costPoints = 30;
  else if (costOverrunPct >= 30) costPoints = 24;
  else if (costOverrunPct >= 15) costPoints = 16;
  else if (costOverrunPct >= 5) costPoints = 9;
  else if (costOverrunPct > 0) costPoints = 3;

  // Factor C: Physical vs Financial Execution Gap (0-15 pts)
  const finMinusPhysGap = Math.max(0, financialProgressPct - physicalPct);
  let gapPoints = 0;
  if (finMinusPhysGap >= 25) gapPoints = 15;
  else if (finMinusPhysGap >= 15) gapPoints = 11;
  else if (finMinusPhysGap >= 8) gapPoints = 6;
  else if (physicalPct < 25 && delayMonths >= 12) gapPoints = 8;

  // Factor D: Active Implementation Bottlenecks (0-20 pts)
  const rawBottleneckPts = bottlenecks.reduce(
    (sum, b) => sum + (BOTTLENECK_WEIGHTS[b] ?? 4),
    0,
  );
  const bottleneckPoints = Math.min(20, rawBottleneckPts);

  const ruleBasedScore = Math.min(
    100,
    Math.round(schedulePoints + costPoints + gapPoints + bottleneckPoints),
  );

  const ruleFactors: RiskFactorContribution[] = [
    {
      factor: 'schedule_slippage',
      label: 'Schedule Slippage',
      points: schedulePoints,
      maxPoints: 35,
      detail:
        delayMonths > 0
          ? `${delayMonths} months behind original commissioning schedule.`
          : 'On track against original commissioning date.',
    },
    {
      factor: 'cost_escalation',
      label: 'Cost Escalation',
      points: costPoints,
      maxPoints: 30,
      detail:
        costOverrunPct > 0
          ? `${costOverrunPct.toFixed(1)}% overrun (₹${Math.round(costOverrunCr).toLocaleString('en-IN')} Cr above original sanction).`
          : 'Within original sanctioned cost.',
    },
    {
      factor: 'execution_gap',
      label: 'Financial vs. Physical Lag',
      points: gapPoints,
      maxPoints: 15,
      detail: `Financial expenditure at ${financialProgressPct.toFixed(1)}% vs. ${physicalPct.toFixed(1)}% physical completion.`,
    },
    {
      factor: 'bottlenecks',
      label: 'Active Clearance & Site Bottlenecks',
      points: bottleneckPoints,
      maxPoints: 20,
      detail:
        bottlenecks.length > 0
          ? `${bottlenecks.length} active bottleneck(s): ${bottlenecks.join(', ')}.`
          : 'No unresolved statutory or site bottlenecks reported.',
    },
  ];

  // --- 2. Calibrated Logistic ML Predictive Delay Model ---
  // Distinct from rule points: estimates probability of further slippage over next 12 months.
  const sectorBias: Record<string, number> = {
    Railways: 0.42,
    'Water Resources': 0.35,
    'Road Transport & Highways': 0.18,
    Power: 0.12,
    'Urban Development': 0.25,
    Coal: -0.08,
    'Petroleum & Natural Gas': -0.15,
    Telecom: -0.22,
    'Ports & Shipping': 0.08,
    'Civil Aviation': 0.05,
  };

  const wDelay = Math.min(delayMonths, 48) * 0.055;
  const wCost = Math.min(costOverrunPct, 80) * 0.028;
  const wGap = Math.max(-15, finMinusPhysGap) * 0.032;
  const wProgress = ((100 - physicalPct) / 100) * 0.75;
  const wBottleneck = bottlenecks.length * 0.48;
  const wSector = sectorBias[input.sector] ?? 0.1;
  const intercept = -2.15;

  const logit = intercept + wDelay + wCost + wGap + wProgress + wBottleneck + wSector;
  const prob = 1 / (1 + Math.exp(-logit));
  const mlDelayProbability = Math.round(Math.max(3, Math.min(97, prob * 100)));

  const mlAttributions: MlFeatureAttribution[] = [
    {
      feature: 'Historical Schedule Momentum',
      impact: Number((wDelay * 14).toFixed(1)),
      direction: delayMonths > 3 ? 'increases_risk' : 'reduces_risk',
      explanation:
        delayMonths > 3
          ? `Prior ${delayMonths}-month slippage strongly predicts cascading milestone delays.`
          : 'Zero or minimal prior delay lowers continuation risk.',
    },
    {
      feature: 'Cost Variance Ratio',
      impact: Number((wCost * 14).toFixed(1)),
      direction: costOverrunPct > 5 ? 'increases_risk' : 'reduces_risk',
      explanation:
        costOverrunPct > 5
          ? `${costOverrunPct.toFixed(1)}% cost escalation signals scope or price-escalation pressure.`
          : 'Stable cost baseline reduces revision risk.',
    },
    {
      feature: 'Remaining Physical Scope',
      impact: Number((wProgress * 10).toFixed(1)),
      direction: physicalPct < 65 ? 'increases_risk' : 'reduces_risk',
      explanation: `${(100 - physicalPct).toFixed(0)}% uncompleted physical work remains exposed to execution risks.`,
    },
    {
      feature: 'Unresolved Bottleneck Count',
      impact: Number((wBottleneck * 12).toFixed(1)),
      direction: bottlenecks.length > 0 ? 'increases_risk' : 'reduces_risk',
      explanation:
        bottlenecks.length > 0
          ? `${bottlenecks.length} statutory/site bottleneck(s) add non-linear delay hazard.`
          : 'Clearance pipeline is currently unobstructed.',
    },
    {
      feature: `Sector Baseline (${input.sector})`,
      impact: Number((wSector * 15).toFixed(1)),
      direction: wSector >= 0 ? 'increases_risk' : 'reduces_risk',
      explanation:
        wSector >= 0
          ? `${input.sector} projects exhibit higher historical linear-corridor delay incidence.`
          : `${input.sector} projects historically track closer to baseline schedules.`,
    },
  ];

  // --- 3. Actionable Recommendations ---
  const recommendations: string[] = [];
  for (const b of bottlenecks) {
    if (RECOMMENDATION_MAP[b]) {
      recommendations.push(RECOMMENDATION_MAP[b]);
    }
  }
  if (costOverrunPct >= 20) {
    recommendations.push(
      'Submit Revised Cost Estimate (RCE) justification note to Public Investment Board / Expenditure Finance Committee.',
    );
  }
  if (finMinusPhysGap >= 15) {
    recommendations.push(
      'Audit mobilization advances and unadjusted material bills where financial spend outpaces physical milestones.',
    );
  }
  if (recommendations.length === 0) {
    recommendations.push(
      'Maintain monthly milestone verification and quarterly expenditure reconciliation under standard PAIMANA review.',
    );
  }

  return {
    ruleBasedScore,
    ruleBasedTier: classifyRiskTier(ruleBasedScore),
    ruleFactors,
    mlDelayProbability,
    mlRiskTier: classifyRiskTier(mlDelayProbability),
    mlModelName: 'Calibrated Logistic Delay Hazard (v1.2-MoSPI-Features)',
    mlAttributions,
    recommendations,
  };
}

export function runWhatIfSimulation(
  baselineProject: RiskInput,
  overrides: {
    physicalProgressPct: number;
    anticipatedCostCr: number;
    delayMonths: number;
    resolvedBottlenecks: string[];
  },
): WhatIfResult {
  const safeOriginal = Math.max(baselineProject.originalCostCr, 1);
  const baseOverrunPct =
    ((Math.max(0, baselineProject.anticipatedCostCr - safeOriginal)) / safeOriginal) * 100;
  const baselineRisk = assessProjectRisk(baselineProject);

  const remainingBottlenecks = baselineProject.bottlenecks.filter(
    (b) => !overrides.resolvedBottlenecks.includes(b),
  );

  const simInput: RiskInput = {
    ...baselineProject,
    physicalProgressPct: Math.max(0, Math.min(100, overrides.physicalProgressPct)),
    anticipatedCostCr: Math.max(safeOriginal * 0.5, overrides.anticipatedCostCr),
    delayMonths: Math.max(0, overrides.delayMonths),
    bottlenecks: remainingBottlenecks,
  };

  const simOverrunPct =
    ((Math.max(0, simInput.anticipatedCostCr - safeOriginal)) / safeOriginal) * 100;
  const simRisk = assessProjectRisk(simInput);

  return {
    isSimulation: true,
    simulationNotice:
      'Simulated scenario only. Official PAIMANA source records remain unchanged.',
    projectCode: baselineProject.projectCode,
    projectName: baselineProject.name,
    baseline: {
      physicalProgressPct: baselineProject.physicalProgressPct,
      anticipatedCostCr: baselineProject.anticipatedCostCr,
      costOverrunPct: Number(baseOverrunPct.toFixed(1)),
      delayMonths: baselineProject.delayMonths,
      bottlenecks: baselineProject.bottlenecks,
      risk: baselineRisk,
    },
    simulated: {
      physicalProgressPct: simInput.physicalProgressPct,
      anticipatedCostCr: simInput.anticipatedCostCr,
      costOverrunPct: Number(simOverrunPct.toFixed(1)),
      delayMonths: simInput.delayMonths,
      bottlenecks: remainingBottlenecks,
      risk: simRisk,
    },
    delta: {
      ruleBasedScoreDelta: simRisk.ruleBasedScore - baselineRisk.ruleBasedScore,
      mlDelayProbabilityDelta:
        simRisk.mlDelayProbability - baselineRisk.mlDelayProbability,
      costOverrunPctDelta: Number((simOverrunPct - baseOverrunPct).toFixed(1)),
    },
  };
}
