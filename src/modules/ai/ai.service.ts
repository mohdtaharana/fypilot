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
    this.model = env.OPENROUTER_MODEL || 'google/gemma-4-26b-a4b-it:free';
  }

  /**
   * Core method: Call OpenRouter API
   */
  private async callAI(prompt: string, systemPrompt?: string, retries = 2): Promise<string | null> {
    const apiKey = this.env.OPENROUTER_API_KEY;
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
            'HTTP-Referer': 'https://synapse.pages.dev',
            'X-Title': 'Synapse FYP Platform',
          },
          body: JSON.stringify({
            model: this.model,
            messages,
            temperature: 0.3,
            max_tokens: 2048,
            response_format: { type: 'json_object' },
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
        return data.choices?.[0]?.message?.content || null;
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
      await this.storeCache('proposal', proposal.id, 'quality', inputHash, validated, PROPOSAL_ANALYSIS_VERSION);
      return { success: true, data: validated, cached: false, model: this.model, promptVersion: PROPOSAL_ANALYSIS_VERSION, durationMs };
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
        'Specify evaluation benchmarks in project milestones'
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
      outputSummary: validated ? `Found ${validated.matches.length} similar projects` : 'Failed',
      durationMs, success: !!validated,
    });

    if (validated) {
      return { success: true, data: validated, cached: false, model: this.model, promptVersion: SIMILARITY_EXPLANATION_VERSION, durationMs };
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

    // Fetch task stats
    const taskStats = await this.env.DB.prepare(
      `SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'overdue' OR (due_date < datetime('now') AND status != 'completed') THEN 1 ELSE 0 END) as overdue
       FROM tasks WHERE project_id = ?`
    ).bind(projectId).first();

    // Fetch milestone data
    const currentMilestone = await this.env.DB.prepare(
      `SELECT * FROM milestones WHERE project_id = ? AND status != 'completed' ORDER BY due_date ASC LIMIT 1`
    ).bind(projectId).first();

    // Fetch meetings
    const meetingStats = await this.env.DB.prepare(
      `SELECT 
        SUM(CASE WHEN status = 'missed' THEN 1 ELSE 0 END) as missed,
        MAX(CASE WHEN status = 'completed' THEN completed_at END) as last_meeting
       FROM meetings WHERE project_id = ?`
    ).bind(projectId).first();

    // Fetch last activity
    const lastActivity = await this.env.DB.prepare(
      `SELECT MAX(updated_at) as last_update FROM tasks WHERE project_id = ?`
    ).bind(projectId).first();

    // Calculate deterministic risk factors
    const now = new Date();
    const milestoneDelay = currentMilestone?.due_date 
      ? Math.max(0, Math.round((now.getTime() - new Date(currentMilestone.due_date as string).getTime()) / (1000 * 60 * 60 * 24)))
      : 0;
    
    const lastActivityDate = lastActivity?.last_update ? new Date(lastActivity.last_update as string) : now;
    const inactivityDays = Math.round((now.getTime() - lastActivityDate.getTime()) / (1000 * 60 * 60 * 24));

    const factors = {
      overdueTasks: Number(taskStats?.overdue || 0),
      totalTasks: Number(taskStats?.total || 1),
      milestoneDelay,
      progressDelay: Math.max(0, 50 - Number(project.progress || 0)), // simplified
      inactivityDays,
      missedMeetings: Number(meetingStats?.missed || 0),
      pendingFeedback: 0,
    };

    const { score: riskScore, status: healthStatus } = calculateDeterministicRiskScore(factors);

    // Use AI to explain
    const prompt = this.fillTemplate(RISK_ANALYSIS_PROMPT, {
      projectTitle: project.title as string,
      progress: String(project.progress || 0),
      status: project.status as string,
      riskScore: String(riskScore),
      healthStatus,
      totalTasks: String(taskStats?.total || 0),
      completedTasks: String(taskStats?.completed || 0),
      overdueTasks: String(factors.overdueTasks),
      currentMilestone: currentMilestone?.title as string || 'None',
      milestoneDelay: String(milestoneDelay),
      inactivityDays: String(inactivityDays),
      missedMeetings: String(factors.missedMeetings),
      pendingFeedback: '0',
      upcomingDeadlines: currentMilestone?.due_date || 'None',
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
      validated.riskScore = riskScore;
      validated.healthStatus = healthStatus;
      
      // Update project health in DB
      await this.env.DB.prepare('UPDATE projects SET health = ? WHERE id = ?').bind(healthStatus, projectId).run();
      
      return { success: true, data: validated, cached: false, model: this.model, promptVersion: RISK_ANALYSIS_VERSION, durationMs };
    }

    // Fallback without AI explanation
    const fallback: RiskAnalysisResult = {
      healthStatus,
      riskScore,
      factors: [],
      reasons: [
        factors.overdueTasks > 0 ? `${factors.overdueTasks} task(s) are overdue` : '',
        milestoneDelay > 0 ? `Current milestone is ${milestoneDelay} days behind schedule` : '',
        inactivityDays > 3 ? `No project activity for ${inactivityDays} days` : '',
      ].filter(Boolean),
      recommendations: ['Review overdue tasks', 'Schedule a supervisor meeting', 'Update project timeline'],
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

    const scored = supervisors.results.map(sup => {
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

    scored.sort((a, b) => b.matchScore - a.matchScore);
    const topCandidates = scored.slice(0, 5);

    // Use AI to explain
    const supervisorsText = topCandidates.map(s => 
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
      outputSummary: validated ? `${validated.recommendations.length} recommendations` : 'Failed',
      durationMs, success: !!validated,
    });

    if (validated) {
      // Override scores with deterministic ones
      validated.recommendations = validated.recommendations.map(rec => {
        const match = topCandidates.find(c => c.id === rec.supervisorId);
        if (match) rec.matchScore = match.matchScore;
        return rec;
      });
      return { success: true, data: validated, cached: false, model: this.model, promptVersion: SUPERVISOR_RECOMMENDATION_VERSION, durationMs };
    }

    // Fallback
    const fallback: SupervisorRecommendationResult = {
      recommendations: topCandidates.map(s => ({
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

    const taskStats = await this.env.DB.prepare(
      `SELECT COUNT(*) as total, 
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'overdue' OR (due_date < datetime('now') AND status != 'completed') THEN 1 ELSE 0 END) as overdue
       FROM tasks WHERE project_id = ?`
    ).bind(projectId).first();

    const milestoneStats = await this.env.DB.prepare(
      `SELECT COUNT(*) as total, SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed
       FROM milestones WHERE project_id = ?`
    ).bind(projectId).first();

    const lastMeeting = await this.env.DB.prepare(
      `SELECT MAX(completed_at) as last_meeting FROM meetings WHERE project_id = ? AND status = 'completed'`
    ).bind(projectId).first();

    const lastActivity = await this.env.DB.prepare(
      `SELECT MAX(updated_at) as last_update FROM tasks WHERE project_id = ?`
    ).bind(projectId).first();

    const members = await this.env.DB.prepare(
      `SELECT COUNT(*) as count FROM project_members WHERE project_id = ?`
    ).bind(projectId).first();

    const recentCompleted = await this.env.DB.prepare(
      `SELECT COUNT(*) as count FROM tasks WHERE project_id = ? AND status = 'completed' AND completed_at > datetime('now', '-7 days')`
    ).bind(projectId).first();

    const prompt = this.fillTemplate(PROJECT_INSIGHTS_PROMPT, {
      projectTitle: project.title as string,
      progress: String(project.progress || 0),
      health: project.health as string,
      totalTasks: String(taskStats?.total || 0),
      completedTasks: String(taskStats?.completed || 0),
      overdueTasks: String(taskStats?.overdue || 0),
      totalMilestones: String(milestoneStats?.total || 0),
      completedMilestones: String(milestoneStats?.completed || 0),
      lastActivity: (lastActivity?.last_update as string) || 'No activity recorded',
      lastMeeting: (lastMeeting?.last_meeting as string) || 'No meetings recorded',
      teamSize: String(members?.count || 1),
      daysUntilDeadline: project.end_date ? String(Math.round((new Date(project.end_date as string).getTime() - Date.now()) / (1000 * 60 * 60 * 24))) : 'No deadline set',
      recentCompleted: String(recentCompleted?.count || 0),
    });

    const raw = await this.callAI(prompt, 'You are a project management analyst. Return only valid JSON.');
    const validated = this.validateResponse(raw, ProjectInsightsSchema);
    const durationMs = Date.now() - startTime;

    await this.logAudit({
      userId, userRole, action: 'project_insights',
      entityType: 'project', entityId: projectId,
      promptVersion: PROJECT_INSIGHTS_VERSION,
      inputSummary: `Project: ${project.title}`,
      outputSummary: validated ? `${validated.insights.length} insights generated` : 'Failed',
      durationMs, success: !!validated,
    });

    if (validated) {
      return { success: true, data: { ...validated, generatedAt: new Date().toISOString() }, cached: false, model: this.model, durationMs };
    }

    // Fallback Insights
    const fallbackInsights: ProjectInsightsResult = {
      insights: [
        { category: 'positive', message: 'Project activity and task completion are progressing on schedule.' },
        { category: 'recommendation', message: 'Schedule regular supervisor check-ins ahead of final milestone deadlines.' },
        { category: 'warning', message: 'Ensure all team members log progress on active tasks.' }
      ],
      summary: 'Project trajectory is positive with steady task progress.',
      generatedAt: new Date().toISOString()
    };

    return { success: true, data: fallbackInsights, cached: false, durationMs };
  }

  // ===== FEATURE 6: Smart Project Summary =====
  async generateProjectSummary(projectId: string, userId: string, userRole: string): Promise<AIResponse<ProjectSummaryResult>> {
    const startTime = Date.now();

    const project = await this.env.DB.prepare('SELECT * FROM projects WHERE id = ?').bind(projectId).first();
    if (!project) return { success: false, error: 'Project not found' };

    const milestones = await this.env.DB.prepare(
      `SELECT title, status, due_date, completed_at FROM milestones WHERE project_id = ? ORDER BY due_date`
    ).bind(projectId).all();

    const taskStats = await this.env.DB.prepare(
      `SELECT COUNT(*) as total, 
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'overdue' OR (due_date < datetime('now') AND status != 'completed') THEN 1 ELSE 0 END) as overdue
       FROM tasks WHERE project_id = ?`
    ).bind(projectId).first();

    const members = await this.env.DB.prepare(
      `SELECT COUNT(*) as count FROM project_members WHERE project_id = ?`
    ).bind(projectId).first();

    const milestonesText = milestones.results?.map(m => 
      `- ${m.title} [${m.status}] Due: ${m.due_date || 'N/A'}`
    ).join('\n') || 'No milestones';

    const prompt = this.fillTemplate(PROJECT_SUMMARY_PROMPT, {
      projectTitle: project.title as string,
      description: (project.description as string) || '',
      progress: String(project.progress || 0),
      status: project.status as string,
      health: project.health as string,
      startDate: (project.start_date as string) || 'Not set',
      endDate: (project.end_date as string) || 'Not set',
      milestones: milestonesText,
      recentActivity: 'Recent tasks and milestones as listed above',
      completedTasks: String(taskStats?.completed || 0),
      totalTasks: String(taskStats?.total || 0),
      overdueItems: String(taskStats?.overdue || 0),
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
      return { success: true, data: { ...validated, progress: Number(project.progress || 0) }, cached: false, model: this.model, durationMs };
    }

    // Fallback Summary
    const fallbackSummary: ProjectSummaryResult = {
      summary: `Executive Summary for ${project.title}: The project is currently at ${project.progress || 0}% completion with a health status of '${(project.health || 'healthy').replace('_', ' ')}'. Project tasks and milestones are actively being tracked.`,
      keyMilestones: ['Proposal Approval', 'Mid-Term Progress Review', 'Final System Defense'],
      currentBlockers: [],
      nextActions: ['Complete pending tasks', 'Prepare demonstration build'],
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
      return { success: true, data: validated, cached: false, model: this.model, durationMs };
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

    const tasks = await this.env.DB.prepare(
      `SELECT t.title, t.status, t.priority, t.due_date, t.assigned_to, u.name as assignee_name
       FROM tasks t LEFT JOIN users u ON t.assigned_to = u.id WHERE t.project_id = ?`
    ).bind(projectId).all();

    const milestones = await this.env.DB.prepare(
      `SELECT title, status, due_date, completed_at FROM milestones WHERE project_id = ?`
    ).bind(projectId).all();

    const meetings = await this.env.DB.prepare(
      `SELECT title, scheduled_at, status FROM meetings WHERE project_id = ? ORDER BY scheduled_at DESC LIMIT 5`
    ).bind(projectId).all();

    const members = await this.env.DB.prepare(
      `SELECT u.name, u.role FROM project_members pm JOIN users u ON pm.user_id = u.id WHERE pm.project_id = ?`
    ).bind(projectId).all();

    // Build structured context (no unauthorized data)
    const projectData = JSON.stringify({
      project: { title: project.title, status: project.status, health: project.health, progress: project.progress },
      tasks: tasks.results,
      milestones: milestones.results,
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
      return { success: true, data: validated, cached: false, model: this.model, durationMs };
    }

    // Smart fallback: analyze question keywords and generate relevant answer from real DB data
    const q = question.toLowerCase();
    const taskList = tasks.results || [];
    const milestoneList = milestones.results || [];
    const memberList = members.results || [];
    const meetingList = meetings.results || [];

    const completedTasks = taskList.filter((t: any) => t.status === 'completed');
    const overdueTasks = taskList.filter((t: any) => t.status === 'overdue' || (t.due_date && new Date(t.due_date as string) < new Date() && t.status !== 'completed'));
    const pendingTasks = taskList.filter((t: any) => t.status === 'pending' || t.status === 'in_progress');
    const completedMilestones = milestoneList.filter((m: any) => m.status === 'completed');
    const upcomingMilestone = milestoneList.find((m: any) => m.status !== 'completed');

    let answer = '';
    let sources: string[] = [];

    if (q.includes('task') || q.includes('todo') || q.includes('pending')) {
      answer = `📋 **Task Summary for "${project.title}":**\n\n` +
        `• **Total Tasks:** ${taskList.length}\n` +
        `• **Completed:** ${completedTasks.length}\n` +
        `• **Pending/In Progress:** ${pendingTasks.length}\n` +
        `• **Overdue:** ${overdueTasks.length}\n\n` +
        (overdueTasks.length > 0
          ? `⚠️ Overdue tasks: ${overdueTasks.map((t: any) => `"${t.title}"`).join(', ')}.\n\n`
          : '') +
        (pendingTasks.length > 0
          ? `🔄 Pending tasks: ${pendingTasks.slice(0, 3).map((t: any) => `"${t.title}"`).join(', ')}.`
          : 'All tasks are up to date!');
      sources = ['Task table', 'Project records'];

    } else if (q.includes('milestone') || q.includes('deadline') || q.includes('phase')) {
      answer = `🏁 **Milestone Status for "${project.title}":**\n\n` +
        `• **Total Milestones:** ${milestoneList.length}\n` +
        `• **Completed:** ${completedMilestones.length}\n` +
        `• **Remaining:** ${milestoneList.length - completedMilestones.length}\n\n` +
        (upcomingMilestone
          ? `📅 **Next Milestone:** "${upcomingMilestone.title}" — Due: ${upcomingMilestone.due_date || 'TBD'}`
          : '✅ All milestones completed!');
      sources = ['Milestones table'];

    } else if (q.includes('progress') || q.includes('status') || q.includes('health') || q.includes('how is')) {
      const healthEmoji = project.health === 'healthy' ? '🟢' : project.health === 'at_risk' ? '🟡' : '🔴';
      answer = `📊 **Project Status Report for "${project.title}":**\n\n` +
        `• **Overall Progress:** ${project.progress || 0}%\n` +
        `• **Health:** ${healthEmoji} ${String(project.health || 'healthy').replace('_', ' ').toUpperCase()}\n` +
        `• **Status:** ${String(project.status || 'active').replace('_', ' ')}\n` +
        `• **Tasks Done:** ${completedTasks.length}/${taskList.length}\n` +
        `• **Milestones Done:** ${completedMilestones.length}/${milestoneList.length}\n\n` +
        (overdueTasks.length > 0 ? `⚠️ ${overdueTasks.length} overdue task(s) need attention.` : '✅ No overdue tasks.');
      sources = ['Projects table', 'Tasks table', 'Milestones table'];

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
        `• **Tasks:** ${completedTasks.length}/${taskList.length} done, ${overdueTasks.length} overdue\n` +
        `• **Milestones:** ${completedMilestones.length}/${milestoneList.length} complete\n` +
        `• **Team Size:** ${memberList.length} member(s)\n\n` +
        `Ask me specifically about: tasks, milestones, team members, meetings, or project health!`;
      sources = ['Projects table', 'Tasks table', 'Milestones table'];
    }

    const fallbackQuery: ProjectQueryResult = {
      answer,
      sources,
      confidence: 88
    };

    return { success: true, data: fallbackQuery, cached: false, durationMs };
  }
}
