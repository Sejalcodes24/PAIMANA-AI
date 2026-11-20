import { useEffect, useState } from 'react';
import { ArrowLeft, MessageSquare, SlidersHorizontal } from 'lucide-react';
import { fetchProjectDetail } from '../../api/client';
import type { ProjectDetailResponse } from '../../shared/types';
import { ErrorState, formatCrore, LoadingState, RiskIndicator } from '../ui/StateViews';

interface ProjectDetailViewProps {
  projectCode: string;
  reportingMonth: string;
  onBack: () => void;
  onOpenWhatIf: (projectCode: string) => void;
  onAskAiAboutProject: (projectCode: string, projectName: string) => void;
}

export function ProjectDetailView({
  projectCode,
  reportingMonth,
  onBack,
  onOpenWhatIf,
  onAskAiAboutProject,
}: ProjectDetailViewProps) {
  const [detail, setDetail] = useState<ProjectDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    fetchProjectDetail(projectCode, reportingMonth)
      .then((res) => {
        if (active) {
          setDetail(res);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (active) {
          setError(err instanceof Error ? err.message : 'Unable to load project details.');
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [projectCode, reportingMonth]);

  if (loading) return <LoadingState label={`Loading ${projectCode} telemetry...`} />;
  if (error || !detail) {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0B2545] hover:underline cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Back to Projects</span>
        </button>
        <ErrorState message={error ?? 'Project record not found.'} />
      </div>
    );
  }

  const { project: p, history } = detail;

  return (
    <div className="space-y-5">
      <div>
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0B2545] hover:underline cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Back to Projects Directory</span>
        </button>
      </div>

      {/* Project Executive Header */}
      <div className="bg-white border border-[#DCE3EC] rounded-md p-6">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
              <span className="font-mono font-semibold text-[#0B2545]">{p.projectCode}</span>
              <span aria-hidden="true">·</span>
              <span>{p.sector}</span>
              <span aria-hidden="true">·</span>
              <span>{p.state} ({p.corridorOrRegion})</span>
              <span aria-hidden="true">·</span>
              <span>{p.status}</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-[#0B2545]">{p.name}</h1>
            <p className="text-xs text-slate-600">
              Implementing Agency: <strong className="text-slate-800">{p.implementingAgency}</strong>
              <span aria-hidden="true" className="mx-2 text-slate-300">|</span>
              Nodal Ministry: <strong className="text-slate-800">{p.ministry}</strong>
              <span aria-hidden="true" className="mx-2 text-slate-300">|</span>
              Location Granularity: <strong className="text-slate-800">{p.locationGranularity}</strong>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => onOpenWhatIf(p.projectCode)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold border border-[#0B2545] text-[#0B2545] rounded hover:bg-slate-50 transition-colors cursor-pointer whitespace-nowrap"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Run What-If Simulation</span>
            </button>
            <button
              type="button"
              onClick={() => onAskAiAboutProject(p.projectCode, p.name)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-[#0B2545] text-white rounded hover:bg-[#13315C] transition-colors cursor-pointer whitespace-nowrap"
            >
              <MessageSquare className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Ask AI About Project</span>
            </button>
          </div>
        </div>

        {/* Key Cost & Schedule Telemetry */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-5 border-t border-[#DCE3EC] text-xs">
          <div>
            <span className="text-slate-500 block">Original Sanctioned Cost</span>
            <span className="text-base font-bold font-mono tabular-nums text-[#0B2545] mt-0.5 block">
              {formatCrore(p.originalCostCr)}
            </span>
            <span className="text-[11px] text-slate-500">Approved {p.approvalDate}</span>
          </div>
          <div>
            <span className="text-slate-500 block">Anticipated Cost & Overrun</span>
            <span className="text-base font-bold font-mono tabular-nums text-[#0B2545] mt-0.5 block">
              {formatCrore(p.anticipatedCostCr)}
            </span>
            <span className="text-[11px] text-[#B91C1C] font-mono tabular-nums">
              +{formatCrore(p.costOverrunCr)} (+{p.costOverrunPct}%)
            </span>
          </div>
          <div>
            <span className="text-slate-500 block">Physical vs. Financial Progress</span>
            <span className="text-base font-bold font-mono tabular-nums text-[#0B2545] mt-0.5 block">
              {p.physicalProgressPct}% Physical
            </span>
            <span className="text-[11px] text-slate-600 font-mono tabular-nums">
              {formatCrore(p.cumulativeExpenditureCr)} ({p.financialProgressPct}% spent)
            </span>
          </div>
          <div>
            <span className="text-slate-500 block">Commissioning Schedule</span>
            <span className="text-base font-bold font-mono tabular-nums text-[#0B2545] mt-0.5 block">
              {p.anticipatedCompletionDate}
            </span>
            <span className="text-[11px] text-slate-600 font-mono tabular-nums">
              Original: {p.originalCompletionDate} ({p.delayMonths}m delay)
            </span>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-slate-100 text-xs text-slate-700">
          <strong className="text-[#0B2545]">Latest Monitoring Remarks ({p.reportingMonth}):</strong>{' '}
          {p.remarks}
        </div>
      </div>

      {/* Explainable Risk Comparison: Rule-Based vs ML Predictive */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white border border-[#DCE3EC] rounded-md p-5">
          <div className="flex items-start justify-between gap-3 pb-3 border-b border-[#DCE3EC]">
            <div>
              <h2 className="text-base font-semibold text-[#0B2545]">
                Rule-Based Risk Score (Deterministic Rubric)
              </h2>
              <p className="text-xs text-slate-600 mt-0.5">
                Transparent weighted rubric across schedule, cost variance, execution lag, and bottlenecks.
              </p>
            </div>
            <div className="shrink-0 text-right">
              <RiskIndicator score={p.risk.ruleBasedScore} tier={p.risk.ruleBasedTier} />
            </div>
          </div>

          <div className="mt-4 space-y-3.5">
            {p.risk.ruleFactors.map((factor) => {
              const pct = Math.round((factor.points / factor.maxPoints) * 100);
              return (
                <div key={factor.factor}>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-800">{factor.label}</span>
                    <span className="font-mono tabular-nums text-[#0B2545]">
                      {factor.points} / {factor.maxPoints} pts
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-xs mt-1 overflow-hidden">
                    <div className="bg-[#0B2545] h-2" style={{ width: `${pct}%` }} />
                  </div>
                  <p className="text-[11px] text-slate-600 mt-1">{factor.detail}</p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white border border-[#DCE3EC] rounded-md p-5">
          <div className="flex items-start justify-between gap-3 pb-3 border-b border-[#DCE3EC]">
            <div>
              <h2 className="text-base font-semibold text-[#0B2545]">
                ML Predictive Delay Hazard (12-Month Outlook)
              </h2>
              <p className="text-xs text-slate-600 mt-0.5">
                Model: {p.risk.mlModelName} — distinct from rule rubric.
              </p>
            </div>
            <div className="shrink-0 text-right">
              <RiskIndicator
                score={p.risk.mlDelayProbability}
                tier={p.risk.mlRiskTier}
                suffix="%"
              />
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {p.risk.mlAttributions.map((attr) => (
              <div
                key={attr.feature}
                className="border border-slate-200 rounded px-3 py-2 bg-[#F8FAFC]"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-800">{attr.feature}</span>
                  <span
                    className={`font-mono tabular-nums font-medium ${
                      attr.direction === 'increases_risk'
                        ? 'text-[#B91C1C]'
                        : 'text-[#15803D]'
                    }`}
                  >
                    {attr.impact >= 0 ? `+${attr.impact}` : attr.impact} log-odds impact
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 mt-0.5">{attr.explanation}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottlenecks, Recommendations & Monthly History */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-5 bg-white border border-[#DCE3EC] rounded-md p-5">
          <h2 className="text-base font-semibold text-[#0B2545] pb-3 border-b border-[#DCE3EC]">
            Active Bottlenecks & Corrective Actions
          </h2>

          <div className="mt-3">
            <p className="text-xs font-semibold text-slate-700">Reported Bottlenecks:</p>
            {p.bottlenecks.length === 0 ? (
              <p className="text-xs text-[#15803D] mt-1">
                No statutory or site bottlenecks flagged in {p.reportingMonth}.
              </p>
            ) : (
              <ul className="mt-1.5 space-y-1 text-xs text-slate-800 list-disc pl-4">
                {p.bottlenecks.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            )}
          </div>

          <div className="mt-4 pt-4 border-t border-slate-100">
            <p className="text-xs font-semibold text-slate-700">Recommended Interventions:</p>
            <ul className="mt-1.5 space-y-2 text-xs text-slate-700">
              {p.risk.recommendations.map((rec, i) => (
                <li key={i} className="leading-relaxed">
                  {i + 1}. {rec}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="lg:col-span-7 bg-white border border-[#DCE3EC] rounded-md overflow-hidden">
          <div className="px-5 py-4 border-b border-[#DCE3EC]">
            <h2 className="text-base font-semibold text-[#0B2545]">
              Monthly Monitoring History ({history.length} Snapshots)
            </h2>
            <p className="text-xs text-slate-600 mt-0.5">
              Progression across ingested monthly CSV returns for {p.projectCode}.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#F8FAFC] border-b border-[#DCE3EC] text-slate-600">
                  <th className="py-2.5 px-4 font-semibold">Month</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Physical %</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Cum. Spend</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Anticipated Cost</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Delay</th>
                  <th className="py-2.5 px-4 font-semibold text-right">Rule Risk</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono tabular-nums">
                {history.map((h) => (
                  <tr key={h.month}>
                    <td className="py-2.5 px-4 font-sans font-medium text-[#0B2545]">
                      {h.monthLabel}
                    </td>
                    <td className="py-2.5 px-3 text-right">{h.physicalProgressPct}%</td>
                    <td className="py-2.5 px-3 text-right">
                      {formatCrore(h.cumulativeExpenditureCr)}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      {formatCrore(h.anticipatedCostCr)}
                    </td>
                    <td className="py-2.5 px-3 text-right">{h.delayMonths} mo</td>
                    <td className="py-2.5 px-4 text-right font-semibold text-[#0B2545]">
                      {h.ruleBasedScore}/100
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
