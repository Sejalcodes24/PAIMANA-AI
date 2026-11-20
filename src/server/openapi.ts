export function getOpenApiSpec() {
  return {
    openapi: '3.0.3',
    info: {
      title: 'PAIMANA AI API',
      version: '1.0.0',
      description:
        'Infrastructure monitoring, explainable rule-based & ML risk analytics, What-If simulation, monthly flash reports, and grounded AI assistant API.',
    },
    servers: [{ url: '/' }],
    paths: {
      '/api/health': {
        get: {
          summary: 'Service and dataset health status',
          responses: {
            '200': { description: 'Service healthy with loaded dataset metrics' },
          },
        },
      },
      '/api/dashboard/summary': {
        get: {
          summary: 'Portfolio KPIs, risk distribution, sector breakdown, state aggregates, and watchlist',
          parameters: [
            {
              name: 'month',
              in: 'query',
              required: false,
              schema: { type: 'string', example: '2026-03' },
            },
          ],
          responses: {
            '200': { description: 'Dashboard summary payload' },
          },
        },
      },
      '/api/projects': {
        get: {
          summary: 'Query infrastructure projects with search, filters, sorting, and pagination',
          parameters: [
            { name: 'month', in: 'query', schema: { type: 'string' } },
            { name: 'search', in: 'query', schema: { type: 'string' } },
            { name: 'state', in: 'query', schema: { type: 'string' } },
            { name: 'sector', in: 'query', schema: { type: 'string' } },
            { name: 'riskTier', in: 'query', schema: { type: 'string' } },
            { name: 'status', in: 'query', schema: { type: 'string' } },
            { name: 'sortBy', in: 'query', schema: { type: 'string' } },
            { name: 'sortOrder', in: 'query', schema: { type: 'string', enum: ['asc', 'desc'] } },
            { name: 'page', in: 'query', schema: { type: 'integer' } },
            { name: 'pageSize', in: 'query', schema: { type: 'integer' } },
          ],
          responses: {
            '200': { description: 'Paginated list of projects and filter facets' },
          },
        },
      },
      '/api/projects/{projectCode}': {
        get: {
          summary: 'Fetch project detail, monthly history, explainable risk breakdown, and recommendations',
          parameters: [
            { name: 'projectCode', in: 'path', required: true, schema: { type: 'string' } },
            { name: 'month', in: 'query', schema: { type: 'string' } },
          ],
          responses: {
            '200': { description: 'Project detail payload' },
            '404': { description: 'Project not found' },
          },
        },
      },
      '/api/what-if/simulate': {
        post: {
          summary: 'Run What-If risk simulation without modifying official source records',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['projectCode'],
                  properties: {
                    projectCode: { type: 'string' },
                    reportingMonth: { type: 'string' },
                    physicalProgressPct: { type: 'number' },
                    anticipatedCostCr: { type: 'number' },
                    delayMonths: { type: 'number' },
                    resolvedBottlenecks: { type: 'array', items: { type: 'string' } },
                  },
                },
              },
            },
          },
          responses: {
            '200': { description: 'Baseline vs. simulated risk result' },
            '400': { description: 'Validation error' },
            '404': { description: 'Project not found' },
          },
        },
      },
      '/api/reports/flash': {
        get: {
          summary: 'List monthly flash reports and ingestion deduplication notes',
          responses: { '200': { description: 'Array of flash report entries' } },
        },
      },
      '/api/assistant/chat': {
        post: {
          summary: 'Ask a data-grounded question about projects, risk drivers, or states',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['question'],
                  properties: {
                    question: { type: 'string' },
                    reportingMonth: { type: 'string' },
                    projectCode: { type: 'string' },
                  },
                },
              },
            },
          },
          responses: {
            '200': { description: 'Grounded AI answer with cited project evidence' },
            '400': { description: 'Missing question' },
          },
        },
      },
    },
  };
}

export function renderApiDocsHtml(): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>PAIMANA AI — OpenAPI Documentation</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; margin: 0; padding: 32px; background: #f4f6f9; color: #0f172a; }
    .container { max-width: 960px; margin: 0 auto; background: #fff; border: 1px solid #cbd5e1; border-radius: 8px; padding: 28px; }
    h1 { margin-top: 0; color: #0b2545; font-size: 24px; }
    .endpoint { border-top: 1px solid #e2e8f0; padding: 14px 0; }
    .method { display: inline-block; font-family: monospace; font-weight: 700; padding: 2px 8px; border-radius: 4px; font-size: 12px; margin-right: 8px; background: #0b2545; color: #fff; }
    .path { font-family: monospace; font-weight: 600; font-size: 14px; }
    p { color: #475569; margin: 6px 0 0; font-size: 14px; }
    a { color: #1d4ed8; }
  </style>
</head>
<body>
  <div class="container">
    <h1>PAIMANA AI — OpenAPI Reference</h1>
    <p>Machine-readable schema: <a href="/api/openapi.json">/api/openapi.json</a></p>
    <div id="list"></div>
  </div>
  <script>
    fetch('/api/openapi.json').then(r => r.json()).then(spec => {
      const root = document.getElementById('list');
      for (const [path, methods] of Object.entries(spec.paths)) {
        for (const [method, info] of Object.entries(methods)) {
          const div = document.createElement('div');
          div.className = 'endpoint';
          div.innerHTML = '<span class="method">' + method.toUpperCase() + '</span><span class="path">' + path + '</span><p>' + (info.summary || '') + '</p>';
          root.appendChild(div);
        }
      }
    });
  </script>
</body>
</html>`;
}
