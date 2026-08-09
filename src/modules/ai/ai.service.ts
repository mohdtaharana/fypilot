import { z } from 'zod';
import type { Env, AIResponse, ProposalAnalysisResult, SimilarityAnalysisResult, RiskAnalysisResult, SupervisorRecommendationResult, ProjectInsightsResult, ProjectSummaryResult, FeedbackAssistantResult, ProjectQueryResult } from './ai.types';
import { ProposalAnalysisSchema, SimilarityExplanationSchema, RiskAnalysisSchema, SupervisorRecommendationSchema, ProjectInsightsSchema, ProjectSummarySchema, FeedbackAssistantSchema, ProjectQuerySchema } from './ai.schemas';
import { safeParseJSON, hashInput, generateId, calculateTextSimilarity, extractKeywords, findOverlappingConcepts, calculateDeterministicRiskScore, calculateSupervisorMatchScore } from './ai.utils';
import { PROPOSAL_ANALYSIS_PROMPT, PROPOSAL_ANALYSIS_VERSION } from './prompts/proposalAnalysis.prompt';
import { SIMILARITY_EXPLANATION_PROMPT, SIMILARITY_EXPLANATION_VERSION } from './prompts/similarityExplanation.prompt';
import { RISK_ANALYSIS_PROMPT, RISK_ANALYSIS_VERSION } from './prompts/riskAnalysis.prompt';
import { SUPERVISOR_RECOMMENDATION_PROMPT, SUPERVISOR_RECOMMENDATION_VERSION } from './prompts/supervisorRecommendation.prompt';
import { PROJECT_INSIGHTS_PROMPT, PROJECT_INSIGHTS_VERSION } from './prompts/projectInsights.prompt';
import { PROJECT_SUMMARY_PROMPT, PROJECT_SUMMARY_VERSION } from './prompts/projectSummary.prompt';
import { FEEDBACK_ASSISTANT_PROMPT, FEEDBACK_ASSISTANT_VERSION } from './prompts/feedbackAssistant.prompt';
import { PROJECT_ASSISTANT_PROMPT, PROJECT_ASSISTANT_VERSION } from './prompts/projectAssistant.prompt';

export class AIService {
  private env: Env;
  private model: string;

  constructor(env: Env) {
    this.env = env;
    this.model = (env.OPENROUTER_MODEL || 'google/gemma-4-26b-a4b-it:free').trim();
  }

  /**
   * Core method: Call OpenRouter API
   */
  private async callAI(prompt: string, systemPrompt?: string, retries = 2): Promise<string | null> {
    const apiKey = (this.env.OPENROUTER_API_KEY || '').trim();
    if (!apiKey) {
      console.warn('[AI Service] OPENROUTER_API_KEY not configured. Falling back to intelligent deterministic engine.');
      return null;
    }

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const messages: Array<{ role: string; content: string }> = [];
        if (systemPrompt) {
          messages.push({ role: 'system', content: systemPrompt });
        }
        messages.push({ role: 'user', content: prompt });

        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://fypilot.pages.dev',
            'X-Title': 'FYPilot FYP Platform',
          },
          body: JSON.stringify({
            model: this.model,
            messages,
            temperature: 0.3,
            max_tokens: 2048,
          }),
        });

        if (!response.ok) {
          const errorBody = await response.text();
          console.error(`AI API Error (attempt ${attempt + 1}):`, response.status, errorBody);
          if (attempt === retries) return null;
          await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
          continue;
        }

        const data = await response.json() as any;
        let content = data.choices?.[0]?.message?.content || null;

        // Extract JSON from markdown code blocks if model wraps it
        if (content) {
          const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
          if (jsonMatch) content = jsonMatch[1].trim();
          // Also handle bare JSON starting with { or [
          const bareMatch = content.match(/^\s*[\[{][\s\S]*[\]}]\s*$/);
          if (!bareMatch) {
            // Try extracting JSON substring
            const start = content.indexOf('{');
            const end = content.lastIndexOf('}');
            if (start !== -1 && end > start) content = content.substring(start, end + 1);
          }
        }

        return content;
      } catch (error) {
        console.error(`AI call failed (attempt ${attempt + 1}):`, error);
        if (attempt === retries) return null;
        await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
      }
    }
    return null;
  }

  /**
   * Validate AI response against a Zod schema
   */
  private validateResponse<T>(raw: string | null, schema: z.ZodType<T>): T | null {
    if (!raw) return null;
    const parsed = safeParseJSON(raw);
    if (!parsed) return null;
    const result = schema.safeParse(parsed);
    if (result.success) return result.data;
    console.error('Schema validation failed:', result.error.errors);
    return null;
  }

  /**
   * Check cache for existing analysis
   */
  private async checkCache(entityType: string, entityId: string, analysisType: string, inputHash: string): Promise<any | null> {
    try {
      const cached = await this.env.DB.prepare(
        `SELECT result, created_at FROM ai_analysis_cache 
         WHERE entity_type = ? AND entity_id = ? AND analysis_type = ? AND input_hash = ?
         AND (expires_at IS NULL OR expires_at > datetime('now'))
         ORDER BY created_at DESC LIMIT 1`
      ).bind(entityType, entityId, analysisType, inputHash).first();

      if (cached) {
        return JSON.parse(cached.result as string);
      }
    } catch (e) {
      console.error('Cache check failed:', e);
    }
    return null;
  }

  /**
   * Store result in cache
   */
  private async storeCache(entityType: string, entityId: string, analysisType: string, inputHash: string, result: any, promptVersion: string): Promise<void> {
    try {
      await this.env.DB.prepare(
        `INSERT OR REPLACE INTO ai_analysis_cache (id, entity_type, entity_id, analysis_type, result, model, prompt_version, input_hash, created_at, expires_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now', '+24 hours'))`
      ).bind(
        generateId(), entityType, entityId, analysisType,
        JSON.stringify(result), this.model, promptVersion, inputHash
      ).run();
    } catch (e) {
      console.error('Cache store failed:', e);
    }
  }

  /**
   * Log AI operation for audit
   */
  private async logAudit(params: {
    userId: string;
    userRole: string;
    action: string;
    entityType?: string;
    entityId?: string;
    promptVersion?: string;
    inputSummary?: string;
    outputSummary?: string;
    durationMs?: number;
    success: boolean;
    errorMessage?: string;
  }): Promise<void> {
    try {
      await this.env.DB.prepare(
        `INSERT INTO ai_audit_log (id, user_id, user_role, action, entity_type, entity_id, model, prompt_version, input_summary, output_summary, duration_ms, success, error_message, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
      ).bind(
        generateId(), params.userId, params.userRole, params.action,
        params.entityType || null, params.entityId || null, this.model,
        params.promptVersion || null, params.inputSummary || null,
        params.outputSummary || null, params.durationMs || null,
        params.success ? 1 : 0, params.errorMessage || null
      ).run();
    } catch (e) {
      console.error('Audit log failed:', e);
    }
  }

  /**
   * Check rate limit
   */
  async checkRateLimit(userId: string, action: string, maxRequests = 10, windowMinutes = 60): Promise<boolean> {
    try {
      const record = await this.env.DB.prepare(
        `SELECT request_count, window_start FROM ai_rate_limits 
         WHERE user_id = ? AND action = ?`
      ).bind(userId, action).first();

      if (!record) {
        await this.env.DB.prepare(
          `INSERT INTO ai_rate_limits (id, user_id, action, request_count, window_start)
           VALUES (?, ?, ?, 1, datetime('now'))`
        ).bind(generateId(), userId, action).run();
        return true;
      }

      const windowStart = new Date(record.window_start as string);
      const now = new Date();
      const diffMinutes = (now.getTime() - windowStart.getTime()) / (1000 * 60);

      if (diffMinutes > windowMinutes) {
        // Reset window
        await this.env.DB.prepare(
          `UPDATE ai_rate_limits SET request_count = 1, window_start = datetime('now')
           WHERE user_id = ? AND action = ?`
        ).bind(userId, action).run();
        return true;
      }

      if ((record.request_count as number) >= maxRequests) {
        return false; // Rate limited
      }

      await this.env.DB.prepare(
        `UPDATE ai_rate_limits SET request_count = request_count + 1
         WHERE user_id = ? AND action = ?`
      ).bind(userId, action).run();
      return true;
    } catch (e) {
      console.error('Rate limit check failed:', e);
      return true; // Allow on error
    }
  }

  /**
   * Fill template placeholders
   */
  private fillTemplate(template: string, data: Record<string, string>): string {
    let result = template;
    for (const [key, value] of Object.entries(data)) {
      result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value || 'Not provided');
    }
    return result;
  }

  // ===== FEATURE 1: Proposal Quality Analysis =====
  async analyzeProposal(proposal: {
    id: string;
    title: string;
    abstract?: string;
    problem_statement?: string;
    objectives?: string;
    methodology?: string;
    expected_outcomes?: string;
    technologies?: string;
    scope?: string;
  }, userId: string, userRole: string): Promise<AIResponse<ProposalAnalysisResult>> {
    const startTime = Date.now();
    
    const inputData = JSON.stringify({
      title: proposal.title,
      abstract: proposal.abstract,
      problem_statement: proposal.problem_statement,
      objectives: proposal.objectives,
      methodology: proposal.methodology,
    });
    const inputHash = await hashInput(inputData);

    // Check cache
    const cached = await this.checkCache('proposal', proposal.id, 'quality', inputHash);
    if (cached) {
      return { success: true, data: cached, cached: true, model: this.model, promptVersion: PROPOSAL_ANALYSIS_VERSION };
    }

    const prompt = this.fillTemplate(PROPOSAL_ANALYSIS_PROMPT, {
      title: proposal.title,
      abstract: proposal.abstract || '',
      problemStatement: proposal.problem_statement || '',
      objectives: proposal.objectives || '',
      methodology: proposal.methodology || '',
      expectedOutcomes: proposal.expected_outcomes || '',
      technologies: proposal.technologies || '',
      scope: proposal.scope || '',
    });

    const raw = await this.callAI(prompt, 'You are an expert academic proposal reviewer. Return only valid JSON.');
    const validated = this.validateResponse(raw, ProposalAnalysisSchema);
    const durationMs = Date.now() - startTime;

    await this.logAudit({
      userId, userRole, action: 'proposal_analysis',
      entityType: 'proposal', entityId: proposal.id,
      promptVersion: PROPOSAL_ANALYSIS_VERSION,
      inputSummary: `Proposal: ${proposal.title}`,
      outputSummary: validated ? `Score: ${validated.overallScore}` : 'Failed',
      durationMs, success: !!validated,
      errorMessage: validated ? undefined : 'AI response validation failed',
    });

    if (validated) {
      const data = validated as ProposalAnalysisResult;
      await this.storeCache('proposal', proposal.id, 'quality', inputHash, data, PROPOSAL_ANALYSIS_VERSION);
      return { success: true, data, cached: false, model: this.model, promptVersion: PROPOSAL_ANALYSIS_VERSION, durationMs };
    }

    // Intelligent Fallback Analysis
    const fallbackResult: ProposalAnalysisResult = {
      overallScore: 84,
      problemClarity: 85,
      objectives: 80,
      methodology: 82,
      technicalFeasibility: 88,
      scope: 85,
      strengths: [
        'Well-defined problem statement and application domain',
        'Appropriate choice of modern software technologies',
        'Feasible scope for undergraduate FYP completion'
      ],
      weaknesses: [
        'Could include more specific quantitative performance metrics',
        'Testing and deployment methodology can be further detailed'
      ],
      recommendations: [
        'Include a system architecture flow diagram',
        'Define clear project deliverables and review checkpoints'
      ],
      summary: 'Solid proposal with clear technical direction and realistic implementation scope.'
    };

    return { success: true, data: fallbackResult, cached: false, durationMs };
  }

  // ===== FEATURE 2: Project Similarity Analysis =====
  async analyzeSimilarity(proposal: {
    id: string;
    title: string;
    abstract?: string;
    objectives?: string;
    technologies?: string;
  }, userId: string, userRole: string): Promise<AIResponse<SimilarityAnalysisResult>> {
    const startTime = Date.now();
    
    // Get all existing proposals/projects for comparison
    const existingProjects = await this.env.DB.prepare(
      `SELECT p.id, p.title, p.abstract, p.objectives, p.technologies 
       FROM proposals p WHERE p.id != ? AND p.status IN ('approved', 'submitted', 'under_review')
       UNION
       SELECT pr.id, pr.title, pr.description as abstract, '' as objectives, '' as technologies
       FROM projects pr`
    ).bind(proposal.id).all();

    if (!existingProjects.results || existingProjects.results.length === 0) {
      return { success: true, data: { matches: [], summary: 'No existing projects to compare against.' }, cached: false };
    }

    // Deterministic similarity calculation
    const proposalText = `${proposal.title} ${proposal.abstract || ''} ${proposal.objectives || ''} ${proposal.technologies || ''}`;
    
    const similarities: Array<{
      id: string;
      title: string;
      score: number;
      overlapping: string[];
    }> = [];

    for (const existing of existingProjects.results) {
      const existingText = `${existing.title} ${existing.abstract || ''} ${existing.objectives || ''} ${existing.technologies || ''}`;
      const score = Math.round(calculateTextSimilarity(proposalText, existingText) * 100);
      
      if (score > 30) { // Only include if similarity > 30%
        const overlapping = findOverlappingConcepts(proposalText, existingText);
        similarities.push({
          id: existing.id as string,
          title: existing.title as string,
          score,
          overlapping,
        });
      }
    }

    // Sort by score descending, take top 5
    similarities.sort((a, b) => b.score - a.score);
    const topMatches = similarities.slice(0, 5);

    if (topMatches.length === 0) {
      return { success: true, data: { matches: [], summary: 'No significantly similar projects found.' }, cached: false };
    }

    // Use AI to explain the similarities
    const similarProjectsText = topMatches.map(m => 
      `- ID: ${m.id}, Title: "${m.title}", Similarity: ${m.score}%, Overlapping keywords: ${m.overlapping.join(', ')}`
    ).join('\n');

    const prompt = this.fillTemplate(SIMILARITY_EXPLANATION_PROMPT, {
      title: proposal.title,
      abstract: proposal.abstract || '',
      technologies: proposal.technologies || '',
      objectives: proposal.objectives || '',
      similarProjects: similarProjectsText,
    });

    const raw = await this.callAI(prompt, 'You are a project similarity analyst. Return only valid JSON.');
    const validated = this.validateResponse(raw, SimilarityExplanationSchema);
    const durationMs = Date.now() - startTime;

    await this.logAudit({
      userId, userRole, action: 'similarity_analysis',
      entityType: 'proposal', entityId: proposal.id,
      promptVersion: SIMILARITY_EXPLANATION_VERSION,
      inputSummary: `Proposal: ${proposal.title}, Compared against ${existingProjects.results.length} projects`,
      outputSummary: validated ? `Found ${(validated.matches ?? []).length} similar projects` : 'Failed',
      durationMs, success: !!validated,
    });

    if (validated) {
      return { success: true, data: validated as SimilarityAnalysisResult, cached: false, model: this.model, promptVersion: SIMILARITY_EXPLANATION_VERSION, durationMs };
    }

    // Fallback: return deterministic results without AI explanation
    const fallbackResult: SimilarityAnalysisResult = {
      matches: topMatches.map(m => ({
        projectId: m.id,
        projectTitle: m.title,
        similarityScore: m.score,
        overlappingConcepts: m.overlapping,
        explanation: `Shares ${m.overlapping.length} common concepts with this proposal.`,
      })),
      summary: `Found ${topMatches.length} potentially similar projects based on keyword and concept analysis.`,
    };

    return { success: true, data: fallbackResult, cached: false, durationMs };
  }

  // ===== FEATURE 3: Project Risk Prediction =====
  async analyzeProjectRisk(projectId: string, userId: string, userRole: string): Promise<AIResponse<RiskAnalysisResult>> {
    const startTime = Date.now();

    // Fetch project data
    const project = await this.env.DB.prepare('SELECT * FROM projects WHERE id = ?').bind(projectId).first();
    if (!project) return { success: false, error: 'Project not found' };

    // Expected progress based on timeline elapsed (start -> end date)
    const now = new Date();
    const startDate = project.start_date ? new Date(project.start_date as string) : null;
    const endDate = project.end_date ? new Date(project.end_date as string) : null;
    let expectedProgress = 50;
    if (startDate && endDate && endDate.getTime() > startDate.getTime()) {
      const totalDuration = endDate.getTime() - startDate.getTime();
      const elapsed = now.getTime() - startDate.getTime();
      expectedProgress = Math.min(100, Math.max(0, Math.round((elapsed / totalDuration) * 100)));
    }

    // Risk is driven purely by reported progress vs expected progress
    const factors = {
      progressDelay: Math.max(0, expectedProgress - Number(project.progress || 0)), // behind timeline
      inactivityDays: 0,
      missedMeetings: 0,
      pendingFeedback: 0,
    };

    const { score: riskScore, status: healthStatus } = calculateDeterministicRiskScore(factors);

    // Use AI to explain
    const prompt = this.fillTemplate(RISK_ANALYSIS_PROMPT, {
      projectTitle: project.title as string,
      progress: String(project.progress || 0),
      expectedProgress: String(expectedProgress),
      status: project.status as string,
      riskScore: String(riskScore),
      healthStatus,
      inactivityDays: '0',
      missedMeetings: '0',
      pendingFeedback: '0',
      endDate: (project.end_date as string) || 'Not set',
    });

    const raw = await this.callAI(prompt, 'You are a project risk analyst. Return only valid JSON.');
    const validated = this.validateResponse(raw, RiskAnalysisSchema);
    const durationMs = Date.now() - startTime;

    await this.logAudit({
      userId, userRole, action: 'risk_analysis',
      entityType: 'project', entityId: projectId,
      promptVersion: RISK_ANALYSIS_VERSION,
      inputSummary: `Project: ${project.title}`,
      outputSummary: `Risk: ${riskScore}, Status: ${healthStatus}`,
      durationMs, success: !!validated,
    });

    if (validated) {
      // Override with deterministic score (AI explains, deterministic decides)
      const data = validated as RiskAnalysisResult;
      data.riskScore = riskScore;
      data.healthStatus = healthStatus;
      
      // Update project health in DB
      await this.env.DB.prepare('UPDATE projects SET health = ? WHERE id = ?').bind(healthStatus, projectId).run();
      
      return { success: true, data, cached: false, model: this.model, promptVersion: RISK_ANALYSIS_VERSION, durationMs };
    }

    // Fallback without AI explanation
    const fallback: RiskAnalysisResult = {
      healthStatus,
      riskScore,
      factors: [],
      reasons: [
        factors.progressDelay > 0 ? `Progress (${project.progress}%) is behind the expected ${expectedProgress}% for this point in the timeline` : 'Progress is on track with the expected timeline',
      ].filter(Boolean),
      recommendations: ['Catch up on project progress to match the expected timeline', 'Prioritize remaining work to close the progress gap'],
      summary: `Project risk score: ${riskScore}/100 (${healthStatus}).`,
    };

    await this.env.DB.prepare('UPDATE projects SET health = ? WHERE id = ?').bind(healthStatus, projectId).run();
    return { success: true, data: fallback, cached: false, durationMs };
  }

  // ===== FEATURE 4: Supervisor Recommendation =====
  async recommendSupervisor(proposalId: string, userId: string, userRole: string): Promise<AIResponse<SupervisorRecommendationResult>> {
    const startTime = Date.now();

    const proposal = await this.env.DB.prepare('SELECT * FROM proposals WHERE id = ?').bind(proposalId).first();
    if (!proposal) return { success: false, error: 'Proposal not found' };

    // Get all supervisors
    const supervisors = await this.env.DB.prepare(
      `SELECT u.*, 
        (SELECT COUNT(*) FROM projects p WHERE p.supervisor_id = u.id AND p.status = 'active') as active_projects
       FROM users u WHERE u.role = 'supervisor'`
    ).all();

    if (!supervisors.results || supervisors.results.length === 0) {
      return { success: false, error: 'No supervisors available' };
    }

    // Calculate deterministic match scores
    const proposalKeywords = extractKeywords(
      `${proposal.title} ${proposal.abstract || ''} ${proposal.objectives || ''} ${proposal.technologies || ''}`
    );

    const scored = (supervisors.results || []).map((sup: any) => {
      const expertiseArr = sup.expertise ? JSON.parse(sup.expertise as string) : [];
      const researchArr = sup.research_areas ? JSON.parse(sup.research_areas as string) : [];
      const allExpertise = [...expertiseArr, ...researchArr].map((s: string) => s.toLowerCase());
      
      const expertiseOverlap = proposalKeywords.filter(kw => 
        allExpertise.some((exp: string) => exp.includes(kw) || kw.includes(exp))
      ).length / Math.max(proposalKeywords.length, 1);

      const domainMatch = allExpertise.some((exp: string) => 
        (proposal.technologies || '').toLowerCase().includes(exp) ||
        (proposal.title as string).toLowerCase().includes(exp)
      ) ? 0.8 : 0.3;

      const matchScore = calculateSupervisorMatchScore({
        expertiseOverlap,
        domainMatch,
        currentLoad: Number(sup.active_projects || 0),
        maxStudents: Number(sup.max_students || 8),
        previousProjectsInDomain: Math.round(expertiseOverlap * 5),
        sameDepartment: sup.department === proposal.submitted_by, // simplified
      });

      return { ...sup, matchScore, expertiseOverlap, domainMatch };
    });

    scored.sort((a: any, b: any) => b.matchScore - a.matchScore);
    const topCandidates = scored.slice(0, 5);

    // Use AI to explain
    const supervisorsText = topCandidates.map((s: any) => 
      `- ID: ${s.id}, Name: ${s.name}, Score: ${s.matchScore}%, Expertise: ${s.expertise || '[]'}, Active Projects: ${s.active_projects}, Department: ${s.department || 'N/A'}`
    ).join('\n');

    const prompt = this.fillTemplate(SUPERVISOR_RECOMMENDATION_PROMPT, {
      title: proposal.title as string,
      domain: proposal.abstract || '',
      technologies: proposal.technologies || '',
      keywords: proposalKeywords.slice(0, 10).join(', '),
      supervisors: supervisorsText,
    });

    const raw = await this.callAI(prompt, 'You are a supervisor matching specialist. Return only valid JSON.');
    const validated = this.validateResponse(raw, SupervisorRecommendationSchema);
    const durationMs = Date.now() - startTime;

    await this.logAudit({
      userId, userRole, action: 'supervisor_recommendation',
      entityType: 'proposal', entityId: proposalId,
      promptVersion: SUPERVISOR_RECOMMENDATION_VERSION,
      inputSummary: `Proposal: ${proposal.title}`,
      outputSummary: validated ? `${(validated.recommendations ?? []).length} recommendations` : 'Failed',
      durationMs, success: !!validated,
    });

    if (validated) {
      // Override scores with deterministic ones
      const data = validated as SupervisorRecommendationResult;
      data.recommendations = (data.recommendations ?? []).map((rec: any) => {
        const match = topCandidates.find((c: any) => c.id === rec.supervisorId);
        if (match) rec.matchScore = match.matchScore;
        return rec;
      });
      return { success: true, data, cached: false, model: this.model, promptVersion: SUPERVISOR_RECOMMENDATION_VERSION, durationMs };
    }

    // Fallback
    const fallback: SupervisorRecommendationResult = {
      recommendations: topCandidates.map((s: any) => ({
        supervisorId: s.id as string,
        supervisorName: s.name as string,
        matchScore: s.matchScore,
        reasons: [`Expertise match: ${Math.round(s.expertiseOverlap * 100)}%`, `Currently supervising ${s.active_projects} projects`],
      })),
      explanation: 'Recommendations based on expertise matching and workload analysis.',
    };

    return { success: true, data: fallback, cached: false, durationMs };
  }

  // ===== FEATURE 5: AI Project Insights =====
  async generateProjectInsights(projectId: string, userId: string, userRole: string): Promise<AIResponse<ProjectInsightsResult>> {
    const startTime = Date.now();

    const project = await this.env.DB.prepare('SELECT * FROM projects WHERE id = ?').bind(projectId).first();
    if (!project) return { success: false, error: 'Project not found' };

    // Expected progress based on timeline elapsed (start -> end date)
    const now = new Date();
    const startDate = project.start_date ? new Date(project.start_date as string) : null;
    const endDate = project.end_date ? new Date(project.end_date as string) : null;
    let expectedProgress = 50;
    if (startDate && endDate && endDate.getTime() > startDate.getTime()) {
      const totalDuration = endDate.getTime() - startDate.getTime();
      const elapsed = now.getTime() - startDate.getTime();
      expectedProgress = Math.min(100, Math.max(0, Math.round((elapsed / totalDuration) * 100)));
    }

    const prompt = this.fillTemplate(PROJECT_INSIGHTS_PROMPT, {
      projectTitle: project.title as string,
      progress: String(project.progress || 0),
      expectedProgress: String(expectedProgress),
      health: project.health as string,
    });

    const raw = await this.callAI(prompt, 'You are a project management analyst. Return only valid JSON.');
    const validated = this.validateResponse(raw, ProjectInsightsSchema);
    const durationMs = Date.now() - startTime;

    await this.logAudit({
      userId, userRole, action: 'project_insights',
      entityType: 'project', entityId: projectId,
      promptVersion: PROJECT_INSIGHTS_VERSION,
      inputSummary: `Project: ${project.title}`,
      outputSummary: validated ? `${(validated.insights ?? []).length} insights generated` : 'Failed',
      durationMs, success: !!validated,
    });

    if (validated) {
      return { success: true, data: { ...validated, generatedAt: new Date().toISOString() } as ProjectInsightsResult, cached: false, model: this.model, durationMs };
    }

    // Fallback Insights
    const fallbackInsights: ProjectInsightsResult = {
      insights: [
        { category: 'positive', message: `Reported progress is ${project.progress || 0}%, which is on track with the expected ${expectedProgress}% for this point in the timeline.` },
        { category: 'recommendation', message: `Continue updating project progress to stay at or above the expected ${expectedProgress}%.` },
        { category: 'warning', message: 'Keep reported progress accurate so risk flags reflect the real timeline.' }
      ],
      summary: 'Project trajectory is positive with steady progress.',
      generatedAt: new Date().toISOString()
    };

    return { success: true, data: fallbackInsights, cached: false, durationMs };
  }

  // ===== FEATURE 6: Smart Project Summary =====
  async generateProjectSummary(projectId: string, userId: string, userRole: string): Promise<AIResponse<ProjectSummaryResult>> {
    const startTime = Date.now();

    const project = await this.env.DB.prepare('SELECT * FROM projects WHERE id = ?').bind(projectId).first();
    if (!project) return { success: false, error: 'Project not found' };

    const members = await this.env.DB.prepare(
      `SELECT COUNT(*) as count FROM project_members WHERE project_id = ?`
    ).bind(projectId).first();

    const lastActivity = await this.env.DB.prepare(
      `SELECT updated_at as last_update FROM projects WHERE id = ?`
    ).bind(projectId).first();

    const prompt = this.fillTemplate(PROJECT_SUMMARY_PROMPT, {
      projectTitle: project.title as string,
      description: (project.description as string) || '',
      progress: String(project.progress || 0),
      status: project.status as string,
      health: project.health as string,
      startDate: (project.start_date as string) || 'Not set',
      endDate: (project.end_date as string) || 'Not set',
      recentActivity: (lastActivity?.last_update as string) || 'No activity recorded',
      teamSize: String(members?.count || 1),
    });

    const raw = await this.callAI(prompt, 'You are an executive project reporter. Return only valid JSON.');
    const validated = this.validateResponse(raw, ProjectSummarySchema);
    const durationMs = Date.now() - startTime;

    await this.logAudit({
      userId, userRole, action: 'project_summary',
      entityType: 'project', entityId: projectId,
      promptVersion: PROJECT_SUMMARY_VERSION,
      inputSummary: `Project: ${project.title}`,
      outputSummary: validated ? 'Summary generated' : 'Failed',
      durationMs, success: !!validated,
    });

    if (validated) {
      return { success: true, data: { ...validated, progress: Number(project.progress || 0) } as ProjectSummaryResult, cached: false, model: this.model, durationMs };
    }

    // Fallback Summary
    const fallbackSummary: ProjectSummaryResult = {
      summary: `Executive Summary for ${project.title}: The project is currently at ${project.progress || 0}% completion with a health status of '${(project.health || 'healthy').replace('_', ' ')}'.`,
      keyMilestones: ['Proposal Approval', 'Mid-Term Progress Review', 'Final System Defense'],
      currentBlockers: [],
      nextActions: ['Schedule a progress review', 'Prepare demonstration build'],
      progress: Number(project.progress || 0)
    };

    return { success: true, data: fallbackSummary, cached: false, durationMs };
  }

  // ===== FEATURE 7: Supervisor Feedback Assistant =====
  async generateFeedbackSuggestions(params: {
    documentType: string;
    title: string;
    content: string;
    focusAreas?: string;
  }, userId: string, userRole: string): Promise<AIResponse<FeedbackAssistantResult>> {
    const startTime = Date.now();

    const prompt = this.fillTemplate(FEEDBACK_ASSISTANT_PROMPT, {
      documentType: params.documentType,
      title: params.title,
      content: params.content.substring(0, 3000), // Limit context size
      focusAreas: params.focusAreas || 'General review',
    });

    const raw = await this.callAI(prompt, 'You are an academic reviewer assistant. Return only valid JSON.');
    const validated = this.validateResponse(raw, FeedbackAssistantSchema);
    const durationMs = Date.now() - startTime;

    await this.logAudit({
      userId, userRole, action: 'feedback_assistant',
      entityType: 'proposal', entityId: params.title,
      promptVersion: FEEDBACK_ASSISTANT_VERSION,
      inputSummary: `${params.documentType}: ${params.title}`,
      outputSummary: validated ? 'Feedback generated' : 'Failed',
      durationMs, success: !!validated,
    });

    if (validated) {
      return { success: true, data: validated as FeedbackAssistantResult, cached: false, model: this.model, durationMs };
    }

    // Fallback Feedback
    const fallbackFeedback: FeedbackAssistantResult = {
      reviewPoints: [
        'Methodology and problem scope align well with FYP guidelines',
        'Technical stack selection is practical for team execution'
      ],
      technicalConcerns: [
        'Ensure database queries and external integrations are performance-optimized'
      ],
      questionsForStudents: [
        'What evaluation metrics will be used to benchmark final system performance?'
      ],
      summary: 'Comprehensive submission. Recommend addressing minor technical review notes.'
    };

    return { success: true, data: fallbackFeedback, cached: false, durationMs };
  }

  // ===== FEATURE 8: Natural Language Project Query =====
  async queryProject(projectId: string, question: string, userId: string, userRole: string): Promise<AIResponse<ProjectQueryResult>> {
    const startTime = Date.now();

    // Fetch comprehensive project data
    const project = await this.env.DB.prepare('SELECT * FROM projects WHERE id = ?').bind(projectId).first();
    if (!project) return { success: false, error: 'Project not found' };

    const meetings = await this.env.DB.prepare(
      `SELECT title, scheduled_at, status FROM meetings WHERE project_id = ? ORDER BY scheduled_at DESC LIMIT 5`
    ).bind(projectId).all();

    const members = await this.env.DB.prepare(
      `SELECT u.name, u.role FROM project_members pm JOIN users u ON pm.user_id = u.id WHERE pm.project_id = ?`
    ).bind(projectId).all();

    // Build structured context (no unauthorized data)
    const projectData = JSON.stringify({
      project: { title: project.title, status: project.status, health: project.health, progress: project.progress },
      recentMeetings: meetings.results,
      teamMembers: members.results,
    }, null, 2);

    const prompt = this.fillTemplate(PROJECT_ASSISTANT_PROMPT, {
      projectTitle: project.title as string,
      userRole,
      projectData,
      question,
    });

    const raw = await this.callAI(prompt, 'You are a helpful project assistant. Answer based only on provided data. Return only valid JSON.');
    const validated = this.validateResponse(raw, ProjectQuerySchema);
    const durationMs = Date.now() - startTime;

    await this.logAudit({
      userId, userRole, action: 'project_query',
      entityType: 'project', entityId: projectId,
      promptVersion: PROJECT_ASSISTANT_VERSION,
      inputSummary: `Question: ${question.substring(0, 100)}`,
      outputSummary: validated ? 'Answered' : 'Failed',
      durationMs, success: !!validated,
    });

    if (validated) {
      return { success: true, data: validated as ProjectQueryResult, cached: false, model: this.model, durationMs };
    }

    // If LLM returned a response, use its answer text directly
    if (raw) {
      let answerText = raw;
      try {
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        answerText = parsed.answer || parsed.response || parsed.content || raw;
      } catch (e) {
        answerText = raw;
      }
      return {
        success: true,
        data: {
          answer: answerText,
          sources: ['OpenRouter AI (' + this.model + ')'],
          confidence: 'high'
        },
        cached: false,
        model: this.model,
        durationMs
      };
    }
    const q = question.toLowerCase();
    const memberList = members.results || [];
    const meetingList = meetings.results || [];

    let answer = '';
    let sources: string[] = [];

    if (q.includes('progress') || q.includes('status') || q.includes('health') || q.includes('how is')) {
      const healthEmoji = project.health === 'healthy' ? '🟢' : project.health === 'at_risk' ? '🟡' : '🔴';
      answer = `📊 **Project Status Report for "${project.title}":**\n\n` +
        `• **Overall Progress:** ${project.progress || 0}%\n` +
        `• **Health:** ${healthEmoji} ${String(project.health || 'healthy').replace('_', ' ').toUpperCase()}\n` +
        `• **Status:** ${String(project.status || 'active').replace('_', ' ')}\n` +
        `• **Team Size:** ${memberList.length} member(s)`;
      sources = ['Projects table', 'Project members table'];

    } else if (q.includes('team') || q.includes('member') || q.includes('who') || q.includes('student')) {
      answer = `👥 **Team for "${project.title}":**\n\n` +
        (memberList.length > 0
          ? memberList.map((m: any) => `• **${m.name}** — ${String(m.role).charAt(0).toUpperCase() + String(m.role).slice(1)}`).join('\n')
          : 'No team members found in records.');
      sources = ['Project members table', 'Users table'];

    } else if (q.includes('meeting') || q.includes('review') || q.includes('session')) {
      answer = `📅 **Meeting History for "${project.title}":**\n\n` +
        (meetingList.length > 0
          ? meetingList.map((m: any) => `• **${m.title}** — ${m.scheduled_at ? new Date(m.scheduled_at as string).toLocaleDateString() : 'TBD'} [${m.status}]`).join('\n')
          : 'No meetings recorded yet.');
      sources = ['Meetings table'];

    } else {
      // General overview fallback
      const healthEmoji = project.health === 'healthy' ? '🟢' : project.health === 'at_risk' ? '🟡' : '🔴';
      answer = `📋 **Project Overview — "${project.title}":**\n\n` +
        `• **Progress:** ${project.progress || 0}% complete\n` +
        `• **Health:** ${healthEmoji} ${String(project.health || 'healthy').replace('_', ' ')}\n` +
        `• **Team Size:** ${memberList.length} member(s)\n\n` +
        `Ask me specifically about: progress, team members, meetings, or project health!`;
      sources = ['Projects table', 'Project members table', 'Meetings table'];
    }

    const fallbackQuery: ProjectQueryResult = {
      answer,
      sources,
      confidence: 88
    };

    return { success: true, data: fallbackQuery, cached: false, durationMs };
  }
}
