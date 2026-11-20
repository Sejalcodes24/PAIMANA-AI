import { motion } from 'motion/react';
import type { DashboardSummary } from '../../shared/types';
import { formatCrore } from '../ui/StateViews';

export function KpiCards({ summary }: { summary: DashboardSummary }) {
  const { kpis } = summary;
  const delayedPct =
    kpis.totalProjects > 0
      ? ((kpis.delayedProjects / kpis.totalProjects) * 100).toFixed(1)
      : '0.0';
  const highRiskPct =
    kpis.totalProjects > 0
      ? ((kpis.highOrCriticalRiskProjects / kpis.totalProjects) * 100).toFixed(1)
      : '0.0';

  const cards = [
    {
      label: 'Tracked Projects',
      value: kpis.totalProjects.toLocaleString('en-IN'),
      subline: `${kpis.avgPhysicalProgressPct}% avg physical completion · ${summary.monthLabel}`,
      tone: 'text-[#0B2545]',
      accentTop: 'border-t-[3px] border-t-[#0B2545]',
      footerBg: 'bg-[#F4F7FB]',
    },
    {
      label: 'Anticipated Project Outlay',
      value: formatCrore(kpis.totalAnticipatedCostCr),
      subline: `Original ${formatCrore(kpis.totalOriginalCostCr)} · +${kpis.overallCostOverrunPct}% escalation`,
      tone: 'text-[#0B2545]',
      accentTop: 'border-t-[3px] border-t-[#FF9933]',
      footerBg: 'bg-[#FFF9F2]',
    },
    {
      label: 'Time-Delayed Projects',
      value: `${kpis.delayedProjects} / ${kpis.totalProjects}`,
      subline: `${delayedPct}% behind original commissioning schedule`,
      tone: kpis.delayedProjects > 0 ? 'text-[#E66C0A]' : 'text-[#138808]',
      accentTop: kpis.delayedProjects > 0 ? 'border-t-[3px] border-t-[#E66C0A]' : 'border-t-[3px] border-t-[#138808]',
      footerBg: kpis.delayedProjects > 0 ? 'bg-[#FFF7ED]' : 'bg-[#F2FBF4]',
    },
    {
      label: 'High / Critical Risk Exposure',
      value: `${kpis.highOrCriticalRiskProjects}`,
      subline: `${highRiskPct}% flagged by rule-based risk rubric (score ≥ 48)`,
      tone: kpis.highOrCriticalRiskProjects > 0 ? 'text-[#B91C1C]' : 'text-[#138808]',
      accentTop: kpis.highOrCriticalRiskProjects > 0 ? 'border-t-[3px] border-t-[#B91C1C]' : 'border-t-[3px] border-t-[#138808]',
      footerBg: kpis.highOrCriticalRiskProjects > 0 ? 'bg-[#FEF2F2]/60' : 'bg-[#F2FBF4]',
    },
  ];

  return (
    <section aria-label="Portfolio Key Performance Indicators">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card, idx) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, delay: idx * 0.04, ease: [0.16, 1, 0.3, 1] }}
            className={`paimana-card-3d bg-white border border-[#D6E0EC] ${card.accentTop} rounded-md overflow-hidden flex flex-col justify-between`}
          >
            <div className="p-5 pb-4">
              <p className="text-xs font-semibold text-slate-600">{card.label}</p>
              <p className={`text-2xl font-bold tracking-tight mt-2 font-mono tabular-nums ${card.tone}`}>
                {card.value}
              </p>
            </div>
            <div className={`px-5 py-2.5 border-t border-[#E6EDF5] ${card.footerBg}`}>
              <p className="text-[11px] text-slate-600 leading-relaxed tabular-nums">
                {card.subline}
              </p>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
