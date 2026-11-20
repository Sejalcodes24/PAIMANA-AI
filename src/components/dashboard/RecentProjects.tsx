import type { FlashReport, InfrastructureProject } from '../../shared/types';
import { formatCrore, RiskIndicator } from '../ui/StateViews';

interface RecentProjectsProps {
  watchlist: InfrastructureProject[];
  flashReports: FlashReport[];
  onSelectProject: (projectCode: string) => void;
  onViewAllProjects: () => void;
  onViewReports: () => void;
}

export function RecentProjects({
  watchlist,
  flashReports,
  onSelectProject,
  onViewAllProjects,
  onViewReports,
}: RecentProjectsProps) {
  return (
    <section
      aria-label="High-Risk Watchlist and Monthly Flash Reports"
      className="grid grid-cols-1 lg:grid-cols-12 gap-5"
    >
      {/* High-Risk Watchlist Table */}
      <div className="lg:col-span-8 bg-white border border-[#D6E0EC] border-t-[3px] border-t-[#0B2545] rounded-md overflow-hidden paimana-panel-layered">
        <div className="px-5 py-4 bg-gradient-to-r from-[#F4F7FB] via-white to-[#F8FAFC] border-b border-[#DCE3EC] flex items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-[#0B2545]">
              Priority Risk Watchlist
            </h2>
            <p className="text-xs text-slate-600 mt-0.5">
              Top projects ranked by rule-based risk score alongside ML predicted delay probability.
            </p>
          </div>
          <button
            type="button"
            onClick={onViewAllProjects}
            className="text-xs font-semibold text-[#0B2545] hover:underline whitespace-nowrap shrink-0 cursor-pointer"
          >
            View All Projects &rarr;
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#F8FAFC] border-b border-[#DCE3EC] text-slate-600">
                <th className="py-2.5 px-4 font-semibold">Project</th>
                <th className="py-2.5 px-3 font-semibold">State</th>
                <th className="py-2.5 px-3 font-semibold text-right">Anticipated Cost</th>
                <th className="py-2.5 px-3 font-semibold text-right">Delay</th>
                <th className="py-2.5 px-3 font-semibold text-right">Rule Risk</th>
                <th className="py-2.5 px-4 font-semibold text-right">ML Hazard</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {watchlist.map((p) => (
                <tr key={p.projectCode} className="hover:bg-[#F8FAFC] transition-colors">
                  <td className="py-2.5 px-4 max-w-[260px]">
                    <button
                      type="button"
                      onClick={() => onSelectProject(p.projectCode)}
                      className="text-left font-medium text-[#0B2545] hover:underline block truncate w-full cursor-pointer"
                    >
                      {p.name}
                    </button>
                    <span className="text-[11px] text-slate-500 font-mono">
                      {p.projectCode} · {p.sector}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-slate-700 whitespace-nowrap">{p.state}</td>
                  <td className="py-2.5 px-3 text-right font-mono tabular-nums whitespace-nowrap text-slate-800">
                    {formatCrore(p.anticipatedCostCr)}
                    <span className="block text-[11px] text-slate-500">
                      +{p.costOverrunPct}%
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono tabular-nums whitespace-nowrap text-slate-800">
                    {p.delayMonths} mo
                  </td>
                  <td className="py-2.5 px-3 text-right whitespace-nowrap">
                    <RiskIndicator
                      score={p.risk.ruleBasedScore}
                      tier={p.risk.ruleBasedTier}
                    />
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono tabular-nums whitespace-nowrap text-slate-700">
                    {p.risk.mlDelayProbability}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* What's New / Monthly Flash Reports Panel */}
      <div className="lg:col-span-4 bg-white border border-[#D6E0EC] border-t-[3px] border-t-[#138808] rounded-md p-5 flex flex-col justify-between paimana-panel-layered">
        <div>
          <div className="flex items-center justify-between gap-2 pb-3 border-b border-[#DCE3EC]">
            <h2 className="text-base font-semibold text-[#0B2545]">
              What&rsquo;s New · Flash Reports
            </h2>
            <button
              type="button"
              onClick={onViewReports}
              className="text-xs font-semibold text-[#0B2545] hover:underline whitespace-nowrap shrink-0 cursor-pointer"
            >
              Archive &rarr;
            </button>
          </div>

          <div className="mt-3 divide-y divide-slate-100">
            {flashReports.map((rep) => (
              <div key={rep.id} className="py-3 first:pt-1 last:pb-0">
                <div className="flex items-center justify-between text-[11px] text-slate-500">
                  <span className="font-mono font-medium text-[#0B2545]">{rep.id}</span>
                  <span>Report month: {rep.publishedDate}</span>
                </div>
                <a
                  href={rep.reportUrl || undefined}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(event) => { if (!rep.reportUrl) { event.preventDefault(); onViewReports(); } }}
                  className="text-left text-xs font-semibold text-slate-900 hover:text-[#0B2545] hover:underline mt-1 block"
                >
                  {rep.title}
                </a>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed line-clamp-2">
                  {rep.summary}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-[#DCE3EC] text-[11px] text-slate-500">
          Monthly source reports are linked here. July opens the official PIB release; April–June open the included report PDFs.
        </div>
      </div>
    </section>
  );
}
