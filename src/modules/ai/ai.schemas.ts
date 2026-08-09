import { z } from 'zod';

// Proposal Analysis Schema
export const ProposalAnalysisSchema = z.object({
  overallScore: z.coerce.number().default(75),
  problemClarity: z.coerce.number().default(75),
  objectives: z.coerce.number().default(75),
  methodology: z.coerce.number().default(75),
  technicalFeasibility: z.coerce.number().default(75),
  scope: z.coerce.number().default(75),
  strengths: z.array(z.string()).default([]),
  weaknesses: z.array(z.string()).default([]),
  recommendations: z.array(z.string()).default([]),
  summary: z.string().default(''),
});

// Similarity Explanation Schema
export const SimilarityExplanationSchema = z.object({
  matches: z.array(z.object({
    projectId: z.string().default(''),
    projectTitle: z.string().default(''),
    similarityScore: z.coerce.number().default(0),
    overlappingConcepts: z.array(z.string()).default([]),
    explanation: z.string().default(''),
  })).default([]),
  summary: z.string().default(''),
});

// Risk Analysis Schema
export const RiskAnalysisSchema = z.object({
  healthStatus: z.enum(['healthy', 'at_risk', 'critical']).default('healthy'),
  riskScore: z.coerce.number().default(20),
  reasons: z.array(z.string()).default([]),
  recommendations: z.array(z.string()).default([]),
  summary: z.string().default(''),
});

// Supervisor Recommendation Schema
export const SupervisorRecommendationSchema = z.object({
  recommendations: z.array(z.object({
    supervisorId: z.string().default(''),
    supervisorName: z.string().default(''),
    matchScore: z.coerce.number().default(80),
    reasons: z.array(z.string()).default([]),
  })).default([]),
  explanation: z.string().default(''),
});

// Project Insights Schema
const insightCategoryEnum = z.enum(['positive', 'warning', 'critical', 'recommendation']);
export const ProjectInsightsSchema = z.object({
  insights: z.array(z.object({
    category: insightCategoryEnum.catch('positive' as const),
    message: z.string(),
  })).default([]),
  summary: z.string().default(''),
});

// Project Summary Schema
export const ProjectSummarySchema = z.object({
  currentState: z.string().default('Active'),
  majorAchievements: z.array(z.string()).default([]),
  majorRisks: z.array(z.string()).default([]),
  keyMilestones: z.array(z.string()).default([]),
  currentBlockers: z.array(z.string()).default([]),
  nextActions: z.array(z.string()).default([]),
  summary: z.string().default(''),
});

// Feedback Assistant Schema
export const FeedbackAssistantSchema = z.object({
  reviewPoints: z.array(z.string()).default([]),
  missingSections: z.array(z.string()).default([]),
  clarityImprovements: z.array(z.string()).default([]),
  technicalConcerns: z.array(z.string()).default([]),
  scopeConcerns: z.array(z.string()).default([]),
  questionsForStudents: z.array(z.string()).default([]),
  summary: z.string().default(''),
});

// Project Query Schema
export const ProjectQuerySchema = z.object({
  answer: z.string(),
  dataUsed: z.array(z.string()).default([]),
  sources: z.array(z.string()).default([]),
  confidence: z.union([z.enum(['high', 'medium', 'low']), z.number()]).default('high'),
});

// Inferred schema output types (guaranteed non-optional because every field has .default())
export type ProposalAnalysisOutput    = z.infer<typeof ProposalAnalysisSchema>;
export type SimilarityOutput          = z.infer<typeof SimilarityExplanationSchema>;
export type RiskAnalysisOutput        = z.infer<typeof RiskAnalysisSchema>;
export type SupervisorRecommOutput    = z.infer<typeof SupervisorRecommendationSchema>;
export type ProjectInsightsOutput     = z.infer<typeof ProjectInsightsSchema>;
export type ProjectSummaryOutput      = z.infer<typeof ProjectSummarySchema>;
export type FeedbackAssistantOutput   = z.infer<typeof FeedbackAssistantSchema>;
export type ProjectQueryOutput        = z.infer<typeof ProjectQuerySchema>;
