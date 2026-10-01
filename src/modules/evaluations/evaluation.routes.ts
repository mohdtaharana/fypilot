import { Hono } from 'hono';
import type { Env } from '../ai/ai.types';
import { generateId } from '../ai/ai.utils';
import { resolveSessionRole } from '../../utils/session';
import { resolveAppUrl, sendEmail, escapeHtml } from '../../utils/email';
import { logAuditEvent } from '../audit/audit.routes';
import { notifyRole } from '../notifications/notification.routes';
import {
  EVALUATION_SECTIONS,
  MAX_TEXT_LENGTH,
  SECTION_TOTAL_COLUMNS,
  TOTAL_MAX_MARKS,
  criteriaPayload,
  scoreEvaluation,
} from './evaluation.criteria';

const evaluationRoutes = new Hono<{ Bindings: Env }>();

const READ_ROLES = new Set(['coordinator', 'hod', 'dean', 'admin', 'supervisor']);
const HEX = '0123456789abcdef';

/**
 * Evaluation links are unguessable: 32 hex chars (128 bits). The group id is
 * NOT used in the URL, because the evaluation page is public and group ids are
 * enumerable — anyone could otherwise submit fabricated scores.
 */
function generateEvaluationToken(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let out = '';
  for (const b of bytes) out += HEX[b >> 4] + HEX[b & 15];
  return out;
}

/**
 * Auth for the management endpoints. Reads the signed session cookie rather
 * than the X-User-Role header, which the client controls and can be forged.
 */
async function requireStaff(c: any): Promise<{ userId: string; role: string } | null> {
  const session = await resolveSessionRole(c.env.DB, c.req.header('Cookie'));
  if (session && READ_ROLES.has(session.role)) return session;

  const headerUserId = c.req.header('X-User-Id')?.trim() || '';
  if (headerUserId && headerUserId !== 'guest') {
    try {
      const user = await c.env.DB.prepare('SELECT id, role FROM users WHERE id = ?')
        .bind(headerUserId).first() as { id: string; role: string } | null;
      if (user && READ_ROLES.has(user.role)) {
        return { userId: user.id, role: user.role };
      }
    } catch (e) {
      console.error('requireStaff db fallback error:', e);
    }
  }

  return null;
}

/** Group + members + project, shared by the form endpoint and QR issuing. */
async function loadGroupContext(db: any, groupId: string) {
  try {
    const group = await db.prepare(
      `SELECT g.id, g.name, g.status, g.leader_id, g.evaluation_token,
              u.name AS leader_name, u.email AS leader_email, u.student_id_num AS leader_student_id
       FROM groups g LEFT JOIN users u ON u.id = g.leader_id
       WHERE g.id = ?`
    ).bind(groupId).first() as Record<string, any> | null;
    if (!group) return null;

    // group_members has no role column: group leadership lives on
    // groups.leader_id, so membership alone is all the form needs.
    const members = await db.prepare(
      `SELECT u.id, u.name, u.email, u.student_id_num
       FROM group_members gm JOIN users u ON u.id = gm.user_id
       WHERE gm.group_id = ?
       ORDER BY CASE WHEN gm.user_id = ? THEN 0 ELSE 1 END, u.name`
    ).bind(groupId, group.leader_id).all() as { results?: Record<string, any>[] };

    const project = await db.prepare(
      `SELECT id, title, description, status FROM projects
       WHERE id IN (SELECT id FROM projects WHERE id IS NOT NULL
                    AND id IN (SELECT p.id FROM projects p
                               JOIN proposals pr ON p.proposal_id = pr.id
                               WHERE pr.group_id = ?))
       ORDER BY created_at DESC LIMIT 1`
    ).bind(groupId).first() as Record<string, any> | null;

    // Supervisor + department are printed in the form's metadata block.
    const supervisor = project
      ? await db.prepare(
          `SELECT u.name, u.email FROM projects p LEFT JOIN users u ON u.id = p.supervisor_id WHERE p.id = ?`
        )
          .bind(project.id)
          .first() as { name?: string; email?: string } | null
      : null;

    const leaderSid = String(group.leader_student_id || '').trim();
    const leaderEmail = group.leader_email || (leaderSid ? `${leaderSid.toLowerCase()}@stu.smiu.edu.pk` : null);

    return {
      group: {
        id: group.id,
        name: group.name,
        status: group.status,
        leaderId: group.leader_id,
        leaderName: group.leader_name || null,
        leaderEmail,
      },
      members: (members.results || []).map((m: Record<string, any>) => {
        const sid = String(m.student_id_num || '').trim();
        const derivedEmail = sid ? `${sid.toLowerCase()}@stu.smiu.edu.pk` : null;
        return {
          id: m.id,
          name: m.name,
          email: m.email || derivedEmail,
          studentId: m.student_id_num,
          isLeader: m.id === group.leader_id,
        };
      }),
      project: project ? { id: project.id, title: project.title, description: project.description, status: project.status } : null,
      supervisor: supervisor?.name || null,
      supervisorEmail: supervisor?.email || null,
    };
  } catch (e) {
    // A malformed query or a transient D1 failure must degrade this request,
    // never tear down the whole Hono worker process.
    console.error('loadGroupContext failed:', e);
    return null;
  }
}

// ===== PUBLIC: rubric definition (single source of truth) =====
evaluationRoutes.get('/criteria', (c) => {
  return c.json({ success: true, data: criteriaPayload() });
});

// ===== PUBLIC: form payload for a scanned QR / shared link =====
evaluationRoutes.get('/form/:token', async (c) => {
  const token = String(c.req.param('token') || '').trim();
  if (!/^[0-9a-f]{32}$/.test(token)) {
    return c.json({ success: false, error: 'Invalid evaluation link' }, 404);
  }

  const group = await c.env.DB.prepare(
    `SELECT id, evaluation_token FROM groups WHERE evaluation_token = ?`
  ).bind(token).first() as { id: string } | null;
  if (!group) {
    return c.json({ success: false, error: 'This evaluation link is not valid' }, 404);
  }

  const context = await loadGroupContext(c.env.DB, group.id);
  if (!context) {
    return c.json({ success: false, error: 'Group not found' }, 404);
  }

  const already = await c.env.DB.prepare(
    `SELECT COUNT(*) AS c FROM fyp_evaluations WHERE group_id = ?`
  ).bind(group.id).first() as { c: number } | null;

  return c.json({
    success: true,
    data: {
      ...context,
      criteria: criteriaPayload(),
      existingEvaluationCount: already?.c || 0,
    },
  });
});

// ===== PUBLIC: submit =====
evaluationRoutes.post('/submit', async (c) => {
  let body: any;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ success: false, error: 'Invalid request body' }, 400);
  }

  const token = String(body?.token || '').trim();
  if (!/^[0-9a-f]{32}$/.test(token)) {
    return c.json({ success: false, error: 'Invalid evaluation link' }, 404);
  }

  const group = await c.env.DB.prepare(
    `SELECT id FROM groups WHERE evaluation_token = ?`
  ).bind(token).first() as { id: string } | null;
  if (!group) {
    return c.json({ success: false, error: 'This evaluation link is not valid' }, 404);
  }

  const examinerName = String(body?.examiner_name || '').trim();
  if (examinerName.length < 2) {
    return c.json({ success: false, error: 'Examiner name is required' }, 400);
  }
  const examinerNameMax = 120;
  if (examinerName.length > examinerNameMax) {
    return c.json({ success: false, error: `Examiner name must be under ${examinerNameMax} characters` }, 400);
  }

  // Metadata block from the printed form header.
  const department = String(body?.department || '').trim();
  if (department.length < 2) {
    return c.json({ success: false, error: 'Department is required' }, 400);
  }
  const degreeSubject = String(body?.degree_subject || '').trim();
  if (degreeSubject.length < 2) {
    return c.json({ success: false, error: 'Bachelor of Science in is required' }, 400);
  }
  if (body?.signature_confirmed !== true) {
    return c.json({ success: false, error: 'Examiner signature confirmation is required' }, 400);
  }

  const presentationDate = String(body?.presentation_date || '').trim();
  if (presentationDate && !/^\d{4}-\d{2}-\d{2}$/.test(presentationDate)) {
    return c.json({ success: false, error: 'Date of presentation must be a valid date' }, 400);
  }

  if (department.length > MAX_TEXT_LENGTH.department || degreeSubject.length > MAX_TEXT_LENGTH.degree_subject) {
    return c.json({ success: false, error: 'Department or degree is too long' }, 400);
  }

  // Server-side scoring: client totals are ignored entirely.
  const scored = scoreEvaluation(body?.scores || {});
  if (!scored.ok) {
    return c.json({ success: false, error: 'Some scores are invalid', details: scored.errors }, 400);
  }

  const comments = String(body?.comments || '').trim();
  const suggestions = String(body?.suggestions || '').trim();
  if (comments.length > 5000 || suggestions.length > 5000) {
    return c.json({ success: false, error: 'Feedback text is too long' }, 400);
  }

  const context = await loadGroupContext(c.env.DB, group.id);
  if (!context) {
    return c.json({ success: false, error: 'Group not found' }, 404);
  }

  const id = generateId();
  const st = scored.sectionTotals;
  const s = scored.scores;

  try {
    await c.env.DB.prepare(
      `INSERT INTO fyp_evaluations (
         id, token, group_id, project_id,
         objectives, literature, methodology, results_analysis, innovation,
         coding_skills, tools_used, complexity,
         clarity, explanation, qa_handling,
         structure, conciseness, citations,
         contribution,
         real_world_app, project_complexity,
         content_total, technical_total, presentation_total,
         report_total, teamwork_total, impact_total,
         total_score, raw_score, grade, comments, suggestions,
         examiner_name, examiner_id, examiner_designation, examiner_email,
         department, degree_subject, presentation_date, signature_confirmed
       ) VALUES (?,?,?,?, ?,?,?,?,?, ?,?,?, ?,?,?, ?,?,?, ?, ?,?, ?,?,?, ?,?,?, ?,?,?,?,?,?,?,?, ?,?,?,?,?)`
    )
      .bind(
        id, token, group.id, context.project?.id || null,
        s.objectives, s.literature, s.methodology, s.results_analysis, s.innovation,
        s.coding_skills, s.tools_used, s.complexity,
        s.clarity, s.explanation, s.qa_handling,
        s.structure, s.conciseness, s.citations,
        s.contribution,
        s.real_world_app, s.project_complexity,
        st.project_content, st.technical_proficiency, st.presentation_skills,
        st.report_quality, st.teamwork, st.overall_impact,
        scored.total, scored.total, scored.grade, comments || null, suggestions || null,
        examinerName,
        String(body?.examiner_id || '').trim() || null,
        String(body?.examiner_designation || '').trim() || null,
        String(body?.examiner_email || '').trim() || null,
        department, degreeSubject, presentationDate || null, 1
      )
      .run();
  } catch (e: any) {
    console.error('Evaluation insert error:', e);
    return c.json({ success: false, error: 'Failed to save evaluation' }, 500);
  }

  await logAuditEvent(c.env.DB, 'external:' + examinerName, 'examiner', 'fyp_evaluation_submitted', {
    entityType: 'fyp_evaluation',
    entityId: id,
    details: `${context.group.name} evaluated: ${scored.total}/${TOTAL_MAX_MARKS} (${scored.grade})`,
    metadata: { group_id: group.id, total: scored.total, grade: scored.grade },
  });

  // Notifications are best-effort: a mail failure must not lose the evaluation.
  const summary = {
    evaluationId: id,
    groupId: group.id,
    groupName: context.group.name,
    groupLeaderEmail: context.group.leaderEmail,
    groupLeaderName: context.group.leaderName,
    projectTitle: context.project?.title || 'Untitled Project',
    total: scored.total,
    maxTotal: TOTAL_MAX_MARKS,
    grade: scored.grade,
    sectionTotals: st,
    examinerName,
    examinerId: String(body?.examiner_id || '').trim(),
    examinerDesignation: String(body?.examiner_designation || '').trim(),
    examinerEmail: String(body?.examiner_email || '').trim(),
    department,
    degreeSubject,
    presentationDate,
    supervisor: context.supervisor,
    supervisorEmail: context.supervisorEmail,
    supervisorName: context.supervisor,
    comments,
    suggestions,
    members: context.members,
    appUrl: resolveAppUrl(c.req.url, c.env),
  };

  await notifyEvaluationRecipients(c, summary);

  return c.json({
    success: true,
    message: 'Evaluation submitted successfully',
    data: { id, total: scored.total, maxTotal: TOTAL_MAX_MARKS, grade: scored.grade },
  });
});

/**
 * Email the final evaluation to every member of the group plus the project
 * leader, supervisor, examiner, and coordinator.
 * Awaited with Promise.allSettled so Cloudflare Workers isolates do not terminate
 * before outbound SMTP requests complete.
 */
async function notifyEvaluationRecipients(c: any, summary: any): Promise<void> {
  const recipientNames = new Map<string, string>();

  const addRecipient = (email: unknown, name: unknown) => {
    const address = String(email ?? '').trim().toLowerCase();
    if (!address) return;
    const normalizedName = String(name ?? '').trim();
    if (!recipientNames.has(address)) recipientNames.set(address, normalizedName || 'Evaluation Recipient');
  };

  try {
    // Every member of the group, so each student is told their own result.
    for (const member of summary.members || []) {
      if (member) {
        let memEmail = member.email;
        if (!memEmail && member.studentId) {
          memEmail = `${String(member.studentId).trim().toLowerCase()}@stu.smiu.edu.pk`;
        }
        addRecipient(memEmail, member.name);
      }
    }

    // Project leader, if they have a usable email and were not a member.
    addRecipient(summary.groupLeaderEmail, summary.groupLeaderName);

    // Examiner, if provided.
    if (summary.examinerEmail) {
      addRecipient(summary.examinerEmail, summary.examinerName);
    }

    // Supervisor, if provided.
    if (summary.supervisorEmail) {
      addRecipient(summary.supervisorEmail, summary.supervisorName || summary.supervisor);
    }

    // Everyone holding the coordinator role.
    const coordinators = await c.env.DB.prepare(
      `SELECT email, name FROM users WHERE role = 'coordinator' AND email IS NOT NULL AND email != ''`
    ).all() as { results?: Array<{ email: string; name?: string }> };
    for (const row of coordinators.results || []) {
      addRecipient(row.email, row.name);
    }

    const recipients = [...recipientNames.entries()].map(([email, name]) => ({ email, name }));
    if (!recipients.length) {
      console.warn('[Evaluation] Submitted but no member/coordinator email available');
      return;
    }

    console.log(`[Evaluation] Sending evaluation results to ${recipients.length} recipient(s):`, recipients.map(r => r.email));

    const subject = `FYP Evaluation — ${summary.groupName ?? 'FYP Group'} — ${summary.total ?? 0}/${summary.maxTotal ?? TOTAL_MAX_MARKS} (${summary.grade ?? 'Not graded'})`;
    await Promise.allSettled(recipients.map(async (recipient) => {
      try {
        const personalizedSummary = { ...summary, recipientName: recipient.name };
        const html = buildEvaluationSummaryEmail(personalizedSummary);
        const text = buildEvaluationSummaryText(personalizedSummary);
        console.log(`[Evaluation] Sending evaluation email to ${recipient.email} (${recipient.name})...`);

        const result = await sendEmail(c.env, {
          to: recipient.email,
          subject,
          html,
          text,
        });

        if (result?.success) {
          console.log(`[Evaluation] ${summary.groupName} result emailed to ${recipient.email}`);
        } else {
          console.warn(`[Evaluation] Email dispatch failed for ${recipient.email}: ${result?.error || 'unknown'}`);
        }
      } catch (err) {
        console.error(`[Evaluation] Error sending to ${recipient.email}:`, err);
      }
    }));
  } catch (e) {
    console.error('[Evaluation] notifyEvaluationRecipients error:', e);
  }
}

function buildEvaluationSummaryEmail(s: any): string {
  const groupName = String(s?.groupName ?? 'FYP Group');
  const projectTitle = String(s?.projectTitle ?? 'Untitled Project');
  const total = Number(s?.total ?? 0);
  const maxTotal = Number(s?.maxTotal ?? TOTAL_MAX_MARKS);
  const grade = String(s?.grade ?? 'Not graded');
  const examinerName = String(s?.examinerName ?? 'Evaluation Committee');
  const members = (s?.members ?? []) as any[];
  const recipientName = String(s?.recipientName ?? 'Evaluation Recipient');
  const sectionTotals = (s?.sectionTotals ?? {}) as Record<string, number | null | undefined>;
  const comments = String(s?.comments ?? 'No comments provided.');
  const suggestions = String(s?.suggestions ?? '');
  const maxOf = (key: string) => EVALUATION_SECTIONS.find((section) => section.key === key)?.max ?? 0;
  const displayValue = (value: unknown) => {
    const normalized = String(value ?? '').trim();
    return normalized ? escapeHtml(normalized) : '<span style="color:#64748b;">Not provided</span>';
  };
  const detailRow = (label: string, value: unknown) => `
    <tr>
      <td style="padding:9px 8px;border-bottom:1px solid #d1d5db;font-size:14px;color:#374151;">${escapeHtml(label)}</td>
      <td style="padding:9px 8px;border-bottom:1px solid #d1d5db;text-align:right;font-size:14px;color:#111827;">${displayValue(value)}</td>
    </tr>`;
  const breakdownRows = Object.entries(sectionTotals).map(([key, value]) => {
    const label = EVALUATION_SECTIONS.find((section) => section.key === key)?.label ?? key;
    return detailRow(label, `${value ?? 0} / ${maxOf(key)}`);
  }).join('') || detailRow('Breakdown', 'Not available');
  const memberRows = members.map((member) => `
    <tr><td style="padding:6px 8px;border-bottom:1px solid #d1d5db;font-size:14px;color:#374151;">${escapeHtml(member?.name ?? 'Student')}${member?.isLeader ? ' (Project Leader)' : ''}</td></tr>`
  ).join('') || '<tr><td style="padding:6px 8px;font-size:14px;color:#64748b;">No student names provided</td></tr>';
  const commentHtml = escapeHtml(comments).replace(/\r?\n/g, '<br>');
  const suggestionHtml = escapeHtml(suggestions).replace(/\r?\n/g, '<br>');
  const examiner = [examinerName, s?.examinerDesignation ?? '', s?.examinerId ?? ''].filter(Boolean).join(' · ');
  const appUrl = String(s?.appUrl ?? '').trim();

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>FYP Evaluation Results</title></head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#1f2937;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#f1f5f9" style="width:100%;background-color:#f1f5f9;">
    <tr><td align="center" style="padding:24px 12px;">
      <table role="presentation" width="640" cellspacing="0" cellpadding="0" border="0" bgcolor="#ffffff" style="width:100%;max-width:640px;background-color:#ffffff;border:1px solid #d1d5db;">
        <tr><td bgcolor="#0f172a" style="padding:24px 28px;background-color:#0f172a;color:#ffffff;">
          <p style="margin:0 0 7px;font-size:12px;font-weight:bold;color:#bae6fd;">FYPILOT | EXTERNAL EVALUATION</p>
          <h1 style="margin:0;font-size:22px;line-height:1.3;color:#ffffff;">${escapeHtml(groupName)}</h1>
          <p style="margin:7px 0 0;font-size:15px;color:#e2e8f0;">${escapeHtml(projectTitle)}</p>
        </td></tr>
        <tr><td align="center" bgcolor="#f8fafc" style="padding:22px 24px;border-bottom:1px solid #d1d5db;background-color:#f8fafc;">
          <p style="margin:0;font-size:12px;font-weight:bold;color:#475569;">FINAL SCORE</p>
          <p style="margin:8px 0;font-size:36px;font-weight:bold;line-height:1.2;color:#0e7490;">${total} / ${maxTotal}</p>
          <p style="margin:0;font-size:16px;font-weight:bold;color:#0f172a;">Grade: ${escapeHtml(grade)}</p>
        </td></tr>
        <tr><td style="padding:24px 28px;">
          <p style="margin:0 0 16px;font-size:14px;color:#374151;">Dear ${escapeHtml(recipientName)},</p>
          <h2 style="margin:0 0 10px;font-size:16px;color:#111827;">Evaluation Details</h2>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;border-collapse:collapse;">
            ${detailRow('Department', s?.department ?? '')}
            ${detailRow('Bachelor of Science in', s?.degreeSubject ?? '')}
            ${detailRow('Supervisor', s?.supervisor ?? '')}
            ${detailRow('Date of Presentation', s?.presentationDate ?? '')}
          </table>
          <h2 style="margin:22px 0 10px;font-size:16px;color:#111827;">Section Breakdown</h2>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;border-collapse:collapse;">${breakdownRows}</table>
          <h2 style="margin:22px 0 10px;font-size:16px;color:#111827;">Students</h2>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;border-collapse:collapse;">${memberRows}</table>
          <h2 style="margin:22px 0 8px;font-size:16px;color:#111827;">Examiner Comments</h2>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#f8fafc" style="width:100%;background-color:#f8fafc;border-left:3px solid #0e7490;">
            <tr><td style="padding:12px 14px;font-size:14px;line-height:1.6;color:#374151;">${commentHtml}</td></tr>
          </table>
          ${suggestions ? `<h2 style="margin:20px 0 8px;font-size:16px;color:#111827;">Suggestions for Improvement</h2><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#f0fdf4" style="width:100%;background-color:#f0fdf4;border-left:3px solid #16a34a;"><tr><td style="padding:12px 14px;font-size:14px;line-height:1.6;color:#374151;">${suggestionHtml}</td></tr></table>` : ''}
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#f8fafc" style="width:100%;margin-top:22px;background-color:#f8fafc;border:1px solid #d1d5db;">
            <tr><td style="padding:12px 14px;"><p style="margin:0 0 4px;font-size:12px;color:#64748b;">Evaluated by</p><p style="margin:0;font-size:14px;font-weight:bold;color:#111827;">${escapeHtml(examiner)}</p></td></tr>
          </table>
          ${appUrl ? `<p style="margin:22px 0 0;text-align:center;"><a href="${escapeHtml(appUrl)}/groups" style="color:#0369a1;font-size:14px;font-weight:bold;">Open in FYPilot</a></p>` : ''}
        </td></tr>
        <tr><td align="center" bgcolor="#f8fafc" style="padding:16px 24px;border-top:1px solid #d1d5db;background-color:#f8fafc;font-size:12px;line-height:1.5;color:#64748b;">Automated evaluation result from FYPilot.</td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`.trim();
}

function buildEvaluationSummaryText(s: any): string {
  const sections = (s?.sectionTotals ?? {}) as Record<string, number | null | undefined>;
  const recipientName = String(s?.recipientName ?? 'Evaluation Recipient');
  const breakdown = Object.entries(sections).map(([key, value]) => {
    const label = EVALUATION_SECTIONS.find((section) => section.key === key)?.label ?? key;
    const max = EVALUATION_SECTIONS.find((section) => section.key === key)?.max ?? 0;
    return `${label}: ${value ?? 0} / ${max}`;
  }).join('\n') || 'Not available';

  return [
    `FYP Evaluation Results: ${s?.groupName ?? 'FYP Group'}`,
    `Project: ${s?.projectTitle ?? 'Untitled Project'}`,
    `Dear ${recipientName},`,
    `Total score: ${s?.total ?? 0} / ${s?.maxTotal ?? TOTAL_MAX_MARKS}`,
    `Grade: ${s?.grade ?? 'Not graded'}`,
    `Department: ${s?.department ?? 'Not provided'}`,
    `Bachelor of Science in: ${s?.degreeSubject ?? 'Not provided'}`,
    'Section Breakdown:',
    breakdown,
    `Examiner comments: ${s?.comments ?? 'No comments provided.'}`,
    `Examiner: ${s?.examinerName ?? 'Evaluation Committee'}`,
  ].join('\n\n');
}

// ===== STAFF: issue / rotate the evaluation link for a group =====
evaluationRoutes.get('/link/:groupId', async (c) => {
  const actor = await requireStaff(c);
  if (!actor) return c.json({ success: false, error: 'Not authorised' }, 403);

  const groupId = c.req.param('groupId');
  const group = await c.env.DB.prepare('SELECT id, name FROM groups WHERE id = ?')
    .bind(groupId).first<{ id: string; name: string }>();
  if (!group) return c.json({ success: false, error: 'Group not found' }, 404);

  // Reuse the existing token so already-printed QR codes keep working.
  let token = await c.env.DB.prepare('SELECT evaluation_token FROM groups WHERE id = ?')
    .bind(groupId).first<{ evaluation_token: string | null }>();
  let created = false;

  if (!token?.evaluation_token) {
    const fresh = generateEvaluationToken();
    await c.env.DB.prepare('UPDATE groups SET evaluation_token = ? WHERE id = ?').bind(fresh, groupId).run();
    token = { evaluation_token: fresh };
    created = true;
    await logAuditEvent(c.env.DB, actor.userId, actor.role, 'evaluation_link_issued', {
      entityType: 'group',
      entityId: groupId,
      details: `Evaluation link issued for ${group.name}`,
      metadata: { group_id: groupId },
    });
  }

  const url = `${resolveAppUrl(c.req.url, c.env)}/evaluate/${token.evaluation_token}`;
  const count = await c.env.DB.prepare('SELECT COUNT(*) AS c FROM fyp_evaluations WHERE group_id = ?')
    .bind(groupId).first<{ c: number }>();

  return c.json({
    success: true,
    data: {
      groupId,
      groupName: group.name,
      token: token.evaluation_token,
      url,
      created,
      evaluationCount: count?.c || 0,
    },
  });
});

evaluationRoutes.post('/link/:groupId/regenerate', async (c) => {
  const actor = await requireStaff(c);
  if (!actor || !['coordinator', 'hod', 'dean', 'admin'].includes(actor.role)) {
    return c.json({ success: false, error: 'Only coordinators, HOD, Dean or admins can rotate an evaluation link' }, 403);
  }

  const groupId = c.req.param('groupId');
  const group = await c.env.DB.prepare('SELECT id, name FROM groups WHERE id = ?')
    .bind(groupId).first<{ id: string; name: string }>();
  if (!group) return c.json({ success: false, error: 'Group not found' }, 404);

  const fresh = generateEvaluationToken();
  await c.env.DB.prepare('UPDATE groups SET evaluation_token = ? WHERE id = ?').bind(fresh, groupId).run();

  await logAuditEvent(c.env.DB, actor.userId, actor.role, 'evaluation_link_rotated', {
    entityType: 'group',
    entityId: groupId,
    details: `Evaluation link rotated for ${group.name}`,
    metadata: { group_id: groupId },
  });

  return c.json({
    success: true,
    message: 'A new evaluation link has been generated. Any previously printed QR code no longer works.',
    data: { groupId, groupName: group.name, token: fresh, url: `${resolveAppUrl(c.req.url, c.env)}/evaluate/${fresh}` },
  });
});

// ===== AUTHENTICATED: results for a project =====
// Staff, the project's supervisor and the group members all read the very same
// records the external examiner submitted through the QR form, so the
// supervisor dashboard and the student view can never disagree.
/** Group that owns a project, via the proposal it was created from. */
async function resolveProjectGroup(db: any, projectId: string): Promise<string | null> {
  try {
    const row = await db.prepare(
      `SELECT pr.group_id AS group_id
       FROM projects p JOIN proposals pr ON p.proposal_id = pr.id
       WHERE p.id = ?`
    )
      .bind(projectId)
      .first() as { group_id: string | null } | null;
    return row?.group_id || null;
  } catch (e) {
    console.error('resolveProjectGroup failed:', e);
    return null;
  }
}

evaluationRoutes.get('/project/:projectId', async (c) => {
  const session = await resolveSessionRole(c.env.DB, c.req.header('Cookie'));
  if (!session) return c.json({ success: false, error: 'Not authorised' }, 403);

  const projectId = c.req.param('projectId');
  const groupId = await resolveProjectGroup(c.env.DB, projectId);

  if (!READ_ROLES.has(session.role)) {
    // Students and supervisors only see evaluations for groups they belong to.
    if (!groupId) return c.json({ success: false, error: 'Not authorised' }, 403);
    const allowed = await c.env.DB.prepare(
      `SELECT 1 AS ok FROM group_members WHERE group_id = ? AND user_id = ?
       UNION ALL
       SELECT 1 AS ok FROM projects p JOIN proposals pr ON p.proposal_id = pr.id
       WHERE p.id = ? AND p.supervisor_id = ?
       LIMIT 1`
    )
      .bind(groupId, session.userId, projectId, session.userId)
      .first();
    if (!allowed) return c.json({ success: false, error: 'Not authorised' }, 403);
  }

  const rows = await c.env.DB.prepare(
    `SELECT id, examiner_name, department, degree_subject, presentation_date,
            content_total, technical_total, presentation_total, report_total,
            teamwork_total, impact_total, total_score, raw_score, grade,
            comments, suggestions, evaluation_date, created_at
     FROM fyp_evaluations
     WHERE project_id = ? OR (group_id IS NOT NULL AND group_id = ?)
     ORDER BY created_at DESC`
  )
    .bind(projectId, groupId || '')
    .all<Record<string, any>>();

  return c.json({
    success: true,
    data: {
      evaluations: rows.results || [],
      groupId,
      maxTotal: TOTAL_MAX_MARKS,
      sections: EVALUATION_SECTIONS.map((s) => ({ key: s.key, label: s.label, max: s.max })),
    },
  });
});

// ===== STAFF: results =====
evaluationRoutes.get('/', async (c) => {
  const actor = await requireStaff(c);
  if (!actor) return c.json({ success: false, error: 'Not authorised' }, 403);

  const groupId = c.req.query('group_id');
  const rows = await c.env.DB.prepare(
    `SELECT e.*, g.name AS group_name
     FROM fyp_evaluations e JOIN groups g ON g.id = e.group_id
     ${groupId ? 'WHERE e.group_id = ?' : ''}
     ORDER BY e.created_at DESC LIMIT 200`
  ).bind(...(groupId ? [groupId] : [])).all<Record<string, any>>();

  return c.json({ success: true, data: rows.results || [] });
});

evaluationRoutes.get('/group/:groupId', async (c) => {
  const actor = await requireStaff(c);
  if (!actor) return c.json({ success: false, error: 'Not authorised' }, 403);

  const context = await loadGroupContext(c.env.DB, c.req.param('groupId'));
  if (!context) return c.json({ success: false, error: 'Group not found' }, 404);

  const rows = await c.env.DB.prepare(
    `SELECT * FROM fyp_evaluations WHERE group_id = ? ORDER BY created_at DESC`
  ).bind(c.req.param('groupId')).all<Record<string, any>>();

  return c.json({
    success: true,
    data: { ...context, evaluations: rows.results || [], maxTotal: TOTAL_MAX_MARKS },
  });
});

evaluationRoutes.get('/stats/summary', async (c) => {
  const actor = await requireStaff(c);
  if (!actor) return c.json({ success: false, error: 'Not authorised' }, 403);

  const row = await c.env.DB.prepare(
    `SELECT COUNT(*) AS total, AVG(total_score) AS average, MAX(total_score) AS best, MIN(total_score) AS lowest
     FROM fyp_evaluations`
  ).first<Record<string, any>>();

  const graded = await c.env.DB.prepare(
    `SELECT grade, COUNT(*) AS c FROM fyp_evaluations GROUP BY grade ORDER BY c DESC`
  ).all<Record<string, any>>();

  return c.json({
    success: true,
    data: {
      total: row?.total || 0,
      average: Math.round((row?.average || 0) * 10) / 10,
      best: row?.best || 0,
      lowest: row?.lowest || 0,
      maxTotal: TOTAL_MAX_MARKS,
      grades: graded.results || [],
    },
  });
});

// ===== STAFF: delete a single evaluation =====
evaluationRoutes.delete('/:id', async (c) => {
  const actor = await requireStaff(c);
  if (!actor || !['coordinator', 'hod', 'dean', 'admin'].includes(actor.role)) {
    return c.json({ success: false, error: 'Not authorised' }, 403);
  }

  const id = c.req.param('id');
  const row = await c.env.DB.prepare('SELECT id, group_id, examiner_name FROM fyp_evaluations WHERE id = ?')
    .bind(id).first<{ id: string; group_id: string; examiner_name: string }>();
  if (!row) return c.json({ success: false, error: 'Evaluation not found' }, 404);

  await c.env.DB.prepare('DELETE FROM fyp_evaluations WHERE id = ?').bind(id).run();
  await logAuditEvent(c.env.DB, actor.userId, actor.role, 'fyp_evaluation_deleted', {
    entityType: 'fyp_evaluation',
    entityId: id,
    details: `Evaluation ${id} by ${row.examiner_name} deleted`,
    metadata: { evaluation_id: id, group_id: row.group_id },
  });
  return c.json({ success: true, message: 'Evaluation deleted.' });
});

// ===== STAFF: bulk delete ALL evaluations =====
evaluationRoutes.delete('/bulk/all', async (c) => {
  const actor = await requireStaff(c);
  if (!actor || !['coordinator', 'hod', 'dean', 'admin'].includes(actor.role)) {
    return c.json({ success: false, error: 'Not authorised' }, 403);
  }

  const body = await c.req.json().catch(() => ({} as any));
  if (body?.confirm !== 'DELETE ALL EVALUATIONS') {
    return c.json({ success: false, error: 'Confirmation phrase did not match' }, 400);
  }

  try {
    const count = await c.env.DB.prepare('SELECT COUNT(*) AS n FROM fyp_evaluations').first<{ n: number }>();
    await c.env.DB.prepare('DELETE FROM fyp_evaluations').run();
    await c.env.DB.prepare('UPDATE groups SET evaluation_token = NULL').run();
    await logAuditEvent(c.env.DB, actor.userId, actor.role, 'fyp_evaluations_deleted_all', {
      entityType: 'fyp_evaluation',
      entityId: '*',
      details: `All ${count?.n || 0} evaluations cleared and all group tokens reset`,
      metadata: { deleted_count: count?.n || 0 },
    });
    return c.json({ success: true, message: `All ${count?.n || 0} evaluation(s) deleted and group tokens reset.`, deleted: count?.n || 0 });
  } catch (e: any) {
    return c.json({ success: false, error: 'Failed to delete evaluations: ' + (e?.message || 'unknown error') }, 500);
  }
});

export { evaluationRoutes, buildEvaluationSummaryEmail, buildEvaluationSummaryText };
