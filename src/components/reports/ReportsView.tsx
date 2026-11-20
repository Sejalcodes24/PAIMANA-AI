import { useEffect, useState } from 'react';
import { ExternalLink, FileSpreadsheet, ShieldCheck } from 'lucide-react';
import { fetchFlashReports } from '../../api/client';
import type { DashboardSummary, FlashReport } from '../../shared/types';
import { ErrorState, formatCrore, LoadingState } from '../ui/StateViews';

export function ReportsView({
  summary,
  onSelectMonth,
}: {
  summary: DashboardSummary | null;
  onSelectMonth: (month: string) => void;
}) {
  const [reports, setReports] = useState<FlashReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetchFlashReports()
      .then((res) => {
        if (active) {
          setReports(res.reports);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (active) {
          setError(err instanceof Error ? err.message : 'Unable to load flash reports.');
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  if (loading) return <LoadingState label="Loading monthly flash reports..." />;
  if (error) return <ErrorState message={error} />;

  return (
    <div className="space-y-5">
      <div className="bg-white border border-[#DCE3EC] rounded-md p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-[#DCE3EC]">
          <div>
            <h1 className="text-xl font-bold text-[#0B2545]">
              Monthly Flash Reports & Data Integrity Audit
            </h1>
            <p className="text-xs text-slate-600 mt-0.5">
              Modeled on MoSPI PAIMANA monthly flash report releases, CSV ingestion logs, and OpenAPI documentation.
            </p>
          </div>
          <a
            href="/api/docs"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-[#0B2545] text-white rounded hover:bg-[#13315C] transition-colors whitespace-nowrap shrink-0"
          >
            <span>OpenAPI Documentation</span>
            <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
          </a>
        </div>

        {summary && (
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mt-4 text-xs">
            <div className="border border-[#DCE3EC] rounded p-3.5 bg-[#F8FAFC]">
              <div className="flex items-center gap-1.5 text-slate-600 font-medium">
                <FileSpreadsheet className="w-3.5 h-3.5 text-[#0B2545]" aria-hidden="true" />
                <span>Total Monthly Records</span>
              </div>
              <p className="text-lg font-bold font-mono tabular-nums text-[#0B2545] mt-1">
                {summary.dataIntegrity.recordsLoaded}
              </p>
              <p className="text-[11px] text-slate-500">Across {summary.availableMonths.length} monthly CSV files</p>
            </div>

            <div className="border border-[#DCE3EC] rounded p-3.5 bg-[#F8FAFC]">
              <div className="flex items-center gap-1.5 text-slate-600 font-medium">
                <ShieldCheck className="w-3.5 h-3.5 text-[#15803D]" aria-hidden="true" />
                <span>Duplicate Copies Skipped</span>
              </div>
              <p className="text-lg font-bold font-mono tabular-nums text-[#0B2545] mt-1">
                {summary.dataIntegrity.duplicatesSkipped}
              </p>
              <p className="text-[11px] text-slate-500 truncate">
                {summary.dataIntegrity.skippedFiles.join(', ') || 'None'}
              </p>
            </div>

            <div className="border border-[#DCE3EC] rounded p-3.5 bg-[#F8FAFC]">
              <span className="text-slate-600 font-medium block">Missing Values Normalized</span>
              <p className="text-lg font-bold font-mono tabular-nums text-[#0B2545] mt-1">
                {summary.dataIntegrity.missingFieldsNormalized}
              </p>
              <p className="text-[11px] text-slate-500">N/A / blank cells safely defaulted</p>
            </div>

            <div className="border border-[#DCE3EC] rounded p-3.5 bg-[#F8FAFC]">
              <span className="text-slate-600 font-medium block">Geographic Precision</span>
              <p className="text-sm font-bold text-[#0B2545] mt-1">State / UT Level</p>
              <p className="text-[11px] text-slate-500">No fabricated project coordinates</p>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-4">
        {reports.map((rep) => (
          <article
            key={rep.id}
            className="bg-white border border-[#DCE3EC] rounded-md p-5"
          >
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 pb-3 border-b border-slate-100">
              <div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span className="font-mono font-semibold text-[#0B2545]">{rep.id}</span>
                  <span aria-hidden="true">·</span>
                  <span>Report month: {rep.publishedDate}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono">{rep.sourceCsvFile}</span>
                </div>
                <h2 className="text-base font-bold text-[#0B2545] mt-1">{rep.title}</h2>
              </div>

              <button
                type="button"
                onClick={() => onSelectMonth(rep.month)}
                className="px-3.5 py-1.5 text-xs font-semibold border border-[#0B2545] text-[#0B2545] rounded hover:bg-slate-50 whitespace-nowrap shrink-0 cursor-pointer"
              >
                Load {rep.monthLabel} in Dashboard
              </button>
            </div>

            <p className="text-xs text-slate-700 mt-3 leading-relaxed">{rep.summary}</p>
            {rep.reportUrl && (
              <a href={rep.reportUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 mt-3 text-xs font-semibold text-[#0B2545] hover:underline">
                {rep.reportLinkLabel || 'Open report source'} <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
              </a>
            )}

            <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <div className="md:col-span-2">
                <p className="font-semibold text-slate-800 mb-1">Key Analytical Highlights</p>
                <ul className="space-y-1 text-slate-600 list-disc pl-4">
                  {rep.highlights.map((h, idx) => (
                    <li key={idx}>{h}</li>
                  ))}
                </ul>
              </div>
              <div className="border border-[#DCE3EC] rounded p-3 bg-[#F8FAFC] space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-500">Projects Covered:</span>
                  <span className="font-mono font-semibold tabular-nums text-[#0B2545]">
                    {rep.totalProjectsCovered}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Total Outlay:</span>
                  <span className="font-mono font-semibold tabular-nums text-[#0B2545]">
                    {formatCrore(rep.totalOutlayCr)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Report source:</span>
                  <span className="font-mono text-[11px] text-slate-700 truncate max-w-[140px]">
                    {rep.referencePdfName}
                  </span>
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
