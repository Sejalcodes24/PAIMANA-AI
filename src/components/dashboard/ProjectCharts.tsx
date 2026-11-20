import type { DashboardSummary, RiskTier } from '../../shared/types';
import { formatCrore, getRiskBarColor } from '../ui/StateViews';

interface ProjectChartsProps {
  summary: DashboardSummary;
  onFilterBySector: (sector: string) => void;
  onFilterByRiskTier: (tier: RiskTier) => void;
}

export function ProjectCharts({
  summary,
  onFilterBySector,
  onFilterByRiskTier,
}: ProjectChartsProps) {
  const sectors = summary.sectorBreakdown.slice(0, 7);
  const maxOutlay = Math.max(
    1,
    ...sectors.map((s) => Math.max(s.totalAnticipatedCostCr, s.totalOriginalCostCr)),
  );

  return (
    <section
      aria-label="Sector Outlay and Risk Distribution Charts"
      className="grid grid-cols-1 lg:grid-cols-12 gap-5"
    >
      {/* Sector Outlay Comparison */}
      <div className="lg:col-span-7 bg-white border border-[#D6E0EC] border-t-[3px] border-t-[#0B2545] rounded-md p-5 paimana-panel-layered">
        <div className="flex items-start justify-between gap-4 pb-3 border-b border-[#DCE3EC]">
          <div>
            <h2 className="text-base font-semibold text-[#0B2545]">
              Sector-Wise Original vs. Anticipated Cost
            </h2>
            <p className="text-xs text-slate-600 mt-0.5">
              Click any sector bar to filter the project directory. Values in ₹ Crore.
            </p>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-slate-600 shrink-0">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 bg-slate-300 inline-block rounded-xs" /> Original
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 bg-[#0284C7] inline-block rounded-xs" /> Anticipated
            </span>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          {sectors.map((sec) => {
            const origPct = (sec.totalOriginalCostCr / maxOutlay) * 100;
            const antPct = (sec.totalAnticipatedCostCr / maxOutlay) * 100;
            return (
              <button
                key={sec.sector}
                type="button"
                onClick={() => onFilterBySector(sec.sector)}
                className="w-full text-left group hover:bg-[#F8FAFC] p-1.5 -mx-1.5 rounded transition-colors cursor-pointer"
              >
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-medium text-[#0B2545] group-hover:text-[#0284C7] group-hover:underline">
                    {sec.sector} ({sec.projectCount})
                  </span>
                  <span className="font-mono tabular-nums text-slate-600">
                    {formatCrore(sec.totalAnticipatedCostCr)}
                  </span>
                </div>
                <div className="space-y-1">
                  <div className="w-full bg-slate-100 h-2 rounded-xs overflow-hidden">
                    <div
                      className="bg-slate-400 h-2 paimana-animated-bar transition-all duration-300"
                      style={{ width: `${Math.max(2, origPct)}%` }}
                    />
                  </div>
                  <div className="w-full bg-slate-100 h-2.5 rounded-xs overflow-hidden">
                    <div
                      className="bg-[#0B2545] group-hover:bg-[#0284C7] h-2.5 paimana-animated-bar transition-all duration-300"
                      style={{ width: `${Math.max(2, antPct)}%` }}
                    />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Risk Tier & Status Distribution */}
      <div className="lg:col-span-5 bg-white border border-[#D6E0EC] border-t-[3px] border-t-[#FF9933] rounded-md p-5 flex flex-col justify-between paimana-panel-layered">
        <div>
          <div className="pb-3 border-b border-[#DCE3EC]">
            <h2 className="text-base font-semibold text-[#0B2545]">
              Rule-Based Risk & Status Breakdown
            </h2>
            <p className="text-xs text-slate-600 mt-0.5">
              Click a risk tier to inspect matching projects.
            </p>
          </div>

          <div className="mt-4 space-y-3">
            {summary.riskDistribution.map((item) => (
              <button
                key={item.tier}
                type="button"
                onClick={() => onFilterByRiskTier(item.tier)}
                className="w-full text-left hover:bg-[#F8FAFC] p-1.5 -mx-1.5 rounded transition-colors cursor-pointer"
              >
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-medium text-slate-800">{item.tier} Risk</span>
                  <span className="font-mono tabular-nums text-slate-700">
                    {item.count} ({item.percentage}%)
                  </span>
                </div>
                <div className="w-full bg-slate-100 h-2.5 rounded-xs overflow-hidden">
                  <div
                    className="h-2.5 transition-all"
                    style={{
                      width: `${Math.max(item.count > 0 ? 3 : 0, item.percentage)}%`,
                      backgroundColor: getRiskBarColor(item.tier),
                    }}
                  />
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-[#DCE3EC]">
          <h3 className="text-xs font-semibold text-slate-700 mb-2.5">
            Commissioning & Cost Status ({summary.monthLabel})
          </h3>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {summary.statusBreakdown.map((st) => (
              <div
                key={st.status}
                className="border border-[#DCE3EC] rounded px-3 py-2 flex items-center justify-between bg-[#F8FAFC]"
              >
                <span className="text-slate-700 truncate pr-2">{st.status}</span>
                <span className="font-mono font-semibold tabular-nums text-[#0B2545]">
                  {st.count}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
