/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * DICE Full-Stack Express Server with Gemini 3.8 Flash Integration & Vite Middleware
 */

import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { MUTUAL_FUND_SCHEMES } from './src/data/schemes';
import { DICE_QUESTIONS } from './src/data/questions';
import { calculateInvestorProfile, runDICEMatching } from './src/engine/diceEngine';
import { UserResponses, MutualFundScheme } from './src/types';
import {
  initPipelineService,
  runIngestionPipeline,
  getPipelineStats,
  querySchemes,
  getSchemeByCode,
  getDataQualityIssues,
  getCategoryHeatmapData,
} from './server/pipelineService';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json());

// Initialize Google GenAI client if API key is present
let aiClient: GoogleGenAI | null = null;
if (process.env.GEMINI_API_KEY) {
  aiClient = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// In-memory cache to prevent redundant Gemini API calls and respect rate limits
const explanationCache = new Map<string, string>();
let quotaCooldownUntil = 0;

// 1. Get all schemes
app.get('/api/schemes', (_req: Request, res: Response) => {
  res.json({
    success: true,
    count: MUTUAL_FUND_SCHEMES.length,
    data: MUTUAL_FUND_SCHEMES,
  });
});

// 2. Get questions
app.get('/api/questions', (_req: Request, res: Response) => {
  res.json({
    success: true,
    count: DICE_QUESTIONS.length,
    data: DICE_QUESTIONS,
  });
});

// 3. AI Behavioral Guidance per question (Gemini with caching & graceful rate limit handling)
app.post('/api/dice/explain', async (req: Request, res: Response) => {
  const { questionId, optionId, investorName } = req.body;
  const name = investorName ? String(investorName).trim() : 'Investor';

  const question = DICE_QUESTIONS.find((q) => q.id === Number(questionId));
  if (!question) {
    return res.status(404).json({ error: 'Question not found' });
  }

  const option = question.options.find((o) => o.id === optionId) || question.options[0];

  // Verified deterministic baseline grounded in NISM & DICE Master Document
  const fallbackResponse = {
    investorName: name,
    questionId: question.id,
    questionTitle: question.title,
    selectedOption: option.label,
    behaviouralConcept: question.behaviouralConcept,
    holdingAspect: question.holdingAspect,
    holdingInsight: option.holdingInsight,
    aiGuidance: option.aiGuidance,
    whyAsked: question.explanationWhyAsked,
    biasDetected: option.scoreImpact.behavioralBiasDetected || 'Prudent Discipline',
    source: 'deterministic',
  };

  const cacheKey = `${question.id}_${option.id}_${name}`;
  if (explanationCache.has(cacheKey)) {
    return res.json({
      ...fallbackResponse,
      aiGuidance: explanationCache.get(cacheKey)!,
      source: 'cached_ai',
    });
  }

  // Check if we are currently in quota cooldown period
  const now = Date.now();
  if (now < quotaCooldownUntil) {
    // Return verified deterministic guidance immediately without calling API
    return res.json({
      ...fallbackResponse,
      source: 'deterministic_quota_protected',
    });
  }

  // If Gemini API is available, enrich with personalized explanation
  if (aiClient && process.env.GEMINI_API_KEY) {
    try {
      const prompt = `You are the Dynamic Investment Capital Engine (DICE) behavioral guide, grounded in NISM Series V-A Mutual Fund principles and the DICE Master Document.
Investor Name: ${name}
Question ${question.id}: "${question.question}"
NISM Concept: ${question.behaviouralConcept}
Holding Aspect: ${question.holdingAspect}
Option Chosen: "${option.label}" (${option.subtext || ''})
Deterministic Insight: ${option.holdingInsight}
Deterministic Guidance: ${option.aiGuidance}

Provide a direct, conversational, 2-to-3 sentence explanation to ${name}.
Explain:
1. Why the DICE Engine asks this question and what this choice reveals about their psychological behavior/bias.
2. How this affects their financial holdings and risk capacity.
3. How DICE will calibrate their asset allocation. Keep it encouraging, strictly accurate to NISM & SEBI rules, and avoid jargon slop.`;

      const response = await aiClient.models.generateContent({
        model: 'gemini-3.1-flash-lite',
        contents: prompt,
      });

      if (response && response.text) {
        const enrichedText = response.text.trim();
        explanationCache.set(cacheKey, enrichedText);
        return res.json({
          ...fallbackResponse,
          aiGuidance: enrichedText,
          source: 'gemini_ai',
        });
      }
    } catch (err: unknown) {
      const errMsg = (err as Error)?.message || '';
      if (errMsg.includes('429') || errMsg.includes('RESOURCE_EXHAUSTED')) {
        // Activate a 60-second cooldown so subsequent requests don't fail
        quotaCooldownUntil = Date.now() + 60000;
        console.info('Gemini free tier rate limit reached; activated 60s cooldown. Serving verified deterministic guidance.');
      } else {
        console.warn('Gemini explanation fallback:', errMsg);
      }
    }
  }

  return res.json(fallbackResponse);
});

// 4. Run DICE Engine Matching
app.post('/api/dice/match', async (req: Request, res: Response) => {
  try {
    const responses: UserResponses = req.body.responses;
    if (!responses || !responses.answers) {
      return res.status(400).json({ error: 'Invalid responses payload' });
    }

    // Use client-provided scheme universe (including uploaded Excel schemes) or fallback to server default
    const clientSchemes: MutualFundScheme[] | undefined = req.body.schemes;
    const schemeUniverse = clientSchemes && clientSchemes.length > 0 ? clientSchemes : MUTUAL_FUND_SCHEMES;

    const profile = calculateInvestorProfile(responses);
    const { topMatches, allEvaluations } = runDICEMatching(schemeUniverse, profile, responses);

    // High quality deterministic synthesis based on NISM rules
    let executiveSummary = `• Behavioral Profile: ${profile.name} exhibits a ${profile.riskProfileCategory} investment temperament (Risk Capacity: ${profile.riskCapacityScore}/100, Risk Willingness: ${profile.riskWillingnessScore}/100) with a goal horizon of ${profile.timeHorizonYears} years for ${profile.goal}.\n• Asset Allocation Strategy: The DICE Engine recommends an asset mix of ${profile.targetAssetAllocation.equity}% Equity for real inflation-beating growth, ${profile.targetAssetAllocation.debt}% Debt for capital preservation, and ${profile.targetAssetAllocation.gold}% Gold/Cash for liquidity hedging.\n• Scheme Suitability: ${topMatches.length} schemes successfully passed hard eligibility constraints. Top match is ${topMatches[0]?.scheme.name || 'eligible fund'} (${topMatches[0]?.matchLabel}) with a DICE total score of ${topMatches[0]?.totalScore || 0}/100, providing verified downside protection and risk-adjusted alpha.`;

    const now = Date.now();
    if (aiClient && process.env.GEMINI_API_KEY && topMatches.length > 0 && now >= quotaCooldownUntil) {
      try {
        const topSchemeNames = topMatches.map((m) => `${m.scheme.name} (${m.matchLabel}, Score: ${m.totalScore}/100)`).join(', ');
        const prompt = `You are DICE Engine's Senior Financial Analyst. Write a scannable 3-bullet executive summary for ${profile.name}.
Investor Profile: ${profile.riskProfileCategory} (Capacity: ${profile.riskCapacityScore}/100, Willingness: ${profile.riskWillingnessScore}/100).
Goal: ${profile.goal} (${profile.timeHorizonYears} years).
Target Asset Allocation: Equity ${profile.targetAssetAllocation.equity}%, Debt ${profile.targetAssetAllocation.debt}%, Gold ${profile.targetAssetAllocation.gold}%, Cash ${profile.targetAssetAllocation.cash}%.
Top Verified Matches: ${topSchemeNames}.
Hard Rules Applied: Filtered out schemes with lock-in conflicts or horizon deficits.
Write 3 clear, professional bullet points highlighting:
1. Key behavioral profile & holding strength.
2. Recommended asset mix rationale.
3. Why the top schemes fit this investor's horizon without guaranteeing returns.`;

        const aiRes = await aiClient.models.generateContent({
          model: 'gemini-3.1-flash-lite',
          contents: prompt,
        });

        if (aiRes && aiRes.text) {
          executiveSummary = aiRes.text.trim();
        }
      } catch (err: unknown) {
        const errMsg = (err as Error)?.message || '';
        if (errMsg.includes('429') || errMsg.includes('RESOURCE_EXHAUSTED')) {
          quotaCooldownUntil = Date.now() + 60000;
        }
      }
    }

    return res.json({
      success: true,
      investorProfile: profile,
      topMatches,
      allEvaluations,
      executiveSummary,
    });
  } catch (err: unknown) {
    console.error('Error in /api/dice/match:', err);
    return res.status(500).json({ error: 'Failed to process DICE matching' });
  }
});

// 5. Calculator Endpoint
app.post('/api/calculate', (req: Request, res: Response) => {
  const { type, amount, years, annualRate, stepUpPercent } = req.body;
  const p = Number(amount) || 5000;
  const n = Number(years) || 5;
  const r = (Number(annualRate) || 12) / 100;

  if (type === 'lumpsum') {
    // FV = PV * (1 + r)^n
    const futureValue = p * Math.pow(1 + r, n);
    return res.json({
      type: 'lumpsum',
      investedAmount: p,
      futureValue: Math.round(futureValue),
      estimatedGains: Math.round(futureValue - p),
    });
  } else {
    // SIP: PMT * (((1 + i)^m - 1) / i)
    const monthlyRate = r / 12;
    const totalMonths = n * 12;
    const stepUp = (Number(stepUpPercent) || 0) / 100;

    let totalInvested = 0;
    let accumulatedValue = 0;
    let currentMonthly = p;

    for (let month = 1; month <= totalMonths; month++) {
      if (stepUp > 0 && month > 1 && (month - 1) % 12 === 0) {
        currentMonthly = currentMonthly * (1 + stepUp);
      }
      totalInvested += currentMonthly;
      accumulatedValue = (accumulatedValue + currentMonthly) * (1 + monthlyRate);
    }

    return res.json({
      type: 'sip',
      investedAmount: Math.round(totalInvested),
      futureValue: Math.round(accumulatedValue),
      estimatedGains: Math.round(accumulatedValue - totalInvested),
    });
  }
});

// ==========================================
// ZERO-COST MUTUAL FUND DATA PIPELINE APIS
// ==========================================

// Pipeline overall stats & field completeness
app.get('/api/pipeline/stats', (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: getPipelineStats(),
  });
});

// Paginated schemes query with rich filtering
app.get('/api/pipeline/schemes', (req: Request, res: Response) => {
  const {
    search,
    amc,
    category,
    broadCategory,
    plan,
    option,
    status,
    onlyWithAum,
    onlyWithTer,
    offset,
    limit,
    sortBy,
    sortOrder,
  } = req.query;

  const result = querySchemes({
    search: search ? String(search) : undefined,
    amc: amc ? String(amc) : undefined,
    category: category ? String(category) : undefined,
    broadCategory: broadCategory ? String(broadCategory) : undefined,
    plan: plan ? String(plan) : undefined,
    option: option ? String(option) : undefined,
    status: status ? String(status) : 'active',
    onlyWithAum: onlyWithAum === 'true',
    onlyWithTer: onlyWithTer === 'true',
    offset: offset ? parseInt(String(offset), 10) : 0,
    limit: limit ? Math.min(100, parseInt(String(limit), 10)) : 30,
    sortBy: sortBy ? String(sortBy) : 'aumCrores',
    sortOrder: sortOrder === 'asc' ? 'asc' : 'desc',
  });

  res.json({
    success: true,
    data: result,
  });
});

// Single scheme with complete raw source metadata and audit trail
app.get('/api/pipeline/scheme/:code', (req: Request, res: Response) => {
  const scheme = getSchemeByCode(req.params.code);
  if (!scheme) {
    return res.status(404).json({ success: false, error: 'Scheme not found in database' });
  }
  res.json({
    success: true,
    data: scheme,
  });
});

// Data quality anomalies and audit logs
app.get('/api/pipeline/data-quality', (_req: Request, res: Response) => {
  res.json({
    success: true,
    count: getDataQualityIssues().length,
    data: getDataQualityIssues(),
  });
});

// Real-time category performance heatmap data calculated across all active schemes
app.get('/api/pipeline/heatmap', (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: getCategoryHeatmapData(),
  });
});

// Trigger full pipeline ingestion or refresh
app.post('/api/pipeline/sync', async (_req: Request, res: Response) => {
  try {
    const result = await runIngestionPipeline();
    res.json({
      success: true,
      message: 'Ingestion pipeline executed successfully',
      data: result,
      stats: getPipelineStats(),
    });
  } catch (err: unknown) {
    res.status(500).json({
      success: false,
      error: (err as Error)?.message || 'Pipeline ingestion failed',
    });
  }
});

// Setup Vite middleware in dev or static files in production
async function startServer() {
  // Initialize pipeline service in background
  initPipelineService().catch((e) => console.error('[Pipeline init error]:', e));
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`DICE Engine Server running on http://localhost:${PORT}`);
  });
}

startServer();
