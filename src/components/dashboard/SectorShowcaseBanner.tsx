import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Pause, Play, ArrowRight } from 'lucide-react';
import { motion } from 'motion/react';
import { classifyRiskTier } from '../../shared/risk';
import type { SectorAggregate } from '../../shared/types';
import { formatCrore, RiskIndicator } from '../ui/StateViews';

interface SectorShowcaseBannerProps {
  sectorBreakdown: SectorAggregate[];
  monthLabel: string;
  onFilterBySector: (sector: string) => void;
  onSelectProject: (projectCode: string) => void;
}

interface SectorMediaConfig {
  sectorKey: string;
  sourceSectors: string[];
  displayTitle: string;
  subtitle: string;
  imageSrc: string;
  alt: string;
}

const SECTOR_MEDIA: SectorMediaConfig[] = [
  {
    sectorKey: 'Railways',
    sourceSectors: ['Railways'],
    displayTitle: 'Railways & High-Speed Corridors',
    subtitle: 'Dedicated rail links, mountain tunnels, and high-speed viaduct projects',
    imageSrc: '/src/assets/images/sector_indian_railways_1795036913805.jpg',
    alt: 'Modern Indian high-speed electrified passenger train crossing an elevated river viaduct',
  },
  {
    sectorKey: '@power',
    sourceSectors: ['Electricity Generation', 'Transmission & Distribution', 'Energy Storage'],
    displayTitle: 'Power & Nuclear Energy',
    subtitle: 'Atomic energy units (Kudankulam), hydro, thermal, and renewable grid transmission',
    imageSrc: '/src/assets/images/sector_nuclear_power_1795036914304.jpg',
    alt: 'Coastal nuclear power station in southern India with twin reactor containment domes at golden hour',
  },
  {
    sectorKey: '@roads',
    sourceSectors: ['Roads & Highways'],
    displayTitle: 'Roadways & National Expressways',
    subtitle: 'Access-controlled expressways, cloverleaf interchanges, and strategic tunnels',
    imageSrc: '/src/assets/images/sector_roadways_highways_1795036913829.jpg',
    alt: 'Multi-lane Indian national expressway highway and concrete flyover interchange',
  },
  {
    sectorKey: '@urban',
    sourceSectors: ['Urban Public Transport'],
    displayTitle: 'Urban Metro & Transit',
    subtitle: 'Elevated and underground metro rail networks across major Indian cities',
    imageSrc: '/src/assets/images/sector_urban_metro_1795036916051.jpg',
    alt: 'Elevated urban metro rail viaduct and transit station over a tree-lined Indian avenue',
  },
];

export function SectorShowcaseBanner({
  sectorBreakdown,
  monthLabel,
  onFilterBySector,
  onSelectProject,
}: SectorShowcaseBannerProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }
    return false;
  });
  const [hovered, setHovered] = useState(false);
  const [detailsExpanded, setDetailsExpanded] = useState(false);
  const [brokenImages, setBrokenImages] = useState<Record<string, boolean>>({});

  const sectorMap = useMemo(() => {
    const map = new Map<string, SectorAggregate>();
    for (const config of SECTOR_MEDIA) {
      const parts = sectorBreakdown.filter((item) => config.sourceSectors.includes(item.sector));
      if (!parts.length) continue;
      const count = parts.reduce((sum, item) => sum + item.projectCount, 0);
      const weighted = (field: 'avgPhysicalProgressPct' | 'avgRuleRiskScore') =>
        count ? Math.round(parts.reduce((sum, item) => sum + item[field] * item.projectCount, 0) / count * 10) / 10 : 0;
      map.set(config.sectorKey, {
        sector: config.sectorKey,
        projectCount: count,
        totalOriginalCostCr: parts.reduce((sum, item) => sum + item.totalOriginalCostCr, 0),
        totalAnticipatedCostCr: parts.reduce((sum, item) => sum + item.totalAnticipatedCostCr, 0),
        delayedCount: parts.reduce((sum, item) => sum + item.delayedCount, 0),
        highRiskCount: parts.reduce((sum, item) => sum + item.highRiskCount, 0),
        avgPhysicalProgressPct: weighted('avgPhysicalProgressPct'),
        avgRuleRiskScore: Math.round(weighted('avgRuleRiskScore')),
        topProjects: parts.flatMap((item) => item.topProjects).sort((a, b) => b.ruleBasedScore - a.ruleBasedScore).slice(0, 6),
      });
    }
    return map;
  }, [sectorBreakdown]);

  useEffect(() => {
    if (paused || hovered) return;
    const id = window.setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % SECTOR_MEDIA.length);
    }, 6500);
    return () => window.clearInterval(id);
  }, [paused, hovered]);

  const activeConfig = SECTOR_MEDIA[activeIndex];
  const activeData = sectorMap.get(activeConfig.sectorKey);
  const activeRiskTier = activeData ? classifyRiskTier(activeData.avgRuleRiskScore) : 'Low';

  const handleSelectSectorCard = (idx: number) => {
    setActiveIndex(idx);
    setDetailsExpanded(true);
  };

  return (
    <section
      aria-label="Infrastructure Sector Showcase and Live Sector Explorer"
      className="bg-white border border-[#D6E0EC] rounded-md overflow-hidden paimana-panel-layered"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Rotating Hero Photography Banner */}
      <div className="relative h-[250px] sm:h-[296px] bg-[#081B33] overflow-hidden">
        {!brokenImages[activeConfig.sectorKey] ? (
          <motion.img
            key={activeConfig.imageSrc}
            src={activeConfig.imageSrc}
            alt={activeConfig.alt}
            referrerPolicy="no-referrer"
            onError={() =>
              setBrokenImages((prev) => ({ ...prev, [activeConfig.sectorKey]: true }))
            }
            initial={{ opacity: 0.72, scale: paused ? 1 : 1.04 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.75, ease: [0.16, 1, 0.3, 1] }}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-[#081B33] via-[#0B2545] to-[#13315C]" />
        )}

        {/* Measured Scrim for WCAG AA+ Text Legibility */}
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-r from-[#07162B]/95 via-[#0B2545]/82 to-[#0B2545]/35"
        />

        {/* Banner Content Overlay */}
        <div className="relative z-10 h-full px-5 sm:px-7 py-5 flex flex-col justify-between text-white">
          <div className="flex items-center justify-between gap-3">
            <div className="text-xs font-medium text-[#38BDF8] flex items-center gap-2">
              <span className="text-[#FF9933] font-semibold">Sector Spotlight</span>
              <span aria-hidden="true" className="text-slate-400">·</span>
              <span className="text-slate-200">{monthLabel}</span>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() =>
                  setActiveIndex((prev) => (prev - 1 + SECTOR_MEDIA.length) % SECTOR_MEDIA.length)
                }
                aria-label="Previous sector slide"
                className="p-1.5 rounded bg-[#0B2545]/85 border border-white/25 text-white hover:bg-[#13315C] cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setPaused((p) => !p)}
                aria-label={paused ? 'Resume sector rotation' : 'Pause sector rotation'}
                aria-pressed={paused}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded bg-[#0B2545]/85 border border-white/25 text-xs font-medium text-white hover:bg-[#13315C] cursor-pointer whitespace-nowrap"
              >
                {paused ? <Play className="w-3.5 h-3.5 text-[#FF9933]" /> : <Pause className="w-3.5 h-3.5 text-[#38BDF8]" />}
                <span className="hidden sm:inline">{paused ? 'Paused' : 'Auto'}</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveIndex((prev) => (prev + 1) % SECTOR_MEDIA.length)}
                aria-label="Next sector slide"
                className="p-1.5 rounded bg-[#0B2545]/85 border border-white/25 text-white hover:bg-[#13315C] cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="max-w-2xl">
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight text-balance">
              {activeConfig.displayTitle}
            </h2>
            <p className="text-xs sm:text-sm text-slate-200 mt-1 max-w-xl">
              {activeConfig.subtitle}
            </p>

            {/* Live Computed Metrics for Active Slide */}
            {activeData && (
              <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs font-mono tabular-nums text-slate-100">
                <span>
                  <strong className="text-white">{activeData.projectCount}</strong> Projects
                </span>
                <span>
                  <strong className="text-[#38BDF8]">{formatCrore(activeData.totalAnticipatedCostCr)}</strong> Outlay
                </span>
                <span>
                  <strong className="text-white">{activeData.avgPhysicalProgressPct}%</strong> Avg Progress
                </span>
                <span>
                  Risk <strong className="text-[#FF9933]">{activeData.avgRuleRiskScore}/100</strong> ({activeRiskTier})
                </span>
                <span>
                  <strong className="text-white">{activeData.delayedCount}</strong> Delayed
                </span>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => setDetailsExpanded((v) => !v)}
                className="px-3.5 py-2 text-xs font-semibold bg-white text-[#0B2545] rounded-md shadow-xs hover:bg-slate-100 transition-colors cursor-pointer whitespace-nowrap"
              >
                {detailsExpanded ? `Hide ${activeConfig.displayTitle} Breakdown` : `Inspect ${activeConfig.displayTitle} Projects`}
              </button>
              <button
                type="button"
                onClick={() => onFilterBySector(activeConfig.sectorKey)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-[#0284C7] text-white rounded-md shadow-xs hover:bg-[#0369A1] transition-colors cursor-pointer whitespace-nowrap"
              >
                <span>Open in Directory</span>
                <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </div>

            <span className="text-[11px] text-slate-300 hidden md:inline">
              Visuals: PAIMANA AI Editorial Assets (no external stock dependencies)
            </span>
          </div>
        </div>

        {/* Subtle Slide Progress Indicator Bar */}
        {!paused && !hovered && (
          <motion.div
            key={`bar-${activeIndex}`}
            aria-hidden="true"
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 6.5, ease: 'linear' }}
            style={{ transformOrigin: 'left center' }}
            className="absolute bottom-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[#FF9933] via-[#38BDF8] to-[#138808] z-20"
          />
        )}
      </div>

      {/* Crisp Tricolour Section Divider */}
      <div className="h-[2px] w-full paimana-tricolour-bar" aria-hidden="true" />

      {/* 4 Clickable Sector Cards Strip */}
      <div className="p-4 bg-gradient-to-b from-[#F4F7FB] to-[#FFFFFF] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {SECTOR_MEDIA.map((item, idx) => {
          const data = sectorMap.get(item.sectorKey);
          const isSelected = idx === activeIndex;
          const tier = data ? classifyRiskTier(data.avgRuleRiskScore) : 'Low';
          return (
            <button
              key={item.sectorKey}
              type="button"
              onClick={() => handleSelectSectorCard(idx)}
              aria-pressed={isSelected}
              className={`paimana-card-3d text-left rounded-md border overflow-hidden bg-white flex flex-col cursor-pointer focus-visible:outline-2 focus-visible:outline-[#0284C7] ${
                isSelected
                  ? 'border-[#0B2545] ring-1 ring-[#0B2545]'
                  : 'border-[#DCE3EC] hover:border-[#0284C7]'
              }`}
            >
              <div className="relative h-24 w-full bg-[#0B2545] overflow-hidden">
                {!brokenImages[item.sectorKey] ? (
                  <img
                    src={item.imageSrc}
                    alt={item.alt}
                    referrerPolicy="no-referrer"
                    onError={() =>
                      setBrokenImages((prev) => ({ ...prev, [item.sectorKey]: true }))
                    }
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-[#0B2545] to-[#0284C7]" />
                )}
                <div
                  aria-hidden="true"
                  className="absolute inset-0 bg-gradient-to-t from-[#081B33]/80 via-transparent to-transparent"
                />
                <span className="absolute bottom-2 left-3 right-3 text-xs font-bold text-white truncate">
                  {item.displayTitle}
                </span>
              </div>

              <div className="p-3 flex-1 flex flex-col justify-between gap-2 text-xs">
                {data ? (
                  <>
                    <div className="flex items-center justify-between text-slate-700 font-mono tabular-nums">
                      <span>
                        <strong className="text-[#0B2545]">{data.projectCount}</strong> proj
                      </span>
                      <span>{formatCrore(data.totalAnticipatedCostCr)}</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-600 font-mono tabular-nums pt-1 border-t border-slate-100">
                      <span>{data.avgPhysicalProgressPct}% progress</span>
                      <span
                        className={
                          tier === 'Critical'
                            ? 'text-[#B91C1C] font-semibold'
                            : tier === 'High'
                              ? 'text-[#EA580C] font-semibold'
                              : 'text-[#0284C7] font-semibold'
                        }
                      >
                        Risk {data.avgRuleRiskScore} · {tier}
                      </span>
                    </div>
                  </>
                ) : (
                  <span className="text-slate-500">No active records in {monthLabel}</span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Inline Live Sector Project Breakdown (shown when a sector card/button is clicked) */}
      {detailsExpanded && activeData && (
        <div className="px-5 py-4 bg-white border-t border-[#DCE3EC]">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-bold text-[#0B2545]">
                {activeConfig.displayTitle} — Active Portfolio ({monthLabel})
              </h3>
              <p className="text-xs text-slate-600 mt-0.5 tabular-nums">
                {activeData.projectCount} projects · {formatCrore(activeData.totalAnticipatedCostCr)} anticipated outlay ·{' '}
                {activeData.avgPhysicalProgressPct}% avg physical progress · {activeData.delayedCount} delayed ·{' '}
                {activeData.highRiskCount} High/Critical risk
              </p>
            </div>
            <button
              type="button"
              onClick={() => onFilterBySector(activeConfig.sectorKey)}
              className="px-3 py-1.5 text-xs font-semibold bg-[#0B2545] text-white rounded hover:bg-[#0284C7] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Filter All {activeConfig.displayTitle} Projects &rarr;
            </button>
          </div>

          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {activeData.topProjects.map((proj) => (
              <button
                key={proj.projectCode}
                type="button"
                onClick={() => onSelectProject(proj.projectCode)}
                className="text-left p-3 rounded border border-[#DCE3EC] hover:border-[#0284C7] hover:bg-[#F8FAFC] transition-colors flex items-start justify-between gap-3 cursor-pointer"
              >
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-[#0B2545] truncate">
                    {proj.name}
                  </div>
                  <div className="text-[11px] text-slate-600 mt-0.5 flex flex-wrap items-center gap-1.5 tabular-nums">
                    <span className="font-mono text-[#0B2545]">{proj.projectCode}</span>
                    <span aria-hidden="true">·</span>
                    <span>{proj.state}</span>
                    <span aria-hidden="true">·</span>
                    <span>{proj.physicalProgressPct}% progress</span>
                    <span aria-hidden="true">·</span>
                    <span>{proj.delayMonths}m delay</span>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <RiskIndicator score={proj.ruleBasedScore} tier={proj.ruleBasedTier} />
                  <span className="block text-[11px] font-mono tabular-nums text-slate-500 mt-0.5">
                    {formatCrore(proj.anticipatedCostCr)}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
