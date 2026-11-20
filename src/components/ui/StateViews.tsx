import type { RiskTier } from '../../shared/types';

export function formatCrore(val: number): string {
  return `₹${Math.round(val).toLocaleString('en-IN')} Cr`;
}

export function getRiskTextClass(tier: RiskTier): string {
  switch (tier) {
    case 'Critical':
      return 'text-[#B91C1C] font-semibold';
    case 'High':
      return 'text-[#E66C0A] font-semibold';
    case 'Moderate':
      return 'text-[#0284C7] font-medium';
    case 'Low':
      return 'text-[#138808] font-medium';
  }
}

export function getRiskBarColor(tier: RiskTier): string {
  switch (tier) {
    case 'Critical':
      return '#B91C1C';
    case 'High':
      return '#E66C0A';
    case 'Moderate':
      return '#0284C7';
    case 'Low':
      return '#138808';
  }
}

export function RiskIndicator({
  score,
  tier,
  suffix = '/100',
}: {
  score: number;
  tier: RiskTier;
  suffix?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-1.5 font-mono text-xs tabular-nums ${getRiskTextClass(tier)}`}>
      <span>{score}{suffix}</span>
      <span aria-hidden="true" className="text-slate-300">·</span>
      <span className="font-sans">{tier}</span>
    </span>
  );
}

export function LoadingState({ label = 'Loading monitoring records...' }: { label?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="bg-white border border-[#DCE3EC] rounded-md p-6 space-y-4"
    >
      <div className="flex items-center justify-between">
        <div className="h-4 w-48 bg-slate-200 rounded animate-pulse" />
        <span className="text-xs text-slate-500">{label}</span>
      </div>
      <div className="space-y-2.5">
        <div className="h-9 w-full bg-slate-100 rounded animate-pulse" />
        <div className="h-9 w-full bg-slate-100 rounded animate-pulse" />
        <div className="h-9 w-5/6 bg-slate-100 rounded animate-pulse" />
      </div>
    </div>
  );
}

export function ErrorState({
  title = 'Unable to load records',
  message,
  onRetry,
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="bg-white border border-red-300 rounded-md p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
    >
      <div>
        <h3 className="text-sm font-semibold text-[#B91C1C]">{title}</h3>
        <p className="text-sm text-slate-700 mt-1">{message}</p>
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="px-4 py-2 text-xs font-medium bg-[#0B2545] text-white rounded hover:bg-[#13315C] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          Retry Request
        </button>
      )}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
}: {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="bg-white border border-[#DCE3EC] rounded-md p-10 text-center">
      <h3 className="text-base font-semibold text-[#0B2545]">{title}</h3>
      <p className="text-sm text-slate-600 mt-1.5 max-w-md mx-auto">{description}</p>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-4 px-4 py-2 text-xs font-medium bg-[#0B2545] text-white rounded hover:bg-[#13315C] transition-colors cursor-pointer"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
