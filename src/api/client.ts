import type {
  ChatResponsePayload,
  DashboardSummary,
  FlashReport,
  InfrastructureProject,
  ProjectDetailResponse,
  WhatIfInput,
  WhatIfResult,
} from '../shared/types';

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const contentType = res.headers.get('content-type') || '';
  if (!res.ok) {
    let errorMessage = `Request failed (${res.status})`;
    if (contentType.includes('application/json')) {
      const payload = (await res.json()) as { error?: string; detail?: string };
      errorMessage = payload.error || payload.detail || errorMessage;
    }
    throw new Error(errorMessage);
  }
  return (await res.json()) as T;
}

export interface ProjectsQueryResponse {
  reportingMonth: string;
  monthLabel: string;
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  items: InfrastructureProject[];
  facets: {
    states: string[];
    sectors: string[];
    statuses: string[];
  };
}

export function fetchDashboardSummary(month?: string): Promise<DashboardSummary> {
  const qs = month ? `?month=${encodeURIComponent(month)}` : '';
  return fetchJson<DashboardSummary>(`/api/dashboard/summary${qs}`);
}

export function fetchProjects(params: {
  month?: string;
  search?: string;
  state?: string;
  sector?: string;
  riskTier?: string;
  status?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}): Promise<ProjectsQueryResponse> {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== '' && v !== 'All') {
      searchParams.set(k, String(v));
    }
  });
  return fetchJson<ProjectsQueryResponse>(`/api/projects?${searchParams.toString()}`);
}

export function fetchProjectDetail(
  projectCode: string,
  month?: string,
): Promise<ProjectDetailResponse> {
  const qs = month ? `?month=${encodeURIComponent(month)}` : '';
  return fetchJson<ProjectDetailResponse>(
    `/api/projects/${encodeURIComponent(projectCode)}${qs}`,
  );
}

export function runSimulationApi(input: WhatIfInput): Promise<WhatIfResult> {
  return fetchJson<WhatIfResult>('/api/what-if/simulate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export function fetchFlashReports(): Promise<{ reports: FlashReport[] }> {
  return fetchJson<{ reports: FlashReport[] }>('/api/reports/flash');
}

export function askAssistantApi(payload: {
  question: string;
  reportingMonth?: string;
  projectCode?: string;
  history?: Array<{ role: 'user' | 'assistant'; text: string }>;
}): Promise<ChatResponsePayload> {
  return fetchJson<ChatResponsePayload>('/api/assistant/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}
