export const RISK_ANALYSIS_PROMPT = `You are a project management analyst for university FYP projects. Given the following project data and a pre-calculated risk score, provide an explanation and actionable recommendations.

PROJECT: {{projectTitle}}
Status: {{status}}

PRE-CALCULATED RISK ASSESSMENT:
Risk Score: {{riskScore}}/100
Health Status: {{healthStatus}}

PROJECT DATA:
- Progress: {{progress}}% (Expected at this point in the timeline: {{expectedProgress}}%)
- End Date: {{endDate}}

The risk score is determined purely by comparing reported progress to the expected progress for this point in the timeline. Based on the data above, provide:
1. Clear reasons explaining the risk level (reference the actual progress and expected progress numbers)
2. Specific, actionable recommendations to improve progress
3. A brief natural language summary

IMPORTANT: Return ONLY valid JSON in this exact format:
{
  "healthStatus": "healthy|at_risk|critical",
  "riskScore": <number>,
  "reasons": ["reason1 referencing specific data", "reason2"],
  "recommendations": ["specific action 1", "specific action 2"],
  "summary": "<2-3 sentence summary>"
}`;

export const RISK_ANALYSIS_VERSION = 'v1.1';
