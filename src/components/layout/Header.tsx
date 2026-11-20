import { MessageSquare } from 'lucide-react';
import paimanaLogoUrl from '../../assets/logos/paimana-ai-logo.svg';
import mospiWordmarkUrl from '../../assets/logos/mospi-wordmark.svg';

export type AppRoute = 'overview' | 'projects' | 'what-if' | 'reports' | 'project-detail';

interface HeaderProps {
  activeRoute: AppRoute;
  onNavigate: (route: AppRoute) => void;
  selectedMonth: string;
  monthLabel: string;
  availableMonths: Array<{ month: string; label: string; projectCount: number }>;
  onMonthChange: (month: string) => void;
  onOpenChat: () => void;
  breadcrumbDetail?: string;
}

export function Header({
  activeRoute,
  onNavigate,
  selectedMonth,
  monthLabel,
  availableMonths,
  onMonthChange,
  onOpenChat,
  breadcrumbDetail,
}: HeaderProps) {
  const navItems: Array<{ id: AppRoute; label: string }> = [
    { id: 'overview', label: 'Overview' },
    { id: 'projects', label: 'Projects' },
    { id: 'what-if', label: 'What-If Lab' },
    { id: 'reports', label: 'Reports' },
  ];

  const isNavActive = (id: AppRoute) =>
    activeRoute === id || (id === 'projects' && activeRoute === 'project-detail');

  return (
    <header className="bg-white shadow-[0_6px_20px_rgba(8,27,51,0.12)]">
      {/* Animated Indian Tricolour Top Accent Ribbon */}
      <div className="h-[3px] w-full paimana-tricolour-bar" aria-hidden="true" />

      {/* Elevated White Brand Strip Above Navigation */}
      <div className="bg-gradient-to-b from-[#FFFFFF] via-[#FFFFFF] to-[#F3F6FA] border-b border-[#D6E0EC]">
        <div className="max-w-[1440px] mx-auto px-3 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between gap-3 sm:gap-6">
          {/* Left: Coordinated Dimensional Logos */}
          <div className="flex items-center gap-2 sm:gap-4 min-w-0">
            <button
              type="button"
              onClick={() => onNavigate('overview')}
              aria-label="PAIMANA AI Home"
              className="inline-flex items-center shrink-0 cursor-pointer rounded-md p-0.5 -m-0.5 hover:bg-slate-50 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0B2545]"
            >
              <img
                src={paimanaLogoUrl}
                alt="PAIMANA AI dimensional logo featuring Indian tricolour span and blue data-wheel motif"
                className="h-7 sm:h-11 w-auto shrink-0"
              />
            </button>

            <span
              className="h-6 sm:h-9 w-px bg-gradient-to-b from-transparent via-[#CBD5E1] to-transparent shrink-0"
              aria-hidden="true"
            />

            <img
              src={mospiWordmarkUrl}
              alt="India-inspired Ministry of Statistics and Programme Implementation wordmark with blue data-wheel motif"
              className="h-7 sm:h-10 w-auto shrink-0"
            />
          </div>

          {/* Right: Recessed Context Plate + Layered Navy Primary Action */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="hidden lg:flex items-center gap-2.5 px-3.5 py-1.5 rounded-md bg-[#F8FAFC] border border-[#DCE3EC] shadow-[inset_0_1px_2px_rgba(11,37,69,0.04)] text-xs text-slate-700">
              <span className="font-semibold text-[#0B2545]">Central Sector Portal</span>
              <span aria-hidden="true" className="text-[#FF9933] font-bold">·</span>
              <span className="font-mono tabular-nums text-slate-600">Projects &ge; ₹150 Cr</span>
            </div>

            <button
              type="button"
              onClick={onOpenChat}
              className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 text-xs font-semibold text-white bg-gradient-to-b from-[#13315C] to-[#0B2545] border border-[#081B33] rounded-md shadow-[0_3px_10px_rgba(11,37,69,0.22),inset_0_1px_0_rgba(255,255,255,0.18)] hover:from-[#1B4278] hover:to-[#0E2D54] hover:-translate-y-0.5 transition-all whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF9933]"
            >
              <MessageSquare className="w-3.5 h-3.5 text-[#38BDF8] shrink-0" aria-hidden="true" />
              <span className="hidden sm:inline">Ask AI Assistant</span>
              <span className="sm:hidden">Ask AI</span>
            </button>
          </div>
        </div>
      </div>

      {/* Prominent Deep-Navy Navigation & Reporting Period Bar */}
      <div className="bg-gradient-to-r from-[#07162B] via-[#0B2545] to-[#13315C] text-white border-t border-[#1E3A5F]">
        <div className="max-w-[1440px] mx-auto px-3 sm:px-6 flex flex-col md:flex-row md:items-center md:justify-between gap-2 md:gap-6">
          <nav
            aria-label="Primary Navigation"
            className="flex items-center gap-1 sm:gap-2 overflow-x-auto pt-1 md:pt-0"
          >
            {navItems.map((item) => {
              const active = isNavActive(item.id);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onNavigate(item.id)}
                  aria-current={active ? 'page' : undefined}
                  className={`px-3.5 py-2.5 sm:py-3 text-xs sm:text-sm font-medium border-b-2 transition-all whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#38BDF8] ${
                    active
                      ? 'border-[#FF9933] text-white bg-white/10 font-semibold'
                      : 'border-transparent text-slate-300 hover:text-white hover:bg-white/5 hover:border-[#38BDF8]/60'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          <div className="flex flex-wrap items-center justify-between md:justify-end gap-3 pb-2 md:pb-0 text-xs">
            {breadcrumbDetail && (
              <div className="flex items-center gap-1.5 text-slate-300">
                <span>Active</span>
                <span aria-hidden="true" className="text-slate-500">/</span>
                <span className="font-mono text-[#FF9933] font-medium">{breadcrumbDetail}</span>
              </div>
            )}

            <div className="flex items-center gap-2 shrink-0">
              <label htmlFor="reporting-month-select" className="text-slate-300 whitespace-nowrap">
                Reporting Month:
              </label>
              <select
                id="reporting-month-select"
                value={selectedMonth}
                onChange={(e) => onMonthChange(e.target.value)}
                className="bg-[#081B33] text-white border border-[#38BDF8]/50 rounded px-2.5 py-1 text-xs font-medium shadow-[inset_0_1px_2px_rgba(0,0,0,0.25)] focus-visible:outline-2 focus-visible:outline-[#FF9933] cursor-pointer"
              >
                {availableMonths.length === 0 ? (
                  <option value={selectedMonth}>{monthLabel || selectedMonth}</option>
                ) : (
                  availableMonths.map((m) => (
                    <option key={m.month} value={m.month}>
                      {m.label} ({m.projectCount} projects)
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
