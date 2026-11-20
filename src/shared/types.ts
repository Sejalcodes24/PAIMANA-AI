export type RiskTier = 'Low' | 'Moderate' | 'High' | 'Critical';

export type ProjectStatus =
  | 'On Schedule'
  | 'Delayed'
  | 'Cost Overrun'
  | 'Cost & Time Overrun'
  | 'Completed';

export interface RiskFactorContribution {
  factor: string;
  label: string;
  points: number;
  maxPoints: number;
  detail: string;
}

export interface MlFeatureAttribution {
  feature: string;
  impact: number; // positive increases delay probability, negative decreases
  direction: 'increases_risk' | 'reduces_risk';
  explanation: string;
}

export interface RiskAssessment {
  ruleBasedScore: number; // 0-100
  ruleBasedTier: RiskTier;
  ruleFactors: RiskFactorContribution[];
  mlDelayProbability: number; // 0-100 (%)
  mlRiskTier: RiskTier;
  mlModelName: string;
  mlAttributions: MlFeatureAttribution[];
  recommendations: string[];
}

export interface MonthlyHistoryPoint {
  month: string; // YYYY-MM
  monthLabel: string;
  physicalProgressPct: number;
  cumulativeExpenditureCr: number;
  anticipatedCostCr: number;
  delayMonths: number;
  ruleBasedScore: number;
}

export interface InfrastructureProject {
  projectCode: string;
  name: string;
  sector: string;
  implementingAgency: string;
  ministry: string;
  state: string; // Normalized to match india-states.geojson ST_NM
  corridorOrRegion: string; // Descriptive text only; no invented lat/lng coordinates
  locationGranularity: 'State-level';
  reportingMonth: string; // YYYY-MM
  approvalDate: string;
  originalCompletionDate: string;
  anticipatedCompletionDate: string;
  originalCostCr: number;
  anticipatedCostCr: number;
  cumulativeExpenditureCr: number;
  physicalProgressPct: number;
  financialProgressPct: number;
  costOverrunCr: number;
  costOverrunPct: number;
  delayMonths: number;
  status: ProjectStatus;
  bottlenecks: string[];
  remarks: string;
  sourceFile: string;
  risk: RiskAssessment;
}

export interface ProjectDetailResponse {
  project: InfrastructureProject;
  history: MonthlyHistoryPoint[];
}

export interface StateAggregate {
  state: string;
  projectCount: number;
  totalOriginalCostCr: number;
  totalAnticipatedCostCr: number;
  totalExpenditureCr: number;
  delayedCount: number;
  costOverrunCount: number;
  highRiskCount: number;
  avgRuleRiskScore: number;
  avgMlProbability: number;
  topProjects: Array<{
    projectCode: string;
    name: string;
    sector: string;
    ruleBasedScore: number;
    ruleBasedTier: RiskTier;
    delayMonths: number;
    costOverrunPct: number;
  }>;
}

export interface SectorAggregate {
  sector: string;
  projectCount: number;
  totalOriginalCostCr: number;
  totalAnticipatedCostCr: number;
  delayedCount: number;
  highRiskCount: number;
  avgPhysicalProgressPct: number;
  avgRuleRiskScore: number;
  topProjects: Array<{
    projectCode: string;
    name: string;
    state: string;
    implementingAgency: string;
    ministry: string;
    physicalProgressPct: number;
    anticipatedCostCr: number;
    delayMonths: number;
    costOverrunPct: number;
    ruleBasedScore: number;
    ruleBasedTier: RiskTier;
  }>;
}

export interface FlashReport {
  id: string;
  month: string;
  monthLabel: string;
  title: string;
  publishedDate: string;
  summary: string;
  highlights: string[];
  totalProjectsCovered: number;
  totalOutlayCr: number;
  sourceCsvFile: string;
  referencePdfName: string;
  reportUrl?: string;
  reportLinkLabel?: string;
  deduplicatedFilesSkipped: string[];
}

export interface DashboardSummary {
  reportingMonth: string;
  monthLabel: string;
  availableMonths: Array<{ month: string; label: string; projectCount: number }>;
  kpis: {
    totalProjects: number;
    totalOriginalCostCr: number;
    totalAnticipatedCostCr: number;
    totalExpenditureCr: number;
    overallCostOverrunCr: number;
    overallCostOverrunPct: number;
    delayedProjects: number;
    costOverrunProjects: number;
    highOrCriticalRiskProjects: number;
    avgPhysicalProgressPct: number;
  };
  riskDistribution: Array<{ tier: RiskTier; count: number; percentage: number }>;
  statusBreakdown: Array<{ status: ProjectStatus; count: number }>;
  sectorBreakdown: SectorAggregate[];
  stateAggregates: StateAggregate[];
  highRiskWatchlist: InfrastructureProject[];
  dataIntegrity: {
    recordsLoaded: number;
    duplicatesSkipped: number;
    skippedFiles: string[];
    missingFieldsNormalized: number;
    locationNotice: string;
  };
}

export interface WhatIfInput {
  projectCode: string;
  reportingMonth?: string;
  physicalProgressPct: number;
  anticipatedCostCr: number;
  delayMonths: number;
  resolvedBottlenecks: string[];
}

export interface WhatIfResult {
  isSimulation: true;
  simulationNotice: string;
  projectCode: string;
  projectName: string;
  baseline: {
    physicalProgressPct: number;
    anticipatedCostCr: number;
    costOverrunPct: number;
    delayMonths: number;
    bottlenecks: string[];
    risk: RiskAssessment;
  };
  simulated: {
    physicalProgressPct: number;
    anticipatedCostCr: number;
    costOverrunPct: number;
    delayMonths: number;
    bottlenecks: string[];
    risk: RiskAssessment;
  };
  delta: {
    ruleBasedScoreDelta: number;
    mlDelayProbabilityDelta: number;
    costOverrunPctDelta: number;
  };
}

export interface ChatEvidenceItem {
  projectCode: string;
  name: string;
  state: string;
  sector: string;
  ruleBasedScore: number;
  mlDelayProbability: number;
  delayMonths: number;
  costOverrunPct: number;
}

export interface ChatResponsePayload {
  answer: string;
  mode: 'gemini' | 'deterministic-fallback';
  modelUsed: string;
  reportingMonth: string;
  evidence: ChatEvidenceItem[];
  notice?: string;
}
