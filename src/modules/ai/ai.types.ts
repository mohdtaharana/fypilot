// Synapse AI Module - Type Definitions

export interface Env {
  DB: D1Database;
  OPENROUTER_API_KEY: string;
  OPENROUTER_MODEL: string;
}

// AI Service Types
export interface AIRequestOptions {
  prompt: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  retries?: number;
}

export interface AIResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  cached?: boolean;
  model?: string;
  promptVersion?: string;
  durationMs?: number;
}

// Proposal Analysis Types
export interface ProposalAnalysisResult {
  overallScore: number;
  problemClarity: number;
  objectives: number;
  methodology: number;
  technicalFeasibility: number;
  scope: number;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  summary?: string;
}

// Similarity Analysis Types
export interface SimilarityMatch {
  projectId: string;
  projectTitle: string;
  similarityScore: number;
  overlappingConcepts: string[];
  explanation: string;
}

export interface SimilarityAnalysisResult {
  matches: SimilarityMatch[];
  summary: string;
}

// Risk Analysis Types
export interface RiskAnalysisResult {
  healthStatus: 'healthy' | 'at_risk' | 'critical';
  riskScore: number;
  factors?: RiskFactor[];
  reasons: string[];
  recommendations: string[];
  summary: string;
}

export interface RiskFactor {
  name: string;
  score: number;
  weight: number;
  description: string;
}

// Supervisor Recommendation Types
export interface SupervisorRecommendation {
  supervisorId: string;
  supervisorName: string;
  matchScore: number;
  reasons: string[];
  expertiseMatch?: number;
  domainMatch?: number;
  workloadScore?: number;
  experienceScore?: number;
  departmentScore?: number;
}

export interface SupervisorRecommendationResult {
  recommendations: SupervisorRecommendation[];
  explanation: string;
}

// Project Insights Types
export interface ProjectInsight {
  category: 'positive' | 'warning' | 'critical' | 'recommendation';
  message: string;
  dataPoint?: string;
}

export interface ProjectInsightsResult {
  insights: ProjectInsight[];
  summary?: string;
  generatedAt: string;
}

// Project Summary Types
export interface ProjectSummaryResult {
  currentState?: string;
  progress: number;
  majorAchievements?: string[];
  majorRisks?: string[];
  keyMilestones?: string[];
  currentBlockers?: string[];
  nextActions: string[];
  summary: string;
}

// Feedback Assistant Types
export interface FeedbackSuggestion {
  category: string;
  suggestion: string;
  priority: 'high' | 'medium' | 'low';
}

export interface FeedbackAssistantResult {
  reviewPoints: string[];
  missingSections?: string[];
  clarityImprovements?: string[];
  technicalConcerns?: string[];
  scopeConcerns?: string[];
  questionsForStudents?: string[];
  summary?: string;
}

// Project Query Types
export interface ProjectQueryResult {
  answer: string;
  dataUsed?: string[];
  sources?: string[];
  confidence: 'high' | 'medium' | 'low' | number;
}

// Database Model Types
export interface User {
  id: string;
  email: string;
  name: string;
  role: 'student' | 'supervisor' | 'coordinator' | 'admin';
  department?: string;
  expertise?: string;
  research_areas?: string;
  max_students?: number;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
}

export interface Proposal {
  id: string;
  title: string;
  abstract?: string;
  problem_statement?: string;
  objectives?: string;
  methodology?: string;
  expected_outcomes?: string;
  technologies?: string;
  scope?: string;
  status: 'draft' | 'submitted' | 'under_review' | 'approved' | 'rejected' | 'revision_requested';
  submitted_by: string;
  supervisor_id?: string;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  title: string;
  description?: string;
  proposal_id?: string;
  status: 'active' | 'completed' | 'on_hold' | 'cancelled';
  health: 'healthy' | 'at_risk' | 'critical';
  progress: number;
  supervisor_id?: string;
  department?: string;
  start_date?: string;
  end_date?: string;
  created_at: string;
  updated_at: string;
}

export interface Meeting {
  id: string;
  project_id: string;
  title?: string;
  scheduled_at?: string;
  completed_at?: string;
  notes?: string;
  status: 'scheduled' | 'completed' | 'cancelled' | 'missed';
  created_at: string;
}

export interface AIAnalysisCache {
  id: string;
  entity_type: string;
  entity_id: string;
  analysis_type: string;
  result: string;
  model: string;
  prompt_version: string;
  input_hash: string;
  created_at: string;
  expires_at?: string;
}

export interface AIAuditLog {
  id: string;
  user_id: string;
  user_role: string;
  action: string;
  entity_type?: string;
  entity_id?: string;
  model?: string;
  prompt_version?: string;
  input_summary?: string;
  output_summary?: string;
  duration_ms?: number;
  success: number;
  error_message?: string;
  created_at: string;
}
