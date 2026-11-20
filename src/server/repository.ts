import fs from 'node:fs';
import path from 'node:path';
import { isDuplicateCopyFilename, parseMonthlyCsv } from './dataImporter';
import type {
  DashboardSummary,
  FlashReport,
  InfrastructureProject,
  MonthlyHistoryPoint,
  ProjectDetailResponse,
  ProjectStatus,
  RiskTier,
  SectorAggregate,
  StateAggregate,
} from '../shared/types';

const MONTH_LABELS: Record<string, string> = {
  '2026-01': 'January 2026',
  '2026-02': 'February 2026',
  '2026-03': 'March 2026',
};

export function formatMonthLabel(month: string): string {
  if (MONTH_LABELS[month]) return MONTH_LABELS[month];
  const [year, m] = month.split('-');
  const idx = Number(m) - 1;
  const names = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];
  if (year && idx >= 0 && idx < 12) return `${names[idx]} ${year}`;
  return month;
}

export interface RepositoryStore {
  byMonth: Map<string, InfrastructureProject[]>;
  monthsSortedDesc: string[];
  flashReports: FlashReport[];
  dataIntegrity: {
    recordsLoaded: number;
    duplicatesSkipped: number;
    skippedFiles: string[];
    missingFieldsNormalized: number;
    locationNotice: string;
  };
}

let cachedStore: RepositoryStore | null = null;

function inferMonthFromFilename(filename: string): string {
  const match = filename.match(/(20\d{2})[_-](\d{2})/);
  if (match) return `${match[1]}-${match[2]}`;
  return '2026-03';
}

export function loadRepositoryStore(forceReload = false): RepositoryStore {
  if (cachedStore && !forceReload) return cachedStore;

  const dataRoot = path.resolve(process.cwd(), 'data');
  const monthlyDir = path.join(dataRoot, 'monthly');
  const flashPath = path.join(dataRoot, 'flash_reports', 'flash_reports.json');

  const byMonth = new Map<string, InfrastructureProject[]>();
  const seenGlobal = new Set<string>();
  const skippedFiles: string[] = [];
  let duplicatesSkipped = 0;
  let missingFieldsNormalized = 0;
  let recordsLoaded = 0;

  if (fs.existsSync(monthlyDir)) {
    const files = fs
      .readdirSync(monthlyDir)
      .filter((f) => f.endsWith('.csv'))
      .sort();

    for (const file of files) {
      if (isDuplicateCopyFilename(file)) {
        skippedFiles.push(file);
        duplicatesSkipped++;
        continue;
      }

      const content = fs.readFileSync(path.join(monthlyDir, file), 'utf-8');
      const fallbackMonth = inferMonthFromFilename(file);
      const parsed = parseMonthlyCsv(content, file, fallbackMonth);
      duplicatesSkipped += parsed.duplicatesSkipped;
      missingFieldsNormalized += parsed.missingFieldsNormalized;

      for (const proj of parsed.projects) {
        const key = `${proj.projectCode}::${proj.reportingMonth}`;
        if (seenGlobal.has(key)) {
          duplicatesSkipped++;
          continue;
        }
        seenGlobal.add(key);
        const list = byMonth.get(proj.reportingMonth) ?? [];
        list.push(proj);
        byMonth.set(proj.reportingMonth, list);
        recordsLoaded++;
      }
    }
  }

  let flashReports: FlashReport[] = [];
  if (fs.existsSync(flashPath)) {
    try {
      flashReports = JSON.parse(fs.readFileSync(flashPath, 'utf-8')) as FlashReport[];
    } catch {
      flashReports = [];
    }
  }

  const monthsSortedDesc = Array.from(byMonth.keys()).sort((a, b) => b.localeCompare(a));

  cachedStore = {
    byMonth,
    monthsSortedDesc,
    flashReports,
    dataIntegrity: {
      recordsLoaded,
      duplicatesSkipped,
      skippedFiles,
      missingFieldsNormalized,
      locationNotice:
        'Locations represent State/UT administrative boundaries. Exact project lat/lng coordinates are not present in source records and are never fabricated.',
    },
  };

  return cachedStore;
}

export function resolveMonth(requestedMonth?: string): string {
  const store = loadRepositoryStore();
  if (requestedMonth && store.byMonth.has(requestedMonth)) {
    return requestedMonth;
  }
  return store.monthsSortedDesc[0] ?? '2026-03';
}

export function getDashboardSummary(requestedMonth?: string): DashboardSummary {
  const store = loadRepositoryStore();
  const reportingMonth = resolveMonth(requestedMonth);
  const projects = store.byMonth.get(reportingMonth) ?? [];

  const totalProjects = projects.length;
  const totalOriginalCostCr = Math.round(
    projects.reduce((s, p) => s + p.originalCostCr, 0),
  );
  const totalAnticipatedCostCr = Math.round(
    projects.reduce((s, p) => s + p.anticipatedCostCr, 0),
  );
  const totalExpenditureCr = Math.round(
    projects.reduce((s, p) => s + p.cumulativeExpenditureCr, 0),
  );
  const overallCostOverrunCr = Math.max(0, totalAnticipatedCostCr - totalOriginalCostCr);
  const overallCostOverrunPct =
    totalOriginalCostCr > 0
      ? Number(((overallCostOverrunCr / totalOriginalCostCr) * 100).toFixed(1))
      : 0;

  const delayedProjects = projects.filter((p) => p.delayMonths > 0).length;
  const costOverrunProjects = projects.filter((p) => p.costOverrunPct > 5).length;
  const highOrCriticalRiskProjects = projects.filter(
    (p) => p.risk.ruleBasedTier === 'High' || p.risk.ruleBasedTier === 'Critical',
  ).length;
  const avgPhysicalProgressPct =
    totalProjects > 0
      ? Number(
          (
            projects.reduce((s, p) => s + p.physicalProgressPct, 0) / totalProjects
          ).toFixed(1),
        )
      : 0;

  const tiers: RiskTier[] = ['Critical', 'High', 'Moderate', 'Low'];
  const riskDistribution = tiers.map((tier) => {
    const count = projects.filter((p) => p.risk.ruleBasedTier === tier).length;
    return {
      tier,
      count,
      percentage: totalProjects > 0 ? Number(((count / totalProjects) * 100).toFixed(1)) : 0,
    };
  });

  const statuses: ProjectStatus[] = [
    'Cost & Time Overrun',
    'Delayed',
    'Cost Overrun',
    'On Schedule',
    'Completed',
  ];
  const statusBreakdown = statuses
    .map((status) => ({
      status,
      count: projects.filter((p) => p.status === status).length,
    }))
    .filter((s) => s.count > 0);

  // Sector aggregates
  const sectorMap = new Map<string, InfrastructureProject[]>();
  for (const p of projects) {
    const arr = sectorMap.get(p.sector) ?? [];
    arr.push(p);
    sectorMap.set(p.sector, arr);
  }
  const sectorBreakdown: SectorAggregate[] = Array.from(sectorMap.entries())
    .map(([sector, items]) => ({
      sector,
      projectCount: items.length,
      totalOriginalCostCr: Math.round(items.reduce((s, p) => s + p.originalCostCr, 0)),
      totalAnticipatedCostCr: Math.round(items.reduce((s, p) => s + p.anticipatedCostCr, 0)),
      delayedCount: items.filter((p) => p.delayMonths > 0).length,
      highRiskCount: items.filter(
        (p) => p.risk.ruleBasedTier === 'High' || p.risk.ruleBasedTier === 'Critical',
      ).length,
      avgPhysicalProgressPct: Number(
        (items.reduce((s, p) => s + p.physicalProgressPct, 0) / items.length).toFixed(1),
      ),
      avgRuleRiskScore: Math.round(
        items.reduce((s, p) => s + p.risk.ruleBasedScore, 0) / items.length,
      ),
      topProjects: [...items]
        .sort((a, b) => b.risk.ruleBasedScore - a.risk.ruleBasedScore)
        .slice(0, 6)
        .map((p) => ({
          projectCode: p.projectCode,
          name: p.name,
          state: p.state,
          implementingAgency: p.implementingAgency,
          ministry: p.ministry,
          physicalProgressPct: p.physicalProgressPct,
          anticipatedCostCr: p.anticipatedCostCr,
          delayMonths: p.delayMonths,
          costOverrunPct: p.costOverrunPct,
          ruleBasedScore: p.risk.ruleBasedScore,
          ruleBasedTier: p.risk.ruleBasedTier,
        })),
    }))
    .sort((a, b) => b.totalAnticipatedCostCr - a.totalAnticipatedCostCr);

  // State aggregates
  const stateMap = new Map<string, InfrastructureProject[]>();
  for (const p of projects) {
    const arr = stateMap.get(p.state) ?? [];
    arr.push(p);
    stateMap.set(p.state, arr);
  }
  const stateAggregates: StateAggregate[] = Array.from(stateMap.entries())
    .map(([state, items]) => ({
      state,
      projectCount: items.length,
      totalOriginalCostCr: Math.round(items.reduce((s, p) => s + p.originalCostCr, 0)),
      totalAnticipatedCostCr: Math.round(items.reduce((s, p) => s + p.anticipatedCostCr, 0)),
      totalExpenditureCr: Math.round(
        items.reduce((s, p) => s + p.cumulativeExpenditureCr, 0),
      ),
      delayedCount: items.filter((p) => p.delayMonths > 0).length,
      costOverrunCount: items.filter((p) => p.costOverrunPct > 5).length,
      highRiskCount: items.filter(
        (p) => p.risk.ruleBasedTier === 'High' || p.risk.ruleBasedTier === 'Critical',
      ).length,
      avgRuleRiskScore: Math.round(
        items.reduce((s, p) => s + p.risk.ruleBasedScore, 0) / items.length,
      ),
      avgMlProbability: Math.round(
        items.reduce((s, p) => s + p.risk.mlDelayProbability, 0) / items.length,
      ),
      topProjects: [...items]
        .sort((a, b) => b.risk.ruleBasedScore - a.risk.ruleBasedScore)
        .slice(0, 4)
        .map((p) => ({
          projectCode: p.projectCode,
          name: p.name,
          sector: p.sector,
          ruleBasedScore: p.risk.ruleBasedScore,
          ruleBasedTier: p.risk.ruleBasedTier,
          delayMonths: p.delayMonths,
          costOverrunPct: p.costOverrunPct,
        })),
    }))
    .sort((a, b) => b.avgRuleRiskScore - a.avgRuleRiskScore);

  const highRiskWatchlist = [...projects]
    .sort((a, b) => b.risk.ruleBasedScore - a.risk.ruleBasedScore)
    .slice(0, 6);

  const availableMonths = store.monthsSortedDesc.map((m) => ({
    month: m,
    label: formatMonthLabel(m),
    projectCount: store.byMonth.get(m)?.length ?? 0,
  }));

  return {
    reportingMonth,
    monthLabel: formatMonthLabel(reportingMonth),
    availableMonths,
    kpis: {
      totalProjects,
      totalOriginalCostCr,
      totalAnticipatedCostCr,
      totalExpenditureCr,
      overallCostOverrunCr,
      overallCostOverrunPct,
      delayedProjects,
      costOverrunProjects,
      highOrCriticalRiskProjects,
      avgPhysicalProgressPct,
    },
    riskDistribution,
    statusBreakdown,
    sectorBreakdown,
    stateAggregates,
    highRiskWatchlist,
    dataIntegrity: store.dataIntegrity,
  };
}

export interface ProjectQueryParams {
  month?: string;
  search?: string;
  state?: string;
  sector?: string;
  riskTier?: string;
  status?: string;
  sortBy?: 'riskScore' | 'mlProbability' | 'delayMonths' | 'costOverrunPct' | 'anticipatedCostCr' | 'physicalProgressPct' | 'name';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

export function queryProjects(params: ProjectQueryParams) {
  const store = loadRepositoryStore();
  const reportingMonth = resolveMonth(params.month);
  const all = store.byMonth.get(reportingMonth) ?? [];

  const searchLower = (params.search ?? '').trim().toLowerCase();

  let filtered = all.filter((p) => {
    if (params.state && params.state !== 'All' && p.state !== params.state) return false;
    if (params.sector && params.sector !== 'All') {
      const sectorGroups: Record<string, string[]> = {
        '@power': ['Electricity Generation', 'Transmission & Distribution', 'Energy Storage'],
        '@roads': ['Roads & Highways'],
        '@urban': ['Urban Public Transport'],
      };
      const accepted = sectorGroups[params.sector] ?? [params.sector];
      if (!accepted.includes(p.sector)) return false;
    }
    if (params.riskTier && params.riskTier !== 'All' && p.risk.ruleBasedTier !== params.riskTier) {
      return false;
    }
    if (params.status && params.status !== 'All' && p.status !== params.status) return false;
    if (searchLower) {
      const hay = `${p.projectCode} ${p.name} ${p.state} ${p.sector} ${p.implementingAgency} ${p.corridorOrRegion} ${p.bottlenecks.join(' ')}`.toLowerCase();
      if (!hay.includes(searchLower)) return false;
    }
    return true;
  });

  const sortBy = params.sortBy ?? 'riskScore';
  const dir = params.sortOrder === 'asc' ? 1 : -1;

  filtered = [...filtered].sort((a, b) => {
    switch (sortBy) {
      case 'riskScore':
        return (a.risk.ruleBasedScore - b.risk.ruleBasedScore) * dir;
      case 'mlProbability':
        return (a.risk.mlDelayProbability - b.risk.mlDelayProbability) * dir;
      case 'delayMonths':
        return (a.delayMonths - b.delayMonths) * dir;
      case 'costOverrunPct':
        return (a.costOverrunPct - b.costOverrunPct) * dir;
      case 'anticipatedCostCr':
        return (a.anticipatedCostCr - b.anticipatedCostCr) * dir;
      case 'physicalProgressPct':
        return (a.physicalProgressPct - b.physicalProgressPct) * dir;
      case 'name':
        return a.name.localeCompare(b.name) * dir;
      default:
        return (a.risk.ruleBasedScore - b.risk.ruleBasedScore) * dir;
    }
  });

  const pageSize = Math.max(1, Math.min(50, params.pageSize ?? 10));
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.max(1, Math.min(totalPages, params.page ?? 1));
  const start = (page - 1) * pageSize;
  const items = filtered.slice(start, start + pageSize);

  const facets = {
    states: Array.from(new Set(all.map((p) => p.state))).sort(),
    sectors: Array.from(new Set(all.map((p) => p.sector))).sort(),
    statuses: Array.from(new Set(all.map((p) => p.status))).sort(),
  };

  return {
    reportingMonth,
    monthLabel: formatMonthLabel(reportingMonth),
    total,
    page,
    pageSize,
    totalPages,
    items,
    facets,
  };
}

export function getProjectDetail(
  projectCode: string,
  requestedMonth?: string,
): ProjectDetailResponse | null {
  const store = loadRepositoryStore();
  const reportingMonth = resolveMonth(requestedMonth);
  const monthProjects = store.byMonth.get(reportingMonth) ?? [];
  const project = monthProjects.find(
    (p) => p.projectCode.toLowerCase() === projectCode.toLowerCase(),
  );
  if (!project) return null;

  const history: MonthlyHistoryPoint[] = [];
  const ascMonths = [...store.monthsSortedDesc].reverse();
  for (const m of ascMonths) {
    const found = (store.byMonth.get(m) ?? []).find(
      (p) => p.projectCode.toLowerCase() === projectCode.toLowerCase(),
    );
    if (found) {
      history.push({
        month: m,
        monthLabel: formatMonthLabel(m),
        physicalProgressPct: found.physicalProgressPct,
        cumulativeExpenditureCr: found.cumulativeExpenditureCr,
        anticipatedCostCr: found.anticipatedCostCr,
        delayMonths: found.delayMonths,
        ruleBasedScore: found.risk.ruleBasedScore,
      });
    }
  }

  return { project, history };
}

export function getFlashReports(): FlashReport[] {
  return loadRepositoryStore().flashReports;
}

export function getAllProjectsForMonth(requestedMonth?: string): {
  reportingMonth: string;
  projects: InfrastructureProject[];
} {
  const store = loadRepositoryStore();
  const reportingMonth = resolveMonth(requestedMonth);
  return {
    reportingMonth,
    projects: store.byMonth.get(reportingMonth) ?? [],
  };
}
