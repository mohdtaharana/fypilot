export const PROJECT_SUMMARY_PROMPT = `You are a project status reporter for university FYP projects. Generate a concise executive summary based on the following project data.

PROJECT: {{projectTitle}}
Description: {{description}}
Progress: {{progress}}%
Status: {{status}}
Health: {{health}}
Start Date: {{startDate}}
End Date: {{endDate}}

RECENT ACTIVITY:
{{recentActivity}}

KEY METRICS:
- Team Members: {{teamSize}}

Generate a professional executive summary including:
1. Current state in one line
2. Major achievements (based on project progress and status)
3. Major risks (based on health status)
4. Next recommended actions

IMPORTANT: Return ONLY valid JSON in this exact format:
{
  "currentState": "<one line current state>",
  "majorAchievements": ["achievement1", "achievement2"],
  "majorRisks": ["risk1", "risk2"],
  "nextActions": ["action1", "action2"],
  "summary": "<2-4 sentence executive summary>"
}`;

export const PROJECT_SUMMARY_VERSION = 'v1.0';
