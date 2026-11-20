import { useEffect, useState } from 'react';
import { motion, MotionConfig } from 'motion/react';
import { fetchDashboardSummary, fetchFlashReports } from './api/client';
import { ChatPanel } from './components/chatbot/ChatPanel';
import { KpiCards } from './components/dashboard/KpiCards';
import { ProjectCharts } from './components/dashboard/ProjectCharts';
import { RecentProjects } from './components/dashboard/RecentProjects';
import { SectorShowcaseBanner } from './components/dashboard/SectorShowcaseBanner';
import { Footer } from './components/layout/Footer';
import { type AppRoute, Header } from './components/layout/Header';
import { IndiaProjectMap } from './components/map/IndiaProjectMap';
import { ProjectDetailView } from './components/projects/ProjectDetailView';
import { ProjectsDirectory } from './components/projects/ProjectsDirectory';
import { ReportsView } from './components/reports/ReportsView';
import { ErrorState, LoadingState } from './components/ui/StateViews';
import { WhatIfSimulatorView } from './components/whatif/WhatIfSimulatorView';
import type { DashboardSummary, FlashReport, RiskTier } from './shared/types';

export default function App() {
  const [route, setRoute] = useState<AppRoute>('overview');
  const [selectedMonth, setSelectedMonth] = useState<string>('2026-07');
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [flashReports, setFlashReports] = useState<FlashReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  // Drill-down filters for ProjectsDirectory
  const [stateFilter, setStateFilter] = useState<string>('All');
  const [sectorFilter, setSectorFilter] = useState<string>('All');
  const [riskTierFilter, setRiskTierFilter] = useState<string>('All');

  // Selected project for detail & what-if & chat focus
  const [selectedProjectCode, setSelectedProjectCode] = useState<string>('');
  const [whatIfProjectCode, setWhatIfProjectCode] = useState<string>('');

  // Chat drawer state
  const [chatOpen, setChatOpen] = useState(false);
  const [chatProjectFocus, setChatProjectFocus] = useState<{
    code: string;
    name: string;
  } | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    Promise.all([fetchDashboardSummary(selectedMonth), fetchFlashReports()])
      .then(([sumRes, repRes]) => {
        if (!active) return;
        setSummary(sumRes);
        setFlashReports(repRes.reports);
        if (sumRes.reportingMonth !== selectedMonth) {
          setSelectedMonth(sumRes.reportingMonth);
        }
        setLoading(false);
      })
      .catch((err) => {
        if (!active) return;
        setError(
          err instanceof Error
            ? err.message
            : 'Unable to load PAIMANA dashboard data.',
        );
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [selectedMonth, reloadTick]);

  const navigateTo = (nextRoute: AppRoute) => {
    setRoute(nextRoute);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleFilterByState = (st: string) => {
    setStateFilter(st);
    setSectorFilter('All');
    setRiskTierFilter('All');
    navigateTo('projects');
  };

  const handleFilterBySector = (sec: string) => {
    setSectorFilter(sec);
    setStateFilter('All');
    setRiskTierFilter('All');
    navigateTo('projects');
  };

  const handleFilterByRiskTier = (tier: RiskTier) => {
    setRiskTierFilter(tier);
    setStateFilter('All');
    setSectorFilter('All');
    navigateTo('projects');
  };

  const handleSelectProject = (projectCode: string) => {
    setSelectedProjectCode(projectCode);
    navigateTo('project-detail');
  };

  const handleOpenWhatIf = (projectCode: string) => {
    setWhatIfProjectCode(projectCode);
    navigateTo('what-if');
  };

  const handleAskAiAboutProject = (code: string, name: string) => {
    setChatProjectFocus({ code, name });
    setChatOpen(true);
  };

  const breadcrumbDetail =
    route === 'project-detail' && selectedProjectCode
      ? `Project ${selectedProjectCode}`
      : route === 'projects' && stateFilter !== 'All'
        ? `Projects · ${stateFilter}`
        : undefined;

  return (
    <MotionConfig reducedMotion="user">
    <div className="min-h-screen flex flex-col text-[#0F172A]">
      <Header
        activeRoute={route}
        onNavigate={(next) => {
          if (next === 'projects') {
            if (route === 'overview') {
              setStateFilter('All');
              setSectorFilter('All');
              setRiskTierFilter('All');
            }
          }
          navigateTo(next);
        }}
        selectedMonth={selectedMonth}
        monthLabel={summary?.monthLabel ?? selectedMonth}
        availableMonths={summary?.availableMonths ?? []}
        onMonthChange={(m) => setSelectedMonth(m)}
        onOpenChat={() => setChatOpen(true)}
        breadcrumbDetail={breadcrumbDetail}
      />

      <main className="flex-1 max-w-[1440px] w-full mx-auto px-4 sm:px-6 py-6">
        {route === 'overview' && (
          <div className="space-y-6">
            {/* Layered Navy Overview Banner with Animated Tricolour Ribbon & Geometric Data-Wheel Motif */}
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
              className="relative bg-gradient-to-br from-[#07162B] via-[#0B2545] to-[#13315C] border border-[#1E3A5F] rounded-md overflow-hidden paimana-panel-layered text-white"
            >
              <div className="h-[3px] w-full paimana-tricolour-bar" aria-hidden="true" />

              {/* Subtle Rotating Geometric Data-Wheel Motif (Purely Decorative, Pauses under prefers-reduced-motion) */}
              <svg
                aria-hidden="true"
                viewBox="0 0 220 220"
                className="pointer-events-none hidden md:block absolute -right-8 -top-12 w-56 h-56 opacity-20 paimana-hero-orbit"
              >
                <circle cx="110" cy="110" r="96" fill="none" stroke="#38BDF8" strokeWidth="1" strokeDasharray="6 6" />
                <circle cx="110" cy="110" r="72" fill="none" stroke="#FF9933" strokeWidth="1.2" strokeDasharray="24 14" />
                <circle cx="110" cy="110" r="48" fill="none" stroke="#138808" strokeWidth="1.2" strokeDasharray="18 12" />
              </svg>

              <div className="relative z-10 px-5 sm:px-6 py-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold text-white text-balance tracking-tight">
                    Central Sector Infrastructure Monitoring Overview
                  </h1>
                  <p className="text-xs sm:text-sm text-slate-200 mt-1.5 max-w-3xl">
                    Consolidated cost variance, commissioning slippage, state-level risk distribution, and explainable ML delay hazard for projects &ge; ₹150 Crore in{' '}
                    <strong className="text-[#FF9933]">{summary?.monthLabel ?? selectedMonth}</strong>.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => navigateTo('projects')}
                    className="px-4 py-2 text-xs font-semibold bg-white text-[#0B2545] rounded-md shadow-xs hover:bg-slate-100 hover:-translate-y-0.5 transition-all whitespace-nowrap cursor-pointer"
                  >
                    Browse All Projects
                  </button>
                  <button
                    type="button"
                    onClick={() => navigateTo('what-if')}
                    className="px-4 py-2 text-xs font-semibold bg-[#0284C7] text-white border border-[#38BDF8]/40 rounded-md shadow-xs hover:bg-[#0369A1] hover:-translate-y-0.5 transition-all whitespace-nowrap cursor-pointer"
                  >
                    Open What-If Lab
                  </button>
                </div>
              </div>
            </motion.div>

            {loading && <LoadingState label="Loading PAIMANA portfolio telemetry..." />}
            {!loading && error && (
              <ErrorState
                message={error}
                onRetry={() => setReloadTick((t) => t + 1)}
              />
            )}
            {!loading && !error && summary && (
              <>
                <KpiCards summary={summary} />
                <SectorShowcaseBanner
                  sectorBreakdown={summary.sectorBreakdown}
                  monthLabel={summary.monthLabel}
                  onFilterBySector={handleFilterBySector}
                  onSelectProject={handleSelectProject}
                />
                <IndiaProjectMap
                  stateAggregates={summary.stateAggregates}
                  monthLabel={summary.monthLabel}
                  onFilterByState={handleFilterByState}
                  onSelectProject={handleSelectProject}
                />
                <ProjectCharts
                  summary={summary}
                  onFilterBySector={handleFilterBySector}
                  onFilterByRiskTier={handleFilterByRiskTier}
                />
                <RecentProjects
                  watchlist={summary.highRiskWatchlist}
                  flashReports={flashReports}
                  onSelectProject={handleSelectProject}
                  onViewAllProjects={() => {
                    setStateFilter('All');
                    setSectorFilter('All');
                    setRiskTierFilter('All');
                    navigateTo('projects');
                  }}
                  onViewReports={() => navigateTo('reports')}
                />
              </>
            )}
          </div>
        )}

        {route === 'projects' && (
          <ProjectsDirectory
            reportingMonth={selectedMonth}
            initialStateFilter={stateFilter}
            initialSectorFilter={sectorFilter}
            initialRiskTierFilter={riskTierFilter}
            onSelectProject={handleSelectProject}
          />
        )}

        {route === 'project-detail' && (
          <ProjectDetailView
            projectCode={selectedProjectCode}
            reportingMonth={selectedMonth}
            onBack={() => navigateTo('projects')}
            onOpenWhatIf={handleOpenWhatIf}
            onAskAiAboutProject={handleAskAiAboutProject}
          />
        )}

        {route === 'what-if' && (
          <WhatIfSimulatorView
            reportingMonth={selectedMonth}
            initialProjectCode={whatIfProjectCode || selectedProjectCode}
          />
        )}

        {route === 'reports' && (
          <ReportsView
            summary={summary}
            onSelectMonth={(m) => {
              setSelectedMonth(m);
              navigateTo('overview');
            }}
          />
        )}
      </main>

      <Footer
        monthLabel={summary?.monthLabel ?? selectedMonth}
        onNavigateReports={() => navigateTo('reports')}
      />

      <ChatPanel
        open={chatOpen}
        onClose={() => setChatOpen(false)}
        reportingMonth={selectedMonth}
        monthLabel={summary?.monthLabel ?? selectedMonth}
        focusedProject={chatProjectFocus}
        onClearProjectFocus={() => setChatProjectFocus(null)}
        onSelectProject={handleSelectProject}
      />
    </div>
    </MotionConfig>
  );
}
