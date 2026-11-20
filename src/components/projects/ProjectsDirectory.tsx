import { useEffect, useState } from 'react';
import { ArrowUpDown, Search, X } from 'lucide-react';
import { fetchProjects, type ProjectsQueryResponse } from '../../api/client';
import { EmptyState, ErrorState, formatCrore, LoadingState, RiskIndicator } from '../ui/StateViews';

interface ProjectsDirectoryProps {
  reportingMonth: string;
  initialStateFilter?: string;
  initialSectorFilter?: string;
  initialRiskTierFilter?: string;
  onSelectProject: (projectCode: string) => void;
}

export function ProjectsDirectory({
  reportingMonth,
  initialStateFilter = 'All',
  initialSectorFilter = 'All',
  initialRiskTierFilter = 'All',
  onSelectProject,
}: ProjectsDirectoryProps) {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [stateFilter, setStateFilter] = useState(initialStateFilter);
  const [sectorFilter, setSectorFilter] = useState(initialSectorFilter);
  const [riskTierFilter, setRiskTierFilter] = useState(initialRiskTierFilter);
  const [statusFilter, setStatusFilter] = useState('All');
  const [sortBy, setSortBy] = useState('riskScore');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);

  const [data, setData] = useState<ProjectsQueryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  // Sync external drill-down filter props
  useEffect(() => {
    setStateFilter(initialStateFilter);
    setPage(1);
  }, [initialStateFilter]);

  useEffect(() => {
    setSectorFilter(initialSectorFilter);
    setPage(1);
  }, [initialSectorFilter]);

  useEffect(() => {
    setRiskTierFilter(initialRiskTierFilter);
    setPage(1);
  }, [initialRiskTierFilter]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 200);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    fetchProjects({
      month: reportingMonth,
      search: debouncedSearch,
      state: stateFilter,
      sector: sectorFilter,
      riskTier: riskTierFilter,
      status: statusFilter,
      sortBy,
      sortOrder,
      page,
      pageSize: 10,
    })
      .then((res) => {
        if (active) {
          setData(res);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (active) {
          setError(err instanceof Error ? err.message : 'Failed to load projects.');
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [
    reportingMonth,
    debouncedSearch,
    stateFilter,
    sectorFilter,
    riskTierFilter,
    statusFilter,
    sortBy,
    sortOrder,
    page,
    reloadTick,
  ]);

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortBy(column);
      setSortOrder('desc');
    }
    setPage(1);
  };

  const resetFilters = () => {
    setSearch('');
    setDebouncedSearch('');
    setStateFilter('All');
    setSectorFilter('All');
    setRiskTierFilter('All');
    setStatusFilter('All');
    setSortBy('riskScore');
    setSortOrder('desc');
    setPage(1);
  };

  const hasActiveFilters =
    search !== '' ||
    stateFilter !== 'All' ||
    sectorFilter !== 'All' ||
    riskTierFilter !== 'All' ||
    statusFilter !== 'All';

  return (
    <div className="space-y-5">
      <div className="bg-white border border-[#DCE3EC] rounded-md p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-[#DCE3EC]">
          <div>
            <h1 className="text-xl font-bold text-[#0B2545]">
              Central Sector Infrastructure Projects Directory
            </h1>
            <p className="text-xs text-slate-600 mt-0.5">
              Search, filter, and sort active PAIMANA records for{' '}
              <span className="font-medium text-slate-800">{data?.monthLabel ?? reportingMonth}</span>.
            </p>
          </div>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-[#DCE3EC] rounded text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Reset Filters</span>
            </button>
          )}
        </div>

        {/* Filter Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 mt-4">
          <div className="lg:col-span-1">
            <label htmlFor="project-search-input" className="block text-[11px] font-semibold text-slate-600 mb-1">
              Search Code, Name, Bottleneck
            </label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" aria-hidden="true" />
              <input
                id="project-search-input"
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="e.g. Metro, PAI-RLY..."
                className="w-full pl-8 pr-3 py-1.5 text-xs border border-[#DCE3EC] rounded bg-white text-slate-900 focus-visible:outline-2 focus-visible:outline-[#0B2545]"
              />
            </div>
          </div>

          <div>
            <label htmlFor="filter-state" className="block text-[11px] font-semibold text-slate-600 mb-1">
              State / Union Territory
            </label>
            <select
              id="filter-state"
              value={stateFilter}
              onChange={(e) => {
                setStateFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-2.5 py-1.5 text-xs border border-[#DCE3EC] rounded bg-white text-slate-900 cursor-pointer"
            >
              <option value="All">All States ({data?.facets.states.length ?? 0})</option>
              {(data?.facets.states ?? []).map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="filter-sector" className="block text-[11px] font-semibold text-slate-600 mb-1">
              Infrastructure Sector
            </label>
            <select
              id="filter-sector"
              value={sectorFilter}
              onChange={(e) => {
                setSectorFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-2.5 py-1.5 text-xs border border-[#DCE3EC] rounded bg-white text-slate-900 cursor-pointer"
            >
              <option value="All">All Sectors</option>
              <optgroup label="Featured sector groups">
                <option value="@power">Power & Nuclear Energy</option>
                <option value="@roads">Roadways & National Expressways</option>
                <option value="@urban">Urban Metro & Transit</option>
              </optgroup>
              <optgroup label="Source categories">
                {(data?.facets.sectors ?? []).map((sec) => (
                  <option key={sec} value={sec}>{sec}</option>
                ))}
              </optgroup>
            </select>
          </div>

          <div>
            <label htmlFor="filter-risk" className="block text-[11px] font-semibold text-slate-600 mb-1">
              Rule-Based Risk Tier
            </label>
            <select
              id="filter-risk"
              value={riskTierFilter}
              onChange={(e) => {
                setRiskTierFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-2.5 py-1.5 text-xs border border-[#DCE3EC] rounded bg-white text-slate-900 cursor-pointer"
            >
              <option value="All">All Risk Tiers</option>
              <option value="Critical">Critical (&ge;70)</option>
              <option value="High">High (48–69)</option>
              <option value="Moderate">Moderate (25–47)</option>
              <option value="Low">Low (&lt;25)</option>
            </select>
          </div>

          <div>
            <label htmlFor="filter-status" className="block text-[11px] font-semibold text-slate-600 mb-1">
              Commissioning Status
            </label>
            <select
              id="filter-status"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-2.5 py-1.5 text-xs border border-[#DCE3EC] rounded bg-white text-slate-900 cursor-pointer"
            >
              <option value="All">All Statuses</option>
              {(data?.facets.statuses ?? []).map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {loading && <LoadingState label="Querying project directory..." />}
      {!loading && error && (
        <ErrorState
          message={error}
          onRetry={() => setReloadTick((t) => t + 1)}
        />
      )}
      {!loading && !error && data && data.items.length === 0 && (
        <EmptyState
          title="No matching infrastructure projects"
          description="No records matched your current search or state/sector filters for this reporting month."
          actionLabel="Reset All Filters"
          onAction={resetFilters}
        />
      )}

      {!loading && !error && data && data.items.length > 0 && (
        <div className="bg-white border border-[#DCE3EC] rounded-md overflow-hidden">
          <div className="px-5 py-3 bg-[#F8FAFC] border-b border-[#DCE3EC] flex items-center justify-between text-xs text-slate-600">
            <span className="tabular-nums">
              Showing <strong className="text-[#0B2545]">{data.items.length}</strong> of{' '}
              <strong className="text-[#0B2545]">{data.total}</strong> matching projects
            </span>
            <span className="tabular-nums">
              Page {data.page} of {data.totalPages}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#F8FAFC] border-b border-[#DCE3EC] text-slate-600">
                  <th className="py-2.5 px-4 font-semibold">
                    <button
                      type="button"
                      onClick={() => handleSort('name')}
                      className="inline-flex items-center gap-1 hover:text-[#0B2545] cursor-pointer"
                    >
                      <span>Project / Agency</span>
                      <ArrowUpDown className="w-3 h-3" aria-hidden="true" />
                    </button>
                  </th>
                  <th className="py-2.5 px-3 font-semibold">State / Sector</th>
                  <th className="py-2.5 px-3 font-semibold text-right">
                    <button
                      type="button"
                      onClick={() => handleSort('anticipatedCostCr')}
                      className="inline-flex items-center gap-1 hover:text-[#0B2545] cursor-pointer"
                    >
                      <span>Anticipated Cost</span>
                      <ArrowUpDown className="w-3 h-3" aria-hidden="true" />
                    </button>
                  </th>
                  <th className="py-2.5 px-3 font-semibold text-right">
                    <button
                      type="button"
                      onClick={() => handleSort('physicalProgressPct')}
                      className="inline-flex items-center gap-1 hover:text-[#0B2545] cursor-pointer"
                    >
                      <span>Progress</span>
                      <ArrowUpDown className="w-3 h-3" aria-hidden="true" />
                    </button>
                  </th>
                  <th className="py-2.5 px-3 font-semibold text-right">
                    <button
                      type="button"
                      onClick={() => handleSort('delayMonths')}
                      className="inline-flex items-center gap-1 hover:text-[#0B2545] cursor-pointer"
                    >
                      <span>Delay</span>
                      <ArrowUpDown className="w-3 h-3" aria-hidden="true" />
                    </button>
                  </th>
                  <th className="py-2.5 px-3 font-semibold text-right">
                    <button
                      type="button"
                      onClick={() => handleSort('riskScore')}
                      className="inline-flex items-center gap-1 hover:text-[#0B2545] cursor-pointer"
                    >
                      <span>Rule Risk</span>
                      <ArrowUpDown className="w-3 h-3" aria-hidden="true" />
                    </button>
                  </th>
                  <th className="py-2.5 px-4 font-semibold text-right">
                    <button
                      type="button"
                      onClick={() => handleSort('mlProbability')}
                      className="inline-flex items-center gap-1 hover:text-[#0B2545] cursor-pointer"
                    >
                      <span>ML Hazard</span>
                      <ArrowUpDown className="w-3 h-3" aria-hidden="true" />
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.items.map((p) => (
                  <tr key={p.projectCode} className="hover:bg-[#F8FAFC] transition-colors">
                    <td className="py-3 px-4 max-w-[290px]">
                      <button
                        type="button"
                        onClick={() => onSelectProject(p.projectCode)}
                        className="text-left font-semibold text-[#0B2545] hover:underline block truncate w-full cursor-pointer"
                      >
                        {p.name}
                      </button>
                      <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1.5">
                        <span className="font-mono">{p.projectCode}</span>
                        <span aria-hidden="true">·</span>
                        <span>{p.implementingAgency}</span>
                      </div>
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      <div className="font-medium text-slate-800">{p.state}</div>
                      <div className="text-[11px] text-slate-500">{p.sector}</div>
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums whitespace-nowrap">
                      <div className="text-slate-900">{formatCrore(p.anticipatedCostCr)}</div>
                      <div className="text-[11px] text-slate-500">
                        +{p.costOverrunPct}% vs orig
                      </div>
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums whitespace-nowrap">
                      <div className="text-slate-900">{p.physicalProgressPct}%</div>
                      <div className="text-[11px] text-slate-500">{p.status}</div>
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums whitespace-nowrap text-slate-800">
                      {p.delayMonths} mo
                    </td>
                    <td className="py-3 px-3 text-right whitespace-nowrap">
                      <RiskIndicator
                        score={p.risk.ruleBasedScore}
                        tier={p.risk.ruleBasedTier}
                      />
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums whitespace-nowrap text-slate-700">
                      {p.risk.mlDelayProbability}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="px-5 py-3 bg-[#F8FAFC] border-t border-[#DCE3EC] flex items-center justify-between text-xs">
            <button
              type="button"
              disabled={data.page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-3 py-1.5 border border-[#DCE3EC] rounded bg-white text-slate-700 disabled:opacity-40 hover:bg-slate-50 cursor-pointer disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <span className="text-slate-600 tabular-nums">
              Page {data.page} of {data.totalPages}
            </span>
            <button
              type="button"
              disabled={data.page >= data.totalPages}
              onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
              className="px-3 py-1.5 border border-[#DCE3EC] rounded bg-white text-slate-700 disabled:opacity-40 hover:bg-slate-50 cursor-pointer disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
