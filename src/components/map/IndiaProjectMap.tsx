import { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { motion } from 'motion/react';
import { formatCrore } from '../ui/StateViews';

type MapMetric = 'count' | 'original' | 'revised' | 'expenditure';
interface StateWiseRow {
  state: string;
  projectCount: number;
  originalOutlayCr: number;
  revisedOutlayCr: number;
  expenditureCr: number;
}
interface GeoJsonFeature {
  type: 'Feature';
  properties: { ST_NM?: string };
  geometry: GeoJSON.Geometry;
}
interface GeoJsonCollection {
  type: 'FeatureCollection';
  features: GeoJsonFeature[];
}

const stateKey = (name: string) => name.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]/g, '');
const metricValue = (row: StateWiseRow, metric: MapMetric) => ({
  count: row.projectCount,
  original: row.originalOutlayCr,
  revised: row.revisedOutlayCr,
  expenditure: row.expenditureCr,
}[metric]);

function colorFor(value: number, max: number, metric: MapMetric) {
  if (value <= 0) return '#E8EEF5';
  const ratio = max > 0 ? value / max : 0;
  if (metric === 'count') {
    if (ratio >= 0.75) return '#0B2545';
    if (ratio >= 0.5) return '#075985';
    if (ratio >= 0.25) return '#0284C7';
    return '#7DD3FC';
  }
  if (ratio >= 0.75) return '#14532D';
  if (ratio >= 0.5) return '#15803D';
  if (ratio >= 0.25) return '#65A30D';
  return '#BEF264';
}

export function IndiaProjectMap({ monthLabel }: {
  stateAggregates?: unknown[];
  monthLabel: string;
  onFilterByState?: (stateName: string) => void;
  onSelectProject?: (projectCode: string) => void;
}) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const geoLayerRef = useRef<L.GeoJSON | null>(null);
  const [geoData, setGeoData] = useState<GeoJsonCollection | null>(null);
  const [stateRows, setStateRows] = useState<StateWiseRow[]>([]);
  const [dataError, setDataError] = useState<string | null>(null);
  const [metric, setMetric] = useState<MapMetric>('count');
  const [selectedState, setSelectedState] = useState('Maharashtra');

  const rowMap = useMemo(() => new Map(stateRows.map((row) => [stateKey(row.state), row])), [stateRows]);
  const maxValue = useMemo(() => Math.max(1, ...stateRows.map((row) => metricValue(row, metric))), [stateRows, metric]);
  const activeRow = rowMap.get(stateKey(selectedState));
  const topStates = useMemo(() => [...stateRows].sort((a, b) => b.projectCount - a.projectCount).slice(0, 6), [stateRows]);

  useEffect(() => {
    let active = true;
    Promise.all([
      fetch('/data/india-states.geojson').then((res) => { if (!res.ok) throw new Error(`Map boundary file unavailable (${res.status})`); return res.json() as Promise<GeoJsonCollection>; }),
      fetch('/data/statewise/july-2026.json').then((res) => { if (!res.ok) throw new Error(`State-wise report data unavailable (${res.status})`); return res.json() as Promise<{ states: StateWiseRow[] }>; }),
    ]).then(([geo, stateData]) => {
      if (!active) return;
      setGeoData(geo);
      setStateRows(stateData.states);
      if (!stateData.states.some((row) => stateKey(row.state) === stateKey(selectedState)) && stateData.states[0]) setSelectedState(stateData.states[0].state);
    }).catch((err) => {
      if (active) setDataError(err instanceof Error ? err.message : 'Unable to load map data.');
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;
    const map = L.map(mapContainerRef.current, {
      center: [22.3, 82.8], zoom: 4.3, minZoom: 3.5, maxZoom: 8,
      zoomControl: true, attributionControl: false, scrollWheelZoom: false,
    });
    mapInstanceRef.current = map;
    return () => { map.remove(); mapInstanceRef.current = null; geoLayerRef.current = null; };
  }, []);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !geoData) return;
    geoLayerRef.current?.remove();
    const layer = L.geoJSON(geoData as GeoJSON.GeoJsonObject, {
      style: (feature) => {
        const name = feature?.properties?.ST_NM ?? '';
        const row = rowMap.get(stateKey(name));
        const selected = stateKey(name) === stateKey(selectedState);
        return {
          fillColor: row ? colorFor(metricValue(row, metric), maxValue, metric) : '#E8EEF5',
          weight: selected ? 2.2 : 1,
          opacity: 1,
          color: selected ? '#0B2545' : '#FFFFFF',
          fillOpacity: row ? 0.9 : 0.65,
        };
      },
      onEachFeature: (feature, featureLayer) => {
        const name = feature?.properties?.ST_NM ?? 'Unknown';
        const row = rowMap.get(stateKey(name));
        const tooltip = row
          ? `<strong>${name}</strong><br/>${row.projectCount.toLocaleString('en-IN')} monitored projects<br/>Revised outlay: ₹${row.revisedOutlayCr.toLocaleString('en-IN', { maximumFractionDigits: 2 })} Cr`
          : `<strong>${name}</strong><br/>No state-wise entry in the July 2026 file`;
        featureLayer.bindTooltip(tooltip, { sticky: true });
        featureLayer.on({
          mouseover: (event) => { (event.target as L.Path).setStyle({ weight: 2.2, color: '#0284C7', fillOpacity: 1 }); },
          mouseout: (event) => { layer.resetStyle(event.target as L.Path); },
          click: () => { setSelectedState(name); },
        });
      },
    }).addTo(map);
    geoLayerRef.current = layer;
    const bounds = layer.getBounds();
    if (bounds.isValid() && !map.getContainer().dataset.fitted) {
      map.fitBounds(bounds, { padding: [14, 14] });
      map.getContainer().dataset.fitted = 'true';
    }
  }, [geoData, rowMap, metric, maxValue, selectedState]);

  const metricOptions: Array<{ id: MapMetric; label: string }> = [
    { id: 'count', label: 'Project Count' },
    { id: 'original', label: 'Original Outlay' },
    { id: 'revised', label: 'Revised Outlay' },
    { id: 'expenditure', label: 'Expenditure' },
  ];
  const metricLabel = metricOptions.find((option) => option.id === metric)?.label ?? 'Project Count';

  return (
    <section aria-label="India State-Wise Infrastructure Map" className="bg-white border border-[#D6E0EC] rounded-md overflow-hidden paimana-panel-layered">
      <div className="px-5 py-4 bg-gradient-to-r from-[#F4F7FB] via-white to-[#F8FAFC] border-b border-[#DCE3EC] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-[#0B2545]">India State-Wise Infrastructure Map</h2>
          <p className="text-xs text-slate-600 mt-0.5">Official state-wise summary from the July 2026 PAIMANA source file. Select a state to inspect its reported totals.</p>
        </div>
        <div role="group" aria-label="Map metric" className="inline-flex flex-wrap items-center gap-1 p-1 bg-[#F4F6F9] border border-[#DCE3EC] rounded">
          {metricOptions.map((option) => <button key={option.id} type="button" onClick={() => setMetric(option.id)} className={`px-3 py-1.5 text-xs font-medium rounded whitespace-nowrap cursor-pointer ${metric === option.id ? 'bg-[#0B2545] text-white' : 'text-slate-700 hover:text-[#0B2545]'}`}>{option.label}</button>)}
        </div>
      </div>

      <div className="px-5 py-2.5 bg-white border-b border-[#DCE3EC] flex flex-wrap items-center gap-2 text-xs">
        <span className="font-semibold text-[#0B2545] mr-1">Highest project counts:</span>
        {topStates.map((row) => <button key={row.state} type="button" onClick={() => setSelectedState(row.state)} className={`px-2.5 py-1 rounded border text-xs whitespace-nowrap cursor-pointer ${stateKey(selectedState) === stateKey(row.state) ? 'bg-[#0B2545] text-white border-[#0B2545]' : 'bg-[#F8FAFC] text-slate-800 border-[#DCE3EC] hover:border-[#0284C7]'}`}>{row.state} <strong className="ml-1">{row.projectCount}</strong></button>)}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12">
        <div className="lg:col-span-7 border-b lg:border-b-0 lg:border-r border-[#DCE3EC] relative">
          {dataError ? <div className="p-6 bg-slate-50 h-[430px] flex flex-col justify-center"><p className="text-sm font-semibold text-[#B91C1C]">Map data could not be loaded</p><p className="text-xs text-slate-600 mt-1">{dataError}</p></div> : <div ref={mapContainerRef} data-testid="india-leaflet-map" className="paimana-leaflet-container w-full h-[430px]" />}
          <div className="px-5 py-3 bg-[#F8FAFC] border-t border-[#DCE3EC] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs text-slate-600">
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded-xs bg-[#0B2545] inline-block" /> Highest</span>
              <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded-xs bg-[#0284C7] inline-block" /> Medium</span>
              <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded-xs bg-[#7DD3FC] inline-block" /> Lower</span>
              <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded-xs bg-[#E8EEF5] border border-slate-300 inline-block" /> No entry</span>
            </div>
            <span className="text-[11px] text-slate-500">Boundaries: DataMeet CC BY 4.0 · State-level data only</span>
          </div>
        </div>

        <motion.div key={selectedState} initial={{ opacity: 0.75, y: 3 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.16 }} className="lg:col-span-5 p-5 bg-white">
          <p className="text-xs font-medium text-slate-500">Selected State / UT</p>
          <h3 className="text-lg font-bold text-[#0B2545] mt-0.5 pb-3 border-b border-[#DCE3EC]">{selectedState}</h3>
          {activeRow ? <>
            <div className="grid grid-cols-2 gap-4 py-4 border-b border-[#DCE3EC] text-xs">
              <div><span className="text-slate-500 block">Reported Projects</span><strong className="text-xl font-bold font-mono text-[#0B2545]">{activeRow.projectCount.toLocaleString('en-IN')}</strong></div>
              <div><span className="text-slate-500 block">Original Outlay</span><strong className="text-sm font-bold font-mono text-[#0B2545]">{formatCrore(activeRow.originalOutlayCr)}</strong></div>
              <div><span className="text-slate-500 block">Revised Outlay</span><strong className="text-sm font-bold font-mono text-[#0B2545]">{formatCrore(activeRow.revisedOutlayCr)}</strong></div>
              <div><span className="text-slate-500 block">Cumulative Expenditure</span><strong className="text-sm font-bold font-mono text-[#0B2545]">{formatCrore(activeRow.expenditureCr)}</strong></div>
            </div>
            <div className="mt-4 rounded border border-[#DCE3EC] bg-[#F8FAFC] p-3 text-xs text-slate-600 leading-relaxed">
              These figures come from the July 2026 state-wise summary. The supplied monthly project CSV does not map individual project IDs to states, so project-level drill-down, state-level delays and state-level AI risk scores are intentionally not inferred here.
            </div>
          </> : <p className="py-8 text-sm text-slate-600">No matching state entry was found in the July 2026 state-wise source.</p>}
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500"><span>Choose a state:</span><select aria-label="Choose state" value={selectedState} onChange={(event) => setSelectedState(event.target.value)} className="border border-[#DCE3EC] rounded px-2 py-1 text-xs text-[#0B2545] bg-white cursor-pointer">{stateRows.map((row) => <option key={row.state} value={row.state}>{row.state} ({row.projectCount})</option>)}</select></div>
        </motion.div>
      </div>
      <div className="px-5 py-2 border-t border-[#DCE3EC] text-[11px] text-slate-500">State-wise source period: July 2026 · Dashboard currently selected: {monthLabel} · Map figures remain tied to the July source report.</div>
    </section>
  );
}
