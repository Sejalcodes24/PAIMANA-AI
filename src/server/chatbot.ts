import { GoogleGenAI } from '@google/genai';
import type { ChatEvidenceItem, ChatResponsePayload, InfrastructureProject } from '../shared/types';
import { getAllProjectsForMonth, getDashboardSummary, getProjectDetail } from './repository';

const DEFAULT_MODEL = process.env.GEMINI_MODEL || 'gemini-4-hydrogen';

export type ChatIntent = 'greeting' | 'help' | 'unclear' | 'data';

const GREETING_PATTERNS = [
  /^(hi|hello|hey|hii+|namaste|greetings|good\s+(morning|afternoon|evening))(\s+(there|paimana|assistant|ai|team))?[\s!?.]*$/i,
  /^((hi|hello|hey|namaste|good\s+(morning|afternoon|evening))[\s,!]+)?(how\s+(are\s+you(\s+doing)?|is\s+it\s+going|are\s+things)|how's\s+it\s+going|what's\s+up|who\s+are\s+you)[\s!?.]*$/i,
  /^(thanks|thank\s+you|ok|okay|got\s+it|cool|great|bye|goodbye)[\s!?.]*$/i,
];

const HELP_PATTERNS = [
  /how\s+(do|can)\s+i\s+use/i,
  /what\s+(can|does)\s+(this|the)\s+(app|portal|dashboard|tool|assistant)/i,
  /what\s+do\s+(the\s+)?risk\s+(levels|tiers|scores)\s+mean/i,
  /difference\s+between\s+rule/i,
  /explain\s+(rule|ml|risk\s+tiers|what-if|features)/i,
  /how\s+does\s+(the\s+)?(what-if|map|risk\s+score|ml|assistant)\s+work/i,
  /help\s+me\s+understand\s+(the\s+)?(app|portal|features|risk\s+levels)/i,
];

const UNCLEAR_SINGLE_TOKENS = new Set([
  'risk',
  'risks',
  'project',
  'projects',
  'delay',
  'delays',
  'cost',
  'costs',
  'overrun',
  'overruns',
  'status',
  'data',
  'report',
  'reports',
  'state',
  'states',
  'sector',
  'sectors',
  'help',
  'info',
  'details',
  'compare',
  'check',
  'show',
]);

export function classifyChatIntent(
  question: string,
  projects: InfrastructureProject[],
  focusedProjectCode?: string,
): ChatIntent {
  const trimmed = question.trim();
  const q = trimmed.toLowerCase();

  if (GREETING_PATTERNS.some((re) => re.test(trimmed))) {
    return 'greeting';
  }

  if (HELP_PATTERNS.some((re) => re.test(trimmed))) {
    return 'help';
  }

  // If a specific project is already focused and the user asks something concrete (>1 word), treat as data
  const words = q.replace(/[^\w\s-]/g, '').split(/\s+/).filter(Boolean);
  if (words.length <= 2) {
    const mentionsKnownEntity =
      Boolean(focusedProjectCode && words.some((w) => focusedProjectCode.toLowerCase().includes(w))) ||
      projects.some(
        (p) =>
          q.includes(p.projectCode.toLowerCase()) ||
          q.includes(p.state.toLowerCase()) ||
          q.includes(p.sector.toLowerCase()),
      );

    if (!mentionsKnownEntity && (words.length === 1 || UNCLEAR_SINGLE_TOKENS.has(words[words.length - 1]))) {
      return 'unclear';
    }
  }

  if (/^(compare|check|tell me about|show me|what about)\s*[?.!]*$/i.test(trimmed)) {
    return 'unclear';
  }

  return 'data';
}

function selectRelevantProjects(
  question: string,
  projects: InfrastructureProject[],
  focusedProjectCode?: string,
): InfrastructureProject[] {
  const q = question.toLowerCase();
  const matched = new Map<string, { project: InfrastructureProject; score: number }>();

  if (focusedProjectCode) {
    const focused = projects.find(
      (p) => p.projectCode.toLowerCase() === focusedProjectCode.toLowerCase(),
    );
    if (focused) {
      matched.set(focused.projectCode, { project: focused, score: 1000 });
    }
  }

  for (const p of projects) {
    let score = 0;
    if (q.includes(p.projectCode.toLowerCase())) score += 500;
    if (q.includes(p.state.toLowerCase())) score += 120;
    if (q.includes(p.sector.toLowerCase())) score += 100;

    const nameTokens = p.name
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length >= 4);
    for (const token of nameTokens) {
      if (q.includes(token)) score += 35;
    }

    for (const b of p.bottlenecks) {
      const bTokens = b.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length >= 4);
      if (bTokens.some((t) => q.includes(t))) score += 45;
    }

    if (
      (q.includes('high risk') || q.includes('critical') || q.includes('risk') || q.includes('delay')) &&
      (p.risk.ruleBasedTier === 'Critical' || p.risk.ruleBasedTier === 'High')
    ) {
      score += p.risk.ruleBasedScore;
    }

    if (q.includes('cost') || q.includes('overrun') || q.includes('expensive') || q.includes('outlay')) {
      score += Math.min(80, p.costOverrunPct);
    }

    if (score > 0) {
      const existing = matched.get(p.projectCode);
      if (!existing || score > existing.score) {
        matched.set(p.projectCode, { project: p, score });
      }
    }
  }

  const ranked = Array.from(matched.values())
    .sort((a, b) => b.score - a.score)
    .map((m) => m.project);

  if (ranked.length === 0) {
    return [...projects]
      .sort((a, b) => b.risk.ruleBasedScore - a.risk.ruleBasedScore)
      .slice(0, 6);
  }

  return ranked.slice(0, 8);
}

function toEvidenceItems(items: InfrastructureProject[]): ChatEvidenceItem[] {
  return items.slice(0, 5).map((p) => ({
    projectCode: p.projectCode,
    name: p.name,
    state: p.state,
    sector: p.sector,
    ruleBasedScore: p.risk.ruleBasedScore,
    mlDelayProbability: p.risk.mlDelayProbability,
    delayMonths: p.delayMonths,
    costOverrunPct: p.costOverrunPct,
  }));
}

function buildConversationalReply(
  intent: 'greeting' | 'help' | 'unclear',
  question: string,
  reportingMonth: string,
  monthLabel: string,
  notice?: string,
): ChatResponsePayload {
  const q = question.toLowerCase();

  if (intent === 'greeting') {
    let answer =
      `Hello! I'm the PAIMANA AI assistant. I can help you explore Central Sector infrastructure projects for ${monthLabel}, explain risk scores or portal features, and answer questions about delays, cost overruns, states, or sectors. What would you like to check?`;

    if (/how\s+are\s+you/i.test(q)) {
      answer =
        `Doing well, thank you for asking! I'm ready to help with the ${monthLabel} PAIMANA monitoring data, explain how the risk tiers or What-If Lab work, or check specific states and projects. What can I help you with today?`;
    } else if (/thank/i.test(q)) {
      answer =
        `You're welcome! Let me know anytime if you'd like to inspect another state, sector, or project scenario.`;
    } else if (/bye|goodbye/i.test(q)) {
      answer =
        `Goodbye! Feel free to reopen the assistant whenever you want to review project risks or run comparisons.`;
    }

    return {
      answer,
      mode: 'deterministic-fallback',
      modelUsed: 'conversational-router',
      reportingMonth,
      evidence: [],
      notice,
    };
  }

  if (intent === 'help') {
    let answer: string;
    if (/risk\s+(levels|tiers|scores)|difference\s+between\s+rule|ml/i.test(q)) {
      answer = [
        'PAIMANA AI tracks two distinct, complementary risk indicators for every project:',
        '- **Rule-Based Risk Score (0–100)**: A transparent weighted score combining schedule slippage (up to 35 pts), cost escalation (up to 30 pts), financial-vs-physical progress lag (up to 15 pts), and active bottlenecks (up to 20 pts). Tiers: **Low** (<25), **Moderate** (25–47), **High** (48–69), and **Critical** (70+).',
        '- **ML Predictive Delay Hazard (%)**: A calibrated logistic hazard estimate of further delay over the next 12 months, shown alongside feature log-odds attributions.',
        'Would you like to see the projects currently in the Critical risk tier?',
      ].join('\n');
    } else if (/what-if|simulat/i.test(q)) {
      answer = [
        'In the **What-If Lab**, you can pick any project baseline and adjust its schedule slippage, anticipated cost, physical completion, or mark active bottlenecks as resolved.',
        'The simulator recalculates both the Rule-Based Risk Score and ML Delay Hazard side-by-side against the official baseline without altering any stored records.',
      ].join('\n');
    } else {
      answer = [
        'Here is how to navigate **PAIMANA AI**:',
        '- **Overview**: Switch reporting months in the top bar, review portfolio KPIs, click any state on the **India Map** (or use the High-Risk Areas bar) to inspect state totals, and jump to filtered projects.',
        '- **Projects**: Search by code/name/bottleneck, filter by State, Sector, Risk Tier, or Status, and open any project for monthly history and explainable risk breakdowns.',
        '- **What-If Lab & Reports**: Test hypothetical risk mitigation scenarios or review monthly Flash Reports and data deduplication logs.',
        'Ask me a question about any state, sector, or project whenever you are ready!',
      ].join('\n');
    }

    return {
      answer,
      mode: 'deterministic-fallback',
      modelUsed: 'conversational-router',
      reportingMonth,
      evidence: [],
      notice,
    };
  }

  // intent === 'unclear'
  const trimmed = question.trim();
  return {
    answer: `I'd be happy to help with "${trimmed}". Could you clarify whether you want to check the highest-risk projects overall, a specific state or sector, or how the portal's risk scoring works?`,
    mode: 'deterministic-fallback',
    modelUsed: 'conversational-router',
    reportingMonth,
    evidence: [],
    notice,
  };
}

function buildDeterministicFallback(
  question: string,
  reportingMonth: string,
  projects: InfrastructureProject[],
  relevant: InfrastructureProject[],
  focusedProjectCode?: string,
  notice?: string,
): ChatResponsePayload {
  const summary = getDashboardSummary(reportingMonth);
  const q = question.toLowerCase();

  // Check if user asks about an entity clearly absent from the dataset
  const mentionedUnknown =
    (q.includes('bullet train in kerala') ||
      q.includes('hyperloop') ||
      q.includes('2024') ||
      q.includes('2023') ||
      q.includes('district-level coordinates') ||
      q.includes('exact gps')) &&
    relevant.length > 0;

  if (focusedProjectCode && !summary.stateAggregates.some((s) => q.includes(s.state.toLowerCase()))) {
    const detail = getProjectDetail(focusedProjectCode, reportingMonth);
    if (detail) {
      const p = detail.project;
      const topFactors = p.risk.ruleFactors
        .filter((f) => f.points > 0)
        .map((f) => `${f.label} (${f.points}/${f.maxPoints} pts: ${f.detail})`)
        .join('; ');
      return {
        answer: [
          `Project **${p.name}** (${p.projectCode}) in **${p.state}** (${p.sector}) for ${summary.monthLabel}:`,
          `- **Status & Progress**: ${p.status} · Physical progress ${p.physicalProgressPct}% · Delay ${p.delayMonths} months (Anticipated DOC: ${p.anticipatedCompletionDate}).`,
          `- **Cost Profile**: Original ₹${p.originalCostCr.toLocaleString('en-IN')} Cr vs. Anticipated ₹${p.anticipatedCostCr.toLocaleString('en-IN')} Cr (+${p.costOverrunPct}% overrun).`,
          `- **Risk Assessment**: Rule-Based Score **${p.risk.ruleBasedScore}/100 (${p.risk.ruleBasedTier})**; ML Delay Hazard **${p.risk.mlDelayProbability}% (${p.risk.mlRiskTier})**.`,
          `- **Key Drivers**: ${topFactors || 'No major risk drivers flagged.'}`,
          `- **Primary Recommendation**: ${p.risk.recommendations[0]}`,
        ].join('\n'),
        mode: 'deterministic-fallback',
        modelUsed: 'rule-grounded-fallback',
        reportingMonth,
        evidence: toEvidenceItems([p]),
        notice,
      };
    }
  }

  if (mentionedUnknown) {
    return {
      answer: `The available PAIMANA dataset for ${summary.monthLabel} covers ${summary.kpis.totalProjects} Central Sector projects across ${summary.stateAggregates.length} States/UTs at state-level granularity only. It does not contain records matching that specific query or exact coordinate-level telemetry.`,
      mode: 'deterministic-fallback',
      modelUsed: 'rule-grounded-fallback',
      reportingMonth,
      evidence: [],
      notice,
    };
  }

  // State-specific summary if a state is named
  const matchedState = summary.stateAggregates.find((s) =>
    q.includes(s.state.toLowerCase()),
  );
  if (matchedState) {
    const stateProjects = projects.filter((p) => p.state === matchedState.state);
    return {
      answer: [
        `**${matchedState.state}** Performance Summary (${summary.monthLabel}):`,
        `- **Tracked Projects**: ${matchedState.projectCount} (${matchedState.delayedCount} delayed, ${matchedState.highRiskCount} High/Critical risk).`,
        `- **Outlay**: Original ₹${matchedState.totalOriginalCostCr.toLocaleString('en-IN')} Cr vs. Anticipated ₹${matchedState.totalAnticipatedCostCr.toLocaleString('en-IN')} Cr.`,
        `- **Average Risk**: Rule-Based ${matchedState.avgRuleRiskScore}/100 · ML Delay Probability ${matchedState.avgMlProbability}%.`,
        `- **Flagged Projects**: ${stateProjects
          .map((p) => `${p.projectCode} (${p.name}, Rule Risk ${p.risk.ruleBasedScore}/100, Delay ${p.delayMonths}m)`)
          .join('; ')}.`,
      ].join('\n'),
      mode: 'deterministic-fallback',
      modelUsed: 'rule-grounded-fallback',
      reportingMonth,
      evidence: toEvidenceItems(stateProjects),
      notice,
    };
  }

  // Sector-specific summary if a sector is named
  const matchedSector = summary.sectorBreakdown.find(
    (s) =>
      q.includes(s.sector.toLowerCase()) ||
      (q.includes('rail') && s.sector === 'Railways') ||
      (q.includes('road') && s.sector.includes('Road')) ||
      (q.includes('highway') && s.sector.includes('Road')) ||
      (q.includes('metro') && s.sector === 'Urban Development'),
  );
  if (matchedSector) {
    const sectorProjects = projects
      .filter((p) => p.sector === matchedSector.sector)
      .sort((a, b) => b.risk.ruleBasedScore - a.risk.ruleBasedScore);
    return {
      answer: [
        `**${matchedSector.sector}** Sector Summary (${summary.monthLabel}):`,
        `- **Projects**: ${matchedSector.projectCount} tracked (${matchedSector.delayedCount} delayed), average rule-based risk score **${matchedSector.avgRuleRiskScore}/100**.`,
        `- **Total Anticipated Cost**: ₹${matchedSector.totalAnticipatedCostCr.toLocaleString('en-IN')} Cr (vs. ₹${matchedSector.totalOriginalCostCr.toLocaleString('en-IN')} Cr original).`,
        `- **Highest-Risk Projects**: ${sectorProjects
          .slice(0, 3)
          .map((p) => `${p.projectCode} (${p.state}, Score ${p.risk.ruleBasedScore}/100, +${p.costOverrunPct}% cost)`)
          .join('; ')}.`,
      ].join('\n'),
      mode: 'deterministic-fallback',
      modelUsed: 'rule-grounded-fallback',
      reportingMonth,
      evidence: toEvidenceItems(sectorProjects),
      notice,
    };
  }

  // General portfolio / high-risk summary
  const topRisk = [...relevant]
    .sort((a, b) => b.risk.ruleBasedScore - a.risk.ruleBasedScore)
    .slice(0, 4);

  return {
    answer: [
      `**PAIMANA Portfolio Summary (${summary.monthLabel})**:`,
      `- **Portfolio Totals**: ${summary.kpis.totalProjects} projects · Anticipated outlay ₹${summary.kpis.totalAnticipatedCostCr.toLocaleString('en-IN')} Cr (+${summary.kpis.overallCostOverrunPct}% over original ₹${summary.kpis.totalOriginalCostCr.toLocaleString('en-IN')} Cr).`,
      `- **Risk & Delay Exposure**: ${summary.kpis.delayedProjects} delayed projects · ${summary.kpis.highOrCriticalRiskProjects} High/Critical risk projects.`,
      `- **Top Flagged Projects**: ${topRisk
        .map(
          (p) =>
            `${p.projectCode} — ${p.name} (${p.state}, Rule Risk ${p.risk.ruleBasedScore}/100, ML Delay Prob ${p.risk.mlDelayProbability}%, ${p.delayMonths}m delay)`,
        )
        .join('; ')}.`,
    ].join('\n'),
    mode: 'deterministic-fallback',
    modelUsed: 'rule-grounded-fallback',
    reportingMonth,
    evidence: toEvidenceItems(topRisk),
    notice,
  };
}

export async function answerProjectQuestion(params: {
  question: string;
  reportingMonth?: string;
  projectCode?: string;
  history?: Array<{ role: 'user' | 'assistant'; text: string }>;
}): Promise<ChatResponsePayload> {
  const { reportingMonth, projects } = getAllProjectsForMonth(params.reportingMonth);
  const summary = getDashboardSummary(reportingMonth);
  const intent = classifyChatIntent(params.question, projects, params.projectCode);
  const relevant = selectRelevantProjects(params.question, projects, params.projectCode);

  const apiKey = process.env.GEMINI_API_KEY?.trim();
  const isPlaceholder = !apiKey || apiKey === 'MY_GEMINI_API_KEY';

  // For greetings, general help, or unclear queries when AI is unconfigured, reply directly without dumping a project report
  if (isPlaceholder) {
    if (intent !== 'data') {
      return buildConversationalReply(
        intent,
        params.question,
        reportingMonth,
        summary.monthLabel,
      );
    }
    return buildDeterministicFallback(
      params.question,
      reportingMonth,
      projects,
      relevant,
      params.projectCode,
      'Live AI model is not configured on the server; serving grounded analysis from the active monthly dataset.',
    );
  }

  try {
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const contextPayload = {
      reportingMonth: summary.monthLabel,
      portfolioKpis: summary.kpis,
      topSectors: summary.sectorBreakdown.slice(0, 6),
      stateSummaries: summary.stateAggregates.map((s) => ({
        state: s.state,
        projectCount: s.projectCount,
        delayedCount: s.delayedCount,
        avgRuleRiskScore: s.avgRuleRiskScore,
        avgMlProbability: s.avgMlProbability,
        totalAnticipatedCostCr: s.totalAnticipatedCostCr,
      })),
      matchedProjects: relevant.map((p) => ({
        projectCode: p.projectCode,
        name: p.name,
        state: p.state,
        sector: p.sector,
        implementingAgency: p.implementingAgency,
        status: p.status,
        originalCostCr: p.originalCostCr,
        anticipatedCostCr: p.anticipatedCostCr,
        costOverrunPct: p.costOverrunPct,
        cumulativeExpenditureCr: p.cumulativeExpenditureCr,
        physicalProgressPct: p.physicalProgressPct,
        delayMonths: p.delayMonths,
        originalCompletionDate: p.originalCompletionDate,
        anticipatedCompletionDate: p.anticipatedCompletionDate,
        bottlenecks: p.bottlenecks,
        ruleBasedScore: p.risk.ruleBasedScore,
        ruleBasedTier: p.risk.ruleBasedTier,
        ruleFactors: p.risk.ruleFactors.map((f) => `${f.label}: ${f.points}/${f.maxPoints} (${f.detail})`),
        mlDelayProbability: p.risk.mlDelayProbability,
        mlRiskTier: p.risk.mlRiskTier,
        recommendations: p.risk.recommendations,
      })),
    };

    const conversationTranscript = (params.history ?? [])
      .slice(-4)
      .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.text}`)
      .join('\n');

    const prompt = [
      `Detected Intent Hint: ${intent}`,
      intent === 'data' ? `Grounding Dataset (Authoritative JSON):\n${JSON.stringify(contextPayload)}` : `Active Reporting Period: ${summary.monthLabel} (${summary.kpis.totalProjects} projects tracked).`,
      conversationTranscript ? `\nRecent Conversation:\n${conversationTranscript}` : '',
      `\nUser Message: ${params.question}`,
    ]
      .filter(Boolean)
      .join('\n');

    const response = await ai.models.generateContent({
      model: DEFAULT_MODEL,
      contents: prompt,
      config: {
        systemInstruction:
          'You are the PAIMANA AI conversational assistant for Central Sector infrastructure monitoring. ' +
          'Adapt your response to the user message naturally:\n' +
          '1. For greetings or small talk (e.g., "Hi", "Hello", "How are you?", "Thanks"), respond warmly and briefly in 1–2 sentences without generating a project report.\n' +
          '2. For general questions about how to use PAIMANA AI (Overview map, Projects filters, What-If Lab, Reports) or what the risk levels mean (Rule-Based Score 0–100: Low <25, Moderate 25–47, High 48–69, Critical 70+; vs ML Delay Probability % over 12 months), explain clearly without dumping unsolicited project records.\n' +
          '3. When the user request is short or ambiguous (e.g., just "risk", "projects", or "compare"), ask a short, helpful clarifying follow-up question.\n' +
          '4. For data questions about projects, delays, cost overruns, states, sectors, or risk factors, answer strictly using the Grounding Dataset JSON, cite exact project codes and figures (Rs. Crore, percentages, delay months), distinguish Rule-Based Score from ML Delay Probability, and explicitly state if the dataset does not contain the requested information.',
      },
    });

    const text = response.text?.trim();
    if (!text) {
      throw new Error('Empty response from Gemini model');
    }

    const qLower = params.question.toLowerCase();
    const outOfScope =
      qLower.includes('bullet train in kerala') ||
      qLower.includes('hyperloop') ||
      qLower.includes('exact gps') ||
      qLower.includes('district-level coordinates');

    return {
      answer: text,
      mode: 'gemini',
      modelUsed: DEFAULT_MODEL,
      reportingMonth,
      evidence: intent === 'data' && !outOfScope ? toEvidenceItems(relevant) : [],
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Upstream AI service unavailable';
    if (intent !== 'data') {
      return buildConversationalReply(
        intent,
        params.question,
        reportingMonth,
        summary.monthLabel,
      );
    }
    return buildDeterministicFallback(
      params.question,
      reportingMonth,
      projects,
      relevant,
      params.projectCode,
      `Live AI service unavailable (${message}); showing grounded deterministic summary from the active dataset.`,
    );
  }
}
