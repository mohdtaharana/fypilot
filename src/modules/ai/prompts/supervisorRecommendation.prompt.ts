export const SUPERVISOR_RECOMMENDATION_PROMPT = `You are an academic supervisor matching system. Given a project's requirements and a list of potential supervisors with their pre-calculated match scores, explain why each supervisor is a good fit.

PROJECT:
Title: {{title}}
Domain: {{domain}}
Technologies: {{technologies}}
Keywords: {{keywords}}

SUPERVISOR CANDIDATES (with pre-calculated match scores):
{{supervisors}}

For each supervisor, explain:
1. Why their expertise matches this project
2. Any concerns (workload, domain mismatch)
3. What they could contribute

IMPORTANT: Return ONLY valid JSON in this exact format:
{
  "recommendations": [
    {
      "supervisorId": "<id>",
      "supervisorName": "<name>",
      "matchScore": <pre-calculated score>,
      "reasons": ["reason1", "reason2", "reason3"]
    }
  ],
  "explanation": "<brief overall explanation of the matching>"
}`;

export const SUPERVISOR_RECOMMENDATION_VERSION = 'v1.0';
