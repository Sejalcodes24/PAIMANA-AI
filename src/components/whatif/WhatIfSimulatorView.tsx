import { useEffect, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { fetchProjects, runSimulationApi } from '../../api/client';
import type { InfrastructureProject, WhatIfResult } from '../../shared/types';
import { ErrorState, formatCrore, LoadingState, RiskIndicator } from '../ui/StateViews';

interface WhatIfSimulatorViewProps {
  reportingMonth: string;
  initialProjectCode?: string;
}

export function WhatIfSimulatorView({
  reportingMonth,
  initialProjectCode,
}: WhatIfSimulatorViewProps) {
  const [projects, setProjects] = useState<InfrastructureProject[]>([]);
  const [selectedCode, setSelectedCode] = useState<string>(initialProjectCode || '');
  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const [physicalProgressPct, setPhysicalProgressPct] = useState(60);
  const [anticipatedCostCr, setAnticipatedCostCr] = useState(1000);
  const [delayMonths, setDelayMonths] = useState(12);
  const [resolvedBottlenecks, setResolvedBottlenecks] = useState<string[]>([]);

  const [simResult, setSimResult] = useState<WhatIfResult | null>(null);
  const [simLoading, setSimLoading] = useState(false);
  const [simError, setSimError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoadingList(true);
    fetchProjects({ month: reportingMonth, pageSize: 50, sortBy: 'riskScore', sortOrder: 'desc' })
      .then((res) => {
        if (!active) return;
        setProjects(res.items);
        const target =
          (initialProjectCode &&
            res.items.find((p) => p.projectCode === initialProjectCode)) ||
          res.items[0];
        if (target) {
          setSelectedCode(target.projectCode);
          setPhysicalProgressPct(target.physicalProgressPct);
          setAnticipatedCostCr(target.anticipatedCostCr);
          setDelayMonths(target.delayMonths);
          setResolvedBottlenecks([]);
        }
        setLoadingList(false);
      })
      .catch((err) => {
        if (active) {
          setListError(err instanceof Error ? err.message : 'Unable to load projects for simulation.');
          setLoadingList(false);
        }
      });
    return () => {
      active = false;
    };
  }, [reportingMonth, initialProjectCode]);

  const activeProject = projects.find((p) => p.projectCode === selectedCode) ?? null;

  const handleProjectChange = (code: string) => {
    setSelectedCode(code);
    const proj = projects.find((p) => p.projectCode === code);
    if (proj) {
      setPhysicalProgressPct(proj.physicalProgressPct);
      setAnticipatedCostCr(proj.anticipatedCostCr);
      setDelayMonths(proj.delayMonths);
      setResolvedBottlenecks([]);
      setSimResult(null);
    }
  };

  // Run backend simulation whenever parameters settle
  useEffect(() => {
    if (!activeProject) return;
    let active = true;
    setSimLoading(true);
    setSimError(null);

    const timer = setTimeout(() => {
      runSimulationApi({
        projectCode: activeProject.projectCode,
        reportingMonth,
        physicalProgressPct,
        anticipatedCostCr,
        delayMonths,
        resolvedBottlenecks,
      })
        .then((res) => {
          if (active) {
            setSimResult(res);
            setSimLoading(false);
          }
        })
        .catch((err) => {
          if (active) {
            setSimError(err instanceof Error ? err.message : 'Simulation failed.');
            setSimLoading(false);
          }
        });
    }, 120);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [
    activeProject,
    reportingMonth,
    physicalProgressPct,
    anticipatedCostCr,
    delayMonths,
    resolvedBottlenecks,
  ]);

  const toggleBottleneck = (b: string) => {
    setResolvedBottlenecks((prev) =>
      prev.includes(b) ? prev.filter((item) => item !== b) : [...prev, b],
    );
  };

  const resetScenario = () => {
    if (!activeProject) return;
    setPhysicalProgressPct(activeProject.physicalProgressPct);
    setAnticipatedCostCr(activeProject.anticipatedCostCr);
    setDelayMonths(activeProject.delayMonths);
    setResolvedBottlenecks([]);
  };

  if (loadingList) return <LoadingState label="Loading What-If Simulation Lab..." />;
  if (listError) return <ErrorState message={listError} />;
  if (!activeProject) return <ErrorState message="No projects available for simulation." />;

  return (
    <div className="space-y-5">
      <div className="bg-white border border-[#DCE3EC] rounded-md p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-[#DCE3EC]">
          <div>
            <h1 className="text-xl font-bold text-[#0B2545]">
              What-If Risk Scenario Simulator
            </h1>
            <p className="text-xs text-slate-600 mt-0.5">
              Adjust schedule, anticipated cost, physical completion, or bottleneck clearances to evaluate how both Rule-Based and ML Risk respond.
            </p>
          </div>
          <div className="px-3 py-1.5 bg-amber-50 border border-amber-300 rounded text-xs font-semibold text-amber-900 whitespace-nowrap shrink-0">
            Simulation Mode · Official Records Unchanged
          </div>
        </div>

        <div className="mt-4 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="flex-1 max-w-xl">
            <label htmlFor="sim-project-select" className="block text-xs font-semibold text-slate-700 mb-1">
              Select Project Baseline ({reportingMonth})
            </label>
            <select
              id="sim-project-select"
              value={selectedCode}
              onChange={(e) => handleProjectChange(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-[#DCE3EC] rounded bg-white text-[#0B2545] font-medium cursor-pointer"
            >
              {projects.map((p) => (
                <option key={p.projectCode} value={p.projectCode}>
                  {p.projectCode} — {p.name} ({p.state}, Rule Risk {p.risk.ruleBasedScore}/100)
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={resetScenario}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium border border-[#DCE3EC] rounded text-slate-700 hover:bg-slate-50 cursor-pointer shrink-0"
          >
            <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Reset to Official Baseline</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Controls Panel */}
        <div className="lg:col-span-5 bg-white border border-[#DCE3EC] rounded-md p-5 space-y-5">
          <h2 className="text-base font-semibold text-[#0B2545] pb-2 border-b border-[#DCE3EC]">
            Simulated Input Parameters
          </h2>

          <div>
            <div className="flex items-center justify-between text-xs mb-1">
              <label htmlFor="sim-delay-range" className="font-semibold text-slate-800">
                Simulated Schedule Slippage (Months)
              </label>
              <span className="font-mono font-semibold text-[#0B2545] tabular-nums">
                {delayMonths} mo (Baseline: {activeProject.delayMonths} mo)
              </span>
            </div>
            <input
              id="sim-delay-range"
              type="range"
              min={0}
              max={Math.max(60, activeProject.delayMonths + 24)}
              value={delayMonths}
              onChange={(e) => setDelayMonths(Number(e.target.value))}
              className="w-full accent-[#0B2545] cursor-pointer"
            />
          </div>

          <div>
            <div className="flex items-center justify-between text-xs mb-1">
              <label htmlFor="sim-cost-input" className="font-semibold text-slate-800">
                Simulated Anticipated Cost (₹ Crore)
              </label>
              <span className="font-mono text-slate-500 tabular-nums">
                Original: {formatCrore(activeProject.originalCostCr)}
              </span>
            </div>
            <input
              id="sim-cost-input"
              type="number"
              min={Math.round(activeProject.originalCostCr * 0.5)}
              max={Math.round(activeProject.originalCostCr * 5)}
              step={100}
              value={anticipatedCostCr}
              onChange={(e) => setAnticipatedCostCr(Math.max(100, Number(e.target.value) || 100))}
              className="w-full px-3 py-2 text-xs font-mono tabular-nums border border-[#DCE3EC] rounded bg-white text-[#0B2545]"
            />
          </div>

          <div>
            <div className="flex items-center justify-between text-xs mb-1">
              <label htmlFor="sim-progress-range" className="font-semibold text-slate-800">
                Simulated Physical Completion (%)
              </label>
              <span className="font-mono font-semibold text-[#0B2545] tabular-nums">
                {physicalProgressPct}% (Baseline: {activeProject.physicalProgressPct}%)
              </span>
            </div>
            <input
              id="sim-progress-range"
              type="range"
              min={0}
              max={100}
              step={0.5}
              value={physicalProgressPct}
              onChange={(e) => setPhysicalProgressPct(Number(e.target.value))}
              className="w-full accent-[#0B2545] cursor-pointer"
            />
          </div>

          <div className="pt-2 border-t border-slate-100">
            <p className="text-xs font-semibold text-slate-800 mb-2">
              Simulate Resolution of Active Bottlenecks
            </p>
            {activeProject.bottlenecks.length === 0 ? (
              <p className="text-xs text-slate-500">
                No active bottlenecks reported in the official baseline.
              </p>
            ) : (
              <div className="space-y-2">
                {activeProject.bottlenecks.map((b) => {
                  const checked = resolvedBottlenecks.includes(b);
                  return (
                    <label
                      key={b}
                      className="flex items-center gap-2.5 text-xs text-slate-800 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleBottleneck(b)}
                        className="rounded border-slate-300 accent-[#0B2545]"
                      />
                      <span>Mark &ldquo;{b}&rdquo; as resolved</span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Comparison Output Panel */}
        <div className="lg:col-span-7 bg-white border border-[#DCE3EC] rounded-md p-5">
          <div className="flex items-center justify-between pb-3 border-b border-[#DCE3EC]">
            <div>
              <h2 className="text-base font-semibold text-[#0B2545]">
                Baseline vs. Simulated Risk Output
              </h2>
              <p className="text-xs text-slate-600 mt-0.5">
                {simResult?.simulationNotice ?? 'Computing simulated risk metrics...'}
              </p>
            </div>
            {simLoading && (
              <span className="text-xs text-slate-500">Recalculating...</span>
            )}
          </div>

          {simError && <ErrorState message={simError} />}

          {simResult && (
            <div className="mt-4 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="border border-[#DCE3EC] rounded p-4 bg-[#F8FAFC]">
                  <p className="text-[11px] font-semibold text-slate-500">
                    Rule-Based Score (Simulated)
                  </p>
                  <div className="mt-1.5">
                    <RiskIndicator
                      score={simResult.simulated.risk.ruleBasedScore}
                      tier={simResult.simulated.risk.ruleBasedTier}
                    />
                  </div>
                  <p className="text-[11px] font-mono tabular-nums text-slate-600 mt-1.5">
                    Baseline: {simResult.baseline.risk.ruleBasedScore}/100 · Delta:{' '}
                    <span
                      className={
                        simResult.delta.ruleBasedScoreDelta <= 0
                          ? 'text-[#15803D] font-semibold'
                          : 'text-[#B91C1C] font-semibold'
                      }
                    >
                      {simResult.delta.ruleBasedScoreDelta > 0
                        ? `+${simResult.delta.ruleBasedScoreDelta}`
                        : simResult.delta.ruleBasedScoreDelta}
                    </span>
                  </p>
                </div>

                <div className="border border-[#DCE3EC] rounded p-4 bg-[#F8FAFC]">
                  <p className="text-[11px] font-semibold text-slate-500">
                    ML Delay Hazard (Simulated)
                  </p>
                  <div className="mt-1.5">
                    <RiskIndicator
                      score={simResult.simulated.risk.mlDelayProbability}
                      tier={simResult.simulated.risk.mlRiskTier}
                      suffix="%"
                    />
                  </div>
                  <p className="text-[11px] font-mono tabular-nums text-slate-600 mt-1.5">
                    Baseline: {simResult.baseline.risk.mlDelayProbability}% · Delta:{' '}
                    <span
                      className={
                        simResult.delta.mlDelayProbabilityDelta <= 0
                          ? 'text-[#15803D] font-semibold'
                          : 'text-[#B91C1C] font-semibold'
                      }
                    >
                      {simResult.delta.mlDelayProbabilityDelta > 0
                        ? `+${simResult.delta.mlDelayProbabilityDelta}%`
                        : `${simResult.delta.mlDelayProbabilityDelta}%`}
                    </span>
                  </p>
                </div>

                <div className="border border-[#DCE3EC] rounded p-4 bg-[#F8FAFC]">
                  <p className="text-[11px] font-semibold text-slate-500">
                    Simulated Cost Overrun
                  </p>
                  <p className="text-sm font-bold font-mono tabular-nums text-[#0B2545] mt-1.5">
                    {simResult.simulated.costOverrunPct}%
                  </p>
                  <p className="text-[11px] font-mono tabular-nums text-slate-600 mt-1.5">
                    Baseline: {simResult.baseline.costOverrunPct}% · Delta:{' '}
                    {simResult.delta.costOverrunPctDelta > 0
                      ? `+${simResult.delta.costOverrunPctDelta}%`
                      : `${simResult.delta.costOverrunPctDelta}%`}
                  </p>
                </div>
              </div>

              <div>
                <h3 className="text-xs font-semibold text-slate-700 mb-2">
                  Simulated Rule-Factor Breakdown
                </h3>
                <div className="divide-y divide-slate-100 border border-[#DCE3EC] rounded text-xs">
                  {simResult.simulated.risk.ruleFactors.map((f, idx) => {
                    const basePts = simResult.baseline.risk.ruleFactors[idx]?.points ?? f.points;
                    const diff = f.points - basePts;
                    return (
                      <div
                        key={f.factor}
                        className="px-4 py-2.5 flex items-center justify-between gap-4"
                      >
                        <div>
                          <span className="font-medium text-slate-900">{f.label}</span>
                          <span className="block text-[11px] text-slate-500">{f.detail}</span>
                        </div>
                        <div className="font-mono tabular-nums shrink-0 text-right">
                          <span className="font-semibold text-[#0B2545]">
                            {f.points}/{f.maxPoints}
                          </span>
                          {diff !== 0 && (
                            <span
                              className={`block text-[11px] ${
                                diff < 0 ? 'text-[#15803D]' : 'text-[#B91C1C]'
                              }`}
                            >
                              {diff > 0 ? `+${diff}` : diff} vs base
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
