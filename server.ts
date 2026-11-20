import 'dotenv/config';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { createServer as createViteServer } from 'vite';
import { answerProjectQuestion } from './src/server/chatbot';
import { getOpenApiSpec, renderApiDocsHtml } from './src/server/openapi';
import {
  getDashboardSummary,
  getFlashReports,
  getProjectDetail,
  loadRepositoryStore,
  queryProjects,
} from './src/server/repository';
import { runWhatIfSimulation } from './src/shared/risk';

export async function createAppServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  // Preload CSV repository on startup
  const initialStore = loadRepositoryStore();

  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'paimana-ai',
      monthsAvailable: initialStore.monthsSortedDesc,
      dataIntegrity: initialStore.dataIntegrity,
      aiConfigured: Boolean(
        process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY',
      ),
    });
  });

  app.get('/api/openapi.json', (_req, res) => {
    res.json(getOpenApiSpec());
  });

  app.get('/api/docs', (_req, res) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(renderApiDocsHtml());
  });

  app.get('/api/dashboard/summary', (req, res) => {
    try {
      const month = typeof req.query.month === 'string' ? req.query.month : undefined;
      res.json(getDashboardSummary(month));
    } catch (err) {
      res.status(500).json({
        error: 'Failed to compute dashboard summary',
        detail: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  });

  app.get('/api/projects', (req, res) => {
    try {
      const q = req.query;
      const page = q.page ? Number(q.page) : 1;
      const pageSize = q.pageSize ? Number(q.pageSize) : 10;
      if (!Number.isFinite(page) || page < 1 || !Number.isFinite(pageSize) || pageSize < 1) {
        return res.status(400).json({ error: 'Invalid pagination parameters.' });
      }

      const result = queryProjects({
        month: typeof q.month === 'string' ? q.month : undefined,
        search: typeof q.search === 'string' ? q.search : undefined,
        state: typeof q.state === 'string' ? q.state : undefined,
        sector: typeof q.sector === 'string' ? q.sector : undefined,
        riskTier: typeof q.riskTier === 'string' ? q.riskTier : undefined,
        status: typeof q.status === 'string' ? q.status : undefined,
        sortBy: typeof q.sortBy === 'string' ? (q.sortBy as never) : undefined,
        sortOrder: q.sortOrder === 'asc' ? 'asc' : 'desc',
        page,
        pageSize,
      });
      res.json(result);
    } catch (err) {
      res.status(500).json({
        error: 'Failed to query projects',
        detail: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  });

  app.get('/api/projects/:projectCode', (req, res) => {
    const projectCode = req.params.projectCode?.trim();
    if (!projectCode) {
      return res.status(400).json({ error: 'Project code is required.' });
    }
    const month = typeof req.query.month === 'string' ? req.query.month : undefined;
    const detail = getProjectDetail(projectCode, month);
    if (!detail) {
      return res.status(404).json({ error: `Project "${projectCode}" not found.` });
    }
    res.json(detail);
  });

  app.post('/api/what-if/simulate', (req, res) => {
    const body = req.body as Record<string, unknown> | undefined;
    if (!body || typeof body.projectCode !== 'string' || !body.projectCode.trim()) {
      return res.status(400).json({ error: 'Valid projectCode is required for simulation.' });
    }

    const month = typeof body.reportingMonth === 'string' ? body.reportingMonth : undefined;
    const detail = getProjectDetail(body.projectCode.trim(), month);
    if (!detail) {
      return res.status(404).json({ error: `Project "${body.projectCode}" not found.` });
    }

    const p = detail.project;
    const physicalProgressPct = Number(
      body.physicalProgressPct ?? p.physicalProgressPct,
    );
    const anticipatedCostCr = Number(body.anticipatedCostCr ?? p.anticipatedCostCr);
    const delayMonths = Number(body.delayMonths ?? p.delayMonths);
    const resolvedBottlenecks = Array.isArray(body.resolvedBottlenecks)
      ? body.resolvedBottlenecks.filter((x): x is string => typeof x === 'string')
      : [];

    if (
      !Number.isFinite(physicalProgressPct) ||
      physicalProgressPct < 0 ||
      physicalProgressPct > 100
    ) {
      return res.status(400).json({ error: 'physicalProgressPct must be between 0 and 100.' });
    }
    if (!Number.isFinite(anticipatedCostCr) || anticipatedCostCr <= 0) {
      return res.status(400).json({ error: 'anticipatedCostCr must be a positive number.' });
    }
    if (!Number.isFinite(delayMonths) || delayMonths < 0 || delayMonths > 360) {
      return res.status(400).json({ error: 'delayMonths must be between 0 and 360.' });
    }

    const simulation = runWhatIfSimulation(
      {
        projectCode: p.projectCode,
        name: p.name,
        sector: p.sector,
        originalCostCr: p.originalCostCr,
        anticipatedCostCr: p.anticipatedCostCr,
        cumulativeExpenditureCr: p.cumulativeExpenditureCr,
        physicalProgressPct: p.physicalProgressPct,
        delayMonths: p.delayMonths,
        bottlenecks: p.bottlenecks,
      },
      {
        physicalProgressPct,
        anticipatedCostCr,
        delayMonths,
        resolvedBottlenecks,
      },
    );

    res.json(simulation);
  });

  app.get('/api/reports/flash', (_req, res) => {
    res.json({ reports: getFlashReports() });
  });

  app.post('/api/assistant/chat', async (req, res) => {
    const body = req.body as Record<string, unknown> | undefined;
    const question = typeof body?.question === 'string' ? body.question.trim() : '';
    if (!question) {
      return res.status(400).json({ error: 'Please enter a question for the PAIMANA assistant.' });
    }
    if (question.length > 1000) {
      return res.status(400).json({ error: 'Question must be 1,000 characters or fewer.' });
    }

    const reportingMonth =
      typeof body?.reportingMonth === 'string' ? body.reportingMonth : undefined;
    const projectCode =
      typeof body?.projectCode === 'string' ? body.projectCode : undefined;
    const history = Array.isArray(body?.history)
      ? (body.history as Array<{ role: 'user' | 'assistant'; text: string }>).filter(
          (m) =>
            m &&
            (m.role === 'user' || m.role === 'assistant') &&
            typeof m.text === 'string',
        )
      : [];

    const reply = await answerProjectQuestion({
      question,
      reportingMonth,
      projectCode,
      history,
    });
    res.json(reply);
  });

  // Return JSON 404 for unknown API routes
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'API endpoint not found.' });
  });

  const isProd = process.env.NODE_ENV === 'production';
  const distPath = path.resolve(process.cwd(), 'dist');

  if (isProd && fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  return app;
}

const port = Number(process.env.PORT || 3000);
createAppServer().then((app) => {
  app.listen(port, '0.0.0.0', () => {
    console.log(`PAIMANA AI server running on http://0.0.0.0:${port}`);
  });
});
