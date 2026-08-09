// AI Module Utilities

/**
 * Generate a unique ID
 */
export function generateId(): string {
  return crypto.randomUUID();
}

/**
 * Create a hash of input data for cache invalidation
 */
export async function hashInput(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 32);
}

/**
 * Safely parse JSON from AI response
 */
export function safeParseJSON(text: string): unknown | null {
  try {
    // Try direct parse first
    return JSON.parse(text);
  } catch {
    // Try to extract JSON from markdown code blocks
    const jsonMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[1].trim());
      } catch {
        // Continue to next strategy
      }
    }
    
    // Try to find JSON object in the text
    const objectMatch = text.match(/\{[\s\S]*\}/);
    if (objectMatch) {
      try {
        return JSON.parse(objectMatch[0]);
      } catch {
        return null;
      }
    }
    
    return null;
  }
}

/**
 * Calculate TF-IDF based text similarity (deterministic)
 */
export function calculateTextSimilarity(text1: string, text2: string): number {
  const words1 = tokenize(text1);
  const words2 = tokenize(text2);
  
  if (words1.length === 0 || words2.length === 0) return 0;
  
  // Create term frequency maps
  const tf1 = termFrequency(words1);
  const tf2 = termFrequency(words2);
  
  // Get all unique terms
  const allTerms = new Set([...Object.keys(tf1), ...Object.keys(tf2)]);
  
  // Calculate cosine similarity
  let dotProduct = 0;
  let magnitude1 = 0;
  let magnitude2 = 0;
  
  for (const term of allTerms) {
    const w1 = tf1[term] || 0;
    const w2 = tf2[term] || 0;
    dotProduct += w1 * w2;
    magnitude1 += w1 * w1;
    magnitude2 += w2 * w2;
  }
  
  if (magnitude1 === 0 || magnitude2 === 0) return 0;
  
  return dotProduct / (Math.sqrt(magnitude1) * Math.sqrt(magnitude2));
}

/**
 * Extract keywords from text
 */
export function extractKeywords(text: string): string[] {
  const words = tokenize(text);
  const tf = termFrequency(words);
  
  // Sort by frequency and return top keywords
  return Object.entries(tf)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([word]) => word);
}

/**
 * Find overlapping concepts between two texts
 */
export function findOverlappingConcepts(text1: string, text2: string): string[] {
  const keywords1 = new Set(extractKeywords(text1));
  const keywords2 = new Set(extractKeywords(text2));
  
  const overlap: string[] = [];
  for (const kw of keywords1) {
    if (keywords2.has(kw)) {
      overlap.push(kw);
    }
  }
  return overlap.slice(0, 10);
}

/**
 * Deterministic risk score calculation
 */
export function calculateDeterministicRiskScore(factors: {
  progressDelay: number; // percentage behind expected
  inactivityDays: number;
  missedMeetings: number;
  pendingFeedback: number;
}): { score: number; status: 'healthy' | 'at_risk' | 'critical' } {
  let riskScore = 0;
  
  // Progress gap factor — the sole driver of project risk (full range)
  if (factors.progressDelay > 0) {
    riskScore += Math.min(factors.progressDelay * 1.5, 100);
  }
  
  // Inactivity factor (weight: 30)
  if (factors.inactivityDays > 3) {
    riskScore += Math.min((factors.inactivityDays - 3) / 10 * 30, 30);
  }
  
  // Missed meetings factor (weight: 20)
  riskScore += Math.min(factors.missedMeetings * 5, 20);
  
  // Pending feedback factor (weight: 10)
  riskScore += Math.min(factors.pendingFeedback * 2.5, 10);
  
  riskScore = Math.round(Math.min(riskScore, 100));
  
  let status: 'healthy' | 'at_risk' | 'critical';
  if (riskScore >= 70) {
    status = 'critical';
  } else if (riskScore >= 40) {
    status = 'at_risk';
  } else {
    status = 'healthy';
  }
  
  return { score: riskScore, status };
}

/**
 * Calculate supervisor match score (deterministic)
 */
export function calculateSupervisorMatchScore(params: {
  expertiseOverlap: number; // 0-1
  domainMatch: number; // 0-1
  currentLoad: number; // number of current students
  maxStudents: number;
  previousProjectsInDomain: number;
  sameDepartment: boolean;
}): number {
  const weights = {
    expertise: 0.40,
    domain: 0.25,
    workload: 0.15,
    experience: 0.10,
    department: 0.10,
  };
  
  const expertiseScore = params.expertiseOverlap * 100;
  const domainScore = params.domainMatch * 100;
  const workloadScore = Math.max(0, (1 - params.currentLoad / params.maxStudents)) * 100;
  const experienceScore = Math.min(params.previousProjectsInDomain * 20, 100);
  const departmentScore = params.sameDepartment ? 100 : 30;
  
  return Math.round(
    expertiseScore * weights.expertise +
    domainScore * weights.domain +
    workloadScore * weights.workload +
    experienceScore * weights.experience +
    departmentScore * weights.department
  );
}

// Helper functions
function tokenize(text: string): string[] {
  const stopWords = new Set([
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'shall', 'can', 'need', 'dare', 'ought',
    'used', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from',
    'as', 'into', 'through', 'during', 'before', 'after', 'above', 'below',
    'between', 'out', 'off', 'over', 'under', 'again', 'further', 'then',
    'once', 'and', 'but', 'or', 'nor', 'not', 'so', 'yet', 'both',
    'either', 'neither', 'each', 'every', 'all', 'any', 'few', 'more',
    'most', 'other', 'some', 'such', 'no', 'only', 'own', 'same', 'than',
    'too', 'very', 'just', 'because', 'this', 'that', 'these', 'those',
    'it', 'its', 'he', 'she', 'they', 'them', 'their', 'we', 'our',
    'i', 'me', 'my', 'you', 'your', 'which', 'who', 'whom', 'what',
    'where', 'when', 'why', 'how', 'if', 'while', 'about', 'up',
    'also', 'using', 'based', 'system', 'project', 'will', 'provide',
  ]);
  
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopWords.has(word));
}

function termFrequency(words: string[]): Record<string, number> {
  const tf: Record<string, number> = {};
  for (const word of words) {
    tf[word] = (tf[word] || 0) + 1;
  }
  // Normalize
  const max = Math.max(...Object.values(tf));
  if (max > 0) {
    for (const key of Object.keys(tf)) {
      tf[key] = tf[key] / max;
    }
  }
  return tf;
}
