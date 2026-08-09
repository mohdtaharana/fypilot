import { Hono } from 'hono';
import { AIService } from './ai.service';
import type { Env } from './ai.types';

type Variables = { userId: string; userRole: string };
const aiRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

// Middleware: Extract user context (simplified - in production use JWT/session)
aiRoutes.use('*', async (c, next) => {
  const userId = c.req.header('X-User-Id') || 'demo-user';
  const userRole = c.req.header('X-User-Role') || 'student';
  c.set('userId', userId);
  c.set('userRole', userRole);
  await next();
});

// POST /api/ai/analyze-proposal
aiRoutes.post('/analyze-proposal', async (c) => {
  const ai = new AIService(c.env);
  const userId = c.get('userId');
  const userRole = c.get('userRole');

  // Rate limiting
  const allowed = await ai.checkRateLimit(userId, 'proposal_analysis', 5, 60);
  if (!allowed) {
    return c.json({ success: false, error: 'Rate limit exceeded. Please wait before requesting another analysis.' }, 429);
  }

  const body = await c.req.json();
  if (!body.proposalId) {
    return c.json({ success: false, error: 'proposalId is required' }, 400);
  }

  // Fetch proposal from DB
  const proposal = await c.env.DB.prepare('SELECT * FROM proposals WHERE id = ?').bind(body.proposalId).first();
  if (!proposal) {
    return c.json({ success: false, error: 'Proposal not found' }, 404);
  }

  const result = await ai.analyzeProposal(proposal as any, userId, userRole);
  return c.json(result, result.success ? 200 : 500);
});

// POST /api/ai/analyze-similarity
aiRoutes.post('/analyze-similarity', async (c) => {
  const ai = new AIService(c.env);
  const userId = c.get('userId');
  const userRole = c.get('userRole');

  const allowed = await ai.checkRateLimit(userId, 'similarity_analysis', 5, 60);
  if (!allowed) {
    return c.json({ success: false, error: 'Rate limit exceeded.' }, 429);
  }

  const body = await c.req.json();
  if (!body.proposalId) {
    return c.json({ success: false, error: 'proposalId is required' }, 400);
  }

  const proposal = await c.env.DB.prepare('SELECT * FROM proposals WHERE id = ?').bind(body.proposalId).first();
  if (!proposal) {
    return c.json({ success: false, error: 'Proposal not found' }, 404);
  }

  const result = await ai.analyzeSimilarity(proposal as any, userId, userRole);
  return c.json(result, result.success ? 200 : 500);
});

// POST /api/ai/analyze-risk
aiRoutes.post('/analyze-risk', async (c) => {
  const ai = new AIService(c.env);
  const userId = c.get('userId');
  const userRole = c.get('userRole');

  const allowed = await ai.checkRateLimit(userId, 'risk_analysis', 10, 60);
  if (!allowed) {
    return c.json({ success: false, error: 'Rate limit exceeded.' }, 429);
  }

  const body = await c.req.json();
  if (!body.projectId) {
    return c.json({ success: false, error: 'projectId is required' }, 400);
  }

  const result = await ai.analyzeProjectRisk(body.projectId, userId, userRole);
  return c.json(result, result.success ? 200 : 500);
});

// POST /api/ai/recommend-supervisor
aiRoutes.post('/recommend-supervisor', async (c) => {
  const ai = new AIService(c.env);
  const userId = c.get('userId');
  const userRole = c.get('userRole');

  // Only coordinators can request supervisor recommendations
  if (userRole !== 'coordinator' && userRole !== 'admin') {
    return c.json({ success: false, error: 'Only coordinators can request supervisor recommendations' }, 403);
  }

  const allowed = await ai.checkRateLimit(userId, 'supervisor_recommendation', 10, 60);
  if (!allowed) {
    return c.json({ success: false, error: 'Rate limit exceeded.' }, 429);
  }

  const body = await c.req.json();
  if (!body.proposalId) {
    return c.json({ success: false, error: 'proposalId is required' }, 400);
  }

  const result = await ai.recommendSupervisor(body.proposalId, userId, userRole);
  return c.json(result, result.success ? 200 : 500);
});

// POST /api/ai/project-insights
aiRoutes.post('/project-insights', async (c) => {
  const ai = new AIService(c.env);
  const userId = c.get('userId');
  const userRole = c.get('userRole');

  const allowed = await ai.checkRateLimit(userId, 'project_insights', 10, 60);
  if (!allowed) {
    return c.json({ success: false, error: 'Rate limit exceeded.' }, 429);
  }

  const body = await c.req.json();
  if (!body.projectId) {
    return c.json({ success: false, error: 'projectId is required' }, 400);
  }

  const result = await ai.generateProjectInsights(body.projectId, userId, userRole);
  return c.json(result, result.success ? 200 : 500);
});

// POST /api/ai/project-summary
aiRoutes.post('/project-summary', async (c) => {
  const ai = new AIService(c.env);
  const userId = c.get('userId');
  const userRole = c.get('userRole');

  const allowed = await ai.checkRateLimit(userId, 'project_summary', 10, 60);
  if (!allowed) {
    return c.json({ success: false, error: 'Rate limit exceeded.' }, 429);
  }

  const body = await c.req.json();
  if (!body.projectId) {
    return c.json({ success: false, error: 'projectId is required' }, 400);
  }

  const result = await ai.generateProjectSummary(body.projectId, userId, userRole);
  return c.json(result, result.success ? 200 : 500);
});

// POST /api/ai/feedback-suggestions
aiRoutes.post('/feedback-suggestions', async (c) => {
  const ai = new AIService(c.env);
  const userId = c.get('userId');
  const userRole = c.get('userRole');

  // Only supervisors and coordinators
  if (userRole !== 'supervisor' && userRole !== 'coordinator' && userRole !== 'admin') {
    return c.json({ success: false, error: 'Only supervisors can use feedback assistant' }, 403);
  }

  const allowed = await ai.checkRateLimit(userId, 'feedback_assistant', 10, 60);
  if (!allowed) {
    return c.json({ success: false, error: 'Rate limit exceeded.' }, 429);
  }

  const body = await c.req.json();
  if (!body.title || !body.content) {
    return c.json({ success: false, error: 'title and content are required' }, 400);
  }

  const result = await ai.generateFeedbackSuggestions({
    documentType: body.documentType || 'proposal',
    title: body.title,
    content: body.content,
    focusAreas: body.focusAreas,
  }, userId, userRole);
  return c.json(result, result.success ? 200 : 500);
});

// GET /api/ai/debug
aiRoutes.get('/debug', async (c) => {
  const key = c.env.OPENROUTER_API_KEY ? `${c.env.OPENROUTER_API_KEY.substring(0, 12)}... (length: ${c.env.OPENROUTER_API_KEY.length})` : 'MISSING';
  const model = c.env.OPENROUTER_MODEL || 'MISSING';
  
  let openRouterStatus = 'not_called';
  let openRouterResponse = '';
  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${(c.env.OPENROUTER_API_KEY || '').trim()}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://synapse-90w.pages.dev',
        'X-Title': 'Synapse FYP Platform',
      },
      body: JSON.stringify({
        model: (c.env.OPENROUTER_MODEL || 'google/gemma-4-31b-it:free').trim(),
        messages: [{ role: 'user', content: 'Say hello in 3 words' }],
        max_tokens: 30
      })
    });
    openRouterStatus = `${res.status} ${res.statusText}`;
    openRouterResponse = await res.text();
  } catch (e: any) {
    openRouterStatus = `Fetch Error: ${e?.message}`;
  }

  return c.json({ key, model, openRouterStatus, openRouterResponse });
});

// POST /api/ai/project-query
aiRoutes.post('/project-query', async (c) => {
  const ai = new AIService(c.env);
  const userId = c.get('userId');
  const userRole = c.get('userRole');

  const allowed = await ai.checkRateLimit(userId, 'project_query', 20, 60);
  if (!allowed) {
    return c.json({ success: false, error: 'Rate limit exceeded.' }, 429);
  }

  const body = await c.req.json();
  if (!body.projectId || !body.question) {
    return c.json({ success: false, error: 'projectId and question are required' }, 400);
  }

  const result = await ai.queryProject(body.projectId, body.question, userId, userRole);
  return c.json(result, result.success ? 200 : 500);
});

export { aiRoutes };
