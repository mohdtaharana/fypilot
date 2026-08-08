import { z } from 'zod';

// Proposal Analysis Schema
export const ProposalAnalysisSchema = z.object({
  overallScore: z.number().min(0).max(100),
  problemClarity: z.number().min(0).max(100),
  objectives: z.number().min(0).max(100),
  methodology: z.number().min(0).max(100),
  technicalFeasibility: z.number().min(0).max(100),
  scope: z.number().min(0).max(100),
  strengths: z.array(z.string()).min(1).max(10),
  weaknesses: z.array(z.string()).max(10),
  recommendations: z.array(z.string()).min(1).max(10),
});

// Similarity Explanation Schema
export const SimilarityExplanationSchema = z.object({
  matches: z.array(z.object({
    projectId: z.string(),
    projectTitle: z.string(),
    similarityScore: z.number().min(0).max(100),
    overlappingConcepts: z.array(z.string()),
    explanation: z.string(),
  })),
  summary: z.string(),
});

// Risk Analysis Schema
export const RiskAnalysisSchema = z.object({
  healthStatus: z.enum(['healthy', 'at_risk', 'critical']),
  riskScore: z.number().min(0).max(100),
  reasons: z.array(z.string()).min(1),
  recommendations: z.array(z.string()).min(1),
  summary: z.string(),
});

// Supervisor Recommendation Schema
export const SupervisorRecommendationSchema = z.object({
  recommendations: z.array(z.object({
    supervisorId: z.string(),
    supervisorName: z.string(),
    matchScore: z.number().min(0).max(100),
    reasons: z.array(z.string()),
  })),
  explanation: z.string(),
});

// Project Insights Schema
export const ProjectInsightsSchema = z.object({
  insights: z.array(z.object({
    category: z.enum(['positive', 'warning', 'critical', 'recommendation']),
    message: z.string(),
  })),
});

// Project Summary Schema
export const ProjectSummarySchema = z.object({
  currentState: z.string(),
  majorAchievements: z.array(z.string()),
  majorRisks: z.array(z.string()),
  nextActions: z.array(z.string()),
  summary: z.string(),
});

// Feedback Assistant Schema
export const FeedbackAssistantSchema = z.object({
  reviewPoints: z.array(z.string()),
  missingSections: z.array(z.string()),
  clarityImprovements: z.array(z.string()),
  technicalConcerns: z.array(z.string()),
  scopeConcerns: z.array(z.string()),
  questionsForStudents: z.array(z.string()),
});

// Project Query Schema
export const ProjectQuerySchema = z.object({
  answer: z.string(),
  dataUsed: z.array(z.string()),
  confidence: z.enum(['high', 'medium', 'low']),
});
