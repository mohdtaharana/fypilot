export const SIMILARITY_EXPLANATION_PROMPT = `You are an academic project similarity analyzer. Given the following new proposal and a list of existing projects with their pre-calculated similarity scores, explain WHY these projects are similar.

NEW PROPOSAL:
Title: {{title}}
Abstract: {{abstract}}
Technologies: {{technologies}}
Objectives: {{objectives}}

SIMILAR PROJECTS FOUND (with pre-calculated similarity scores):
{{similarProjects}}

For each similar project, explain:
1. What concepts overlap
2. How the approaches differ (to help distinguish from actual plagiarism)
3. Whether the similarity is concerning or natural

IMPORTANT: Return ONLY valid JSON in this exact format:
{
  "matches": [
    {
      "projectId": "<id>",
      "projectTitle": "<title>",
      "similarityScore": <pre-calculated score>,
      "overlappingConcepts": ["concept1", "concept2"],
      "explanation": "<brief explanation of similarity and differences>"
    }
  ],
  "summary": "<overall summary of similarity findings>"
}`;

export const SIMILARITY_EXPLANATION_VERSION = 'v1.0';
