import { assessProjectRisk, deriveProjectStatus } from '../shared/risk';
import type { InfrastructureProject } from '../shared/types';

// Canonical state names matching public/data/india-states.geojson ST_NM
const STATE_ALIASES: Record<string, string> = {
  maharashtra: 'Maharashtra',
  'uttar pradesh': 'Uttar Pradesh',
  up: 'Uttar Pradesh',
  gujarat: 'Gujarat',
  'tamil nadu': 'Tamil Nadu',
  tamilnadu: 'Tamil Nadu',
  karnataka: 'Karnataka',
  'madhya pradesh': 'Madhya Pradesh',
  rajasthan: 'Rajasthan',
  bihar: 'Bihar',
  'west bengal': 'West Bengal',
  odisha: 'Odisha',
  orissa: 'Odisha',
  'andhra pradesh': 'Andhra Pradesh',
  telangana: 'Telangana',
  kerala: 'Kerala',
  assam: 'Assam',
  jharkhand: 'Jharkhand',
  chhattisgarh: 'Chhattisgarh',
  haryana: 'Haryana',
  punjab: 'Punjab',
  uttarakhand: 'Uttarakhand',
  'himachal pradesh': 'Himachal Pradesh',
  'jammu & kashmir': 'Jammu & Kashmir',
  'jammu and kashmir': 'Jammu & Kashmir',
  ladakh: 'Ladakh',
  delhi: 'Delhi',
  'nct of delhi': 'Delhi',
  goa: 'Goa',
  tripura: 'Tripura',
  manipur: 'Manipur',
  meghalaya: 'Meghalaya',
  nagaland: 'Nagaland',
  'arunachal pradesh': 'Arunachal Pradesh',
  mizoram: 'Mizoram',
  sikkim: 'Sikkim',
  chandigarh: 'Chandigarh',
  puducherry: 'Puducherry',
  'andaman & nicobar': 'Andaman & Nicobar',
  lakshadweep: 'Lakshadweep',
  'dadra and nagar haveli and daman and diu': 'Dadra and Nagar Haveli and Daman and Diu',
};

export function normalizeStateName(raw: string): string {
  const cleaned = raw.trim().replace(/\s+/g, ' ');
  const key = cleaned.toLowerCase();
  return STATE_ALIASES[key] ?? cleaned;
}

/**
 * Detects duplicate-copy filenames such as "paimana_2026_02 (1).csv" or "report - Copy.csv".
 */
export function isDuplicateCopyFilename(filename: string): boolean {
  return /\s*\(\d+\)\.(csv|json)$/i.test(filename) || /\s*-\s*copy\.(csv|json)$/i.test(filename);
}

/**
 * RFC-4180 compliant CSV parser handling quoted commas, escaped quotes, and CRLF/LF.
 */
export function parseCsvRows(csvContent: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let inQuotes = false;

  const text = csvContent.replace(/^\uFEFF/, ''); // Strip UTF-8 BOM if present

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        currentCell += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        currentCell += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        currentRow.push(currentCell.trim());
        currentCell = '';
      } else if (char === '\r' && next === '\n') {
        currentRow.push(currentCell.trim());
        if (currentRow.some((c) => c !== '')) rows.push(currentRow);
        currentRow = [];
        currentCell = '';
        i++;
      } else if (char === '\n') {
        currentRow.push(currentCell.trim());
        if (currentRow.some((c) => c !== '')) rows.push(currentRow);
        currentRow = [];
        currentCell = '';
      } else {
        currentCell += char;
      }
    }
  }

  if (currentCell !== '' || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    if (currentRow.some((c) => c !== '')) rows.push(currentRow);
  }

  return rows;
}

const MISSING_TOKENS = new Set(['', 'na', 'n/a', 'null', 'none', '-', '--', 'nil']);

export function parseSafeNumber(raw: string | number | undefined | null, fallback = 0): {
  value: number;
  wasMissing: boolean;
} {
  if (typeof raw === 'number') {
    return Number.isFinite(raw) ? { value: raw, wasMissing: false } : { value: fallback, wasMissing: true };
  }
  const cleaned = String(raw ?? '').trim();
  if (MISSING_TOKENS.has(cleaned.toLowerCase())) {
    return { value: fallback, wasMissing: true };
  }
  const normalized = cleaned.replace(/[₹,\s]/g, '').replace(/%$/, '');
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) {
    return { value: fallback, wasMissing: true };
  }
  return { value: parsed, wasMissing: false };
}

function normalizeHeaderKey(header: string): string {
  return header
    .toLowerCase()
    .replace(/\(rs\.?\s*crore\)|\(cr\)|\(%\)/gi, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function pickField(rowObj: Record<string, string>, aliases: string[]): string {
  for (const key of aliases) {
    if (rowObj[key] !== undefined && rowObj[key] !== '') {
      return rowObj[key];
    }
  }
  return '';
}

export interface CsvImportSummary {
  projects: InfrastructureProject[];
  duplicatesSkipped: number;
  missingFieldsNormalized: number;
}

/**
 * Parses a monthly PAIMANA CSV with header-alias tolerance and safe missing-value handling.
 */
export function parseMonthlyCsv(
  csvContent: string,
  filename: string,
  fallbackMonth: string,
): CsvImportSummary {
  const rows = parseCsvRows(csvContent);
  if (rows.length < 2) {
    return { projects: [], duplicatesSkipped: 0, missingFieldsNormalized: 0 };
  }

  const headers = rows[0].map(normalizeHeaderKey);
  const seenKeys = new Set<string>();
  const projects: InfrastructureProject[] = [];
  let duplicatesSkipped = 0;
  let missingFieldsNormalized = 0;

  for (let i = 1; i < rows.length; i++) {
    const cells = rows[i];
    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => {
      obj[h] = cells[idx] ?? '';
    });

    const projectCode = pickField(obj, ['project_code', 'project_id', 'code', 'id']);
    const name = pickField(obj, ['project_name', 'name', 'title']);
    if (!projectCode || !name) continue;

    const reportingMonth =
      pickField(obj, ['reporting_month', 'month', 'report_month']) || fallbackMonth;
    const dedupKey = `${projectCode}::${reportingMonth}`;
    if (seenKeys.has(dedupKey)) {
      duplicatesSkipped++;
      continue;
    }
    seenKeys.add(dedupKey);

    const sector = pickField(obj, ['sector', 'sector_name']) || 'Infrastructure';
    const implementingAgency =
      pickField(obj, ['implementing_agency', 'agency', 'executing_agency']) || 'Central PSU';
    const ministry = pickField(obj, ['ministry', 'nodal_ministry']) || 'MoSPI Monitored';
    const state = normalizeStateName(pickField(obj, ['state', 'state_ut', 'location_state']) || 'Multi-State');
    const corridorOrRegion =
      pickField(obj, ['corridor_or_region', 'region', 'corridor', 'district']) || `${state} Corridor`;

    const origCost = parseSafeNumber(pickField(obj, ['original_cost', 'original_cost_cr', 'sanctioned_cost']), 150);
    const antCost = parseSafeNumber(
      pickField(obj, ['anticipated_cost', 'anticipated_cost_cr', 'revised_cost']),
      origCost.value,
    );
    const cumExp = parseSafeNumber(
      pickField(obj, ['cumulative_expenditure', 'cumulative_expenditure_cr', 'expenditure']),
      0,
    );
    const physProg = parseSafeNumber(
      pickField(obj, ['physical_progress', 'physical_progress_pct', 'progress_pct']),
      0,
    );
    const delay = parseSafeNumber(
      pickField(obj, ['delay_months', 'time_overrun_months', 'slippage_months']),
      0,
    );

    if (origCost.wasMissing) missingFieldsNormalized++;
    if (antCost.wasMissing) missingFieldsNormalized++;
    if (cumExp.wasMissing) missingFieldsNormalized++;
    if (physProg.wasMissing) missingFieldsNormalized++;
    if (delay.wasMissing) missingFieldsNormalized++;

    const originalCostCr = Math.max(0, origCost.value);
    const anticipatedCostCr = Math.max(originalCostCr, antCost.value);
    const cumulativeExpenditureCr = Math.max(0, cumExp.value);
    const physicalProgressPct = Math.max(0, Math.min(100, physProg.value));
    const financialProgressPct = Number(
      Math.min(125, (cumulativeExpenditureCr / Math.max(anticipatedCostCr, 1)) * 100).toFixed(1),
    );
    const costOverrunCr = Number(Math.max(0, anticipatedCostCr - originalCostCr).toFixed(2));
    const costOverrunPct = Number(((costOverrunCr / originalCostCr) * 100).toFixed(1));
    const delayMonths = Math.max(0, Math.round(delay.value));

    const bottlenecksRaw = pickField(obj, ['bottlenecks', 'issues', 'delay_reasons']);
    const bottlenecks = bottlenecksRaw
      ? bottlenecksRaw
          .split(/[;|]/)
          .map((s) => s.trim())
          .filter((s) => s && !MISSING_TOKENS.has(s.toLowerCase()))
      : [];

    const approvalDate = pickField(obj, ['approval_date', 'date_of_approval']) || '2021-06-15';
    const originalCompletionDate =
      pickField(obj, ['original_completion_date', 'original_doc', 'doc_original']) || '2025-12-31';
    const anticipatedCompletionDate =
      pickField(obj, ['anticipated_completion_date', 'anticipated_doc', 'doc_anticipated']) ||
      originalCompletionDate;

    const remarks =
      pickField(obj, ['remarks', 'notes', 'status_note']) ||
      'Imported from monthly PAIMANA monitoring return.';

    const risk = assessProjectRisk({
      projectCode,
      name,
      sector,
      originalCostCr,
      anticipatedCostCr,
      cumulativeExpenditureCr,
      physicalProgressPct,
      delayMonths,
      bottlenecks,
    });

    const status = deriveProjectStatus(physicalProgressPct, costOverrunPct, delayMonths);

    projects.push({
      projectCode,
      name,
      sector,
      implementingAgency,
      ministry,
      state,
      corridorOrRegion,
      locationGranularity: 'State-level',
      reportingMonth,
      approvalDate,
      originalCompletionDate,
      anticipatedCompletionDate,
      originalCostCr,
      anticipatedCostCr,
      cumulativeExpenditureCr,
      physicalProgressPct,
      financialProgressPct,
      costOverrunCr,
      costOverrunPct,
      delayMonths,
      status,
      bottlenecks,
      remarks,
      sourceFile: filename,
      risk,
    });
  }

  return { projects, duplicatesSkipped, missingFieldsNormalized };
}
