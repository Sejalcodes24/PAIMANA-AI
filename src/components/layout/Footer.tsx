export function Footer({
  monthLabel,
  onNavigateReports,
}: {
  monthLabel: string;
  onNavigateReports: () => void;
}) {
  return (
    <footer className="bg-gradient-to-b from-[#0B2545] to-[#07162B] text-slate-200 mt-12">
      <div aria-hidden="true" className="h-[3px] w-full paimana-tricolour-bar" />
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4 text-xs">
        <div className="space-y-1">
          <p className="font-semibold text-white">
            PAIMANA AI · Central Sector Infrastructure Analytics (&ge; ₹150 Crore)
          </p>
          <p className="text-slate-300">
            Active Reporting Period: <span className="font-medium text-[#38BDF8]">{monthLabel}</span>
            <span aria-hidden="true" className="mx-2 text-slate-500">|</span>
            State boundaries: DataMeet India (CC BY 4.0) · Sector visuals: PAIMANA AI Editorial Assets · State-level aggregation only.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-5 shrink-0">
          <button
            type="button"
            onClick={onNavigateReports}
            className="text-white hover:text-[#38BDF8] hover:underline font-medium cursor-pointer"
          >
            Monthly Flash Reports
          </button>
          <a
            href="/api/docs"
            target="_blank"
            rel="noreferrer"
            className="text-white hover:text-[#38BDF8] hover:underline font-medium"
          >
            OpenAPI Docs
          </a>
          <a
            href="https://paimana-proj.mospi.gov.in/"
            target="_blank"
            rel="noreferrer"
            className="text-slate-300 hover:text-white hover:underline"
          >
            MoSPI PAIMANA Reference
          </a>
        </div>
      </div>
    </footer>
  );
}
