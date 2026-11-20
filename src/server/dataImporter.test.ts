import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isDuplicateCopyFilename,
  normalizeStateName,
  parseCsvRows,
  parseMonthlyCsv,
  parseSafeNumber,
} from './dataImporter';
import { getDashboardSummary, loadRepositoryStore } from './repository';

test('isDuplicateCopyFilename flags (1) and Copy filenames safely', () => {
  assert.equal(isDuplicateCopyFilename('paimana_2026_02 (1).csv'), true);
  assert.equal(isDuplicateCopyFilename('paimana_2026_02 - Copy.csv'), true);
  assert.equal(isDuplicateCopyFilename('paimana_2026_02.csv'), false);
});

test('normalizeStateName maps aliases to GeoJSON ST_NM names', () => {
  assert.equal(normalizeStateName('Orissa'), 'Odisha');
  assert.equal(normalizeStateName('Jammu and Kashmir'), 'Jammu & Kashmir');
  assert.equal(normalizeStateName('NCT of Delhi'), 'Delhi');
});

test('parseSafeNumber handles currency symbols, commas, and missing N/A tokens', () => {
  assert.deepEqual(parseSafeNumber('₹12,450.5', 0), { value: 12450.5, wasMissing: false });
  assert.deepEqual(parseSafeNumber('N/A', 150), { value: 150, wasMissing: true });
  assert.deepEqual(parseSafeNumber('--', 0), { value: 0, wasMissing: true });
});

test('parseMonthlyCsv normalizes variant headers and deduplicates repeated rows', () => {
  const csv = [
    'Project ID,Project Name,Sector Name,State/UT,Month,Original Cost (Rs. Crore),Revised Cost (Rs. Crore),Expenditure (Rs. Crore),Physical Progress (%),Time Overrun (Months),Delay Reasons',
    'PAI-X-1,"Corridor A, Phase 1",Railways,Orissa,2026-01,1000,N/A,400,40,12,Land Acquisition',
    'PAI-X-1,"Corridor A, Phase 1",Railways,Orissa,2026-01,1000,N/A,400,40,12,Land Acquisition',
  ].join('\n');

  const rows = parseCsvRows(csv);
  assert.equal(rows.length, 3);

  const res = parseMonthlyCsv(csv, 'test.csv', '2026-01');
  assert.equal(res.projects.length, 1);
  assert.equal(res.duplicatesSkipped, 1);
  assert.equal(res.projects[0].state, 'Odisha');
  assert.equal(res.projects[0].anticipatedCostCr, 1000);
});

test('loadRepositoryStore loads all 3 monthly snapshots and skips duplicate (1) file', () => {
  const store = loadRepositoryStore(true);
  assert.deepEqual(store.monthsSortedDesc, ['2026-03', '2026-02', '2026-01']);
  assert.ok(store.dataIntegrity.skippedFiles.includes('paimana_2026_02 (1).csv'));
  assert.equal(store.byMonth.get('2026-03')?.length, 28);
  assert.equal(store.byMonth.get('2026-02')?.length, 28);
  assert.equal(store.byMonth.get('2026-01')?.length, 28);
});

test('getDashboardSummary computes real sectorBreakdown progress, risk, and topProjects', () => {
  const summary = getDashboardSummary('2026-03');
  const railways = summary.sectorBreakdown.find((s) => s.sector === 'Railways');
  const power = summary.sectorBreakdown.find((s) => s.sector === 'Power');
  assert.ok(railways);
  assert.equal(railways.projectCount, 6);
  assert.ok(railways.avgPhysicalProgressPct > 0);
  assert.ok(railways.topProjects.length > 0);
  assert.ok(power);
  assert.equal(power.projectCount, 4);
  assert.ok(power.topProjects.some((p) => p.projectCode === 'PAI-PWR-105'));
});
