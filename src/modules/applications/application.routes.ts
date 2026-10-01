import { Hono } from 'hono';
import type { Env } from '../ai/ai.types';
import { generateId } from '../ai/ai.utils';
import { logAuditEvent } from '../audit/audit.routes';
import { requireBulkDeleteRole } from '../../utils/bulk-guard';
import { createNotification, notifyRole } from '../notifications/notification.routes';
import { extractTranscriptText, verifyTranscriptEligibility } from './transcript-verifier';
import { ensureUserDocumentColumns, isPdfDataUrl } from '../groups/member-docs';
import {
  sendEmail,
  resolveAppUrl,
  buildGroupMemberInvitationEmail,
  buildApplicationSubmittedLeaderEmail,
  buildApplicationDecisionEmail,
  buildSupervisorAssignedEmail,
} from '../../utils/email';

const EXECUTIVE_ROLES = new Set(['coordinator', 'hod', 'dean']);
const isExecutiveRole = (role?: string | null) => !!role && EXECUTIVE_ROLES.has(role);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Normalizes a raw group_members payload into a clean, validated list.
 * Blank rows (the form always renders one empty slot) are dropped so they are
 * not persisted or emailed. Any partially filled row is rejected loudly, since
 * a member without an email can never be notified.
 */
function normalizeSubmittedMembers(raw: unknown): { members: Array<Record<string, any>>; error?: string } {
  const members: Array<Record<string, any>> = [];
  if (raw === undefined || raw === null) return { members };
  if (!Array.isArray(raw)) return { members, error: 'Group members must be a list' };

  for (let i = 0; i < raw.length; i++) {
    const m = (raw[i] || {}) as Record<string, any>;
    const name = String(m.name ?? m.student_name ?? '').trim();
    const studentIdNum = String(m.student_id_num ?? m.student_id ?? '').trim();
    const email = String(m.email ?? '').trim().toLowerCase();
    const label = `Group member ${i + 1}`;

    if (!name && !studentIdNum && !email) continue;
    if (!name) return { members, error: `${label}: Name is required` };
    if (!studentIdNum) return { members, error: `${label}: Student ID is required` };

    let resolvedEmail = email;
    if (!resolvedEmail && studentIdNum) {
      resolvedEmail = `${studentIdNum.toLowerCase().replace(/[^a-z0-9]/g, '')}@stu.smiu.edu.pk`;
    }
    if (!resolvedEmail) return { members, error: `${label}: Email is required so the member can be notified` };
    if (!EMAIL_RE.test(resolvedEmail)) return { members, error: `${label}: "${resolvedEmail}" is not a valid email address` };

    members.push({
      name,
      student_id_num: studentIdNum,
      email: resolvedEmail,
      internship_certificate: m.internship_certificate || m.internship_certificate_pdf || null,
      internship_filename: m.internship_filename || m.internship_pdf_name || 'internship_letter.pdf',
      transcript_certificate: m.transcript_certificate || m.transcript_certificate_pdf || null,
      transcript_filename: m.transcript_filename || m.transcript_pdf_name || 'transcript.pdf',
      transcript_text: String(m.transcript_text || '').trim(),
    });
  }

  if (members.length > 3) {
    return { members, error: 'A maximum of 3 additional group members is allowed (4 total)' };
  }

  return { members };
}

/**
 * Resolve a member's email. New submissions always carry an explicit email, but
 * applications stored before this was made mandatory may only have a student ID,
 * so the legacy derived address is kept as a fallback.
 */
function resolveMemberEmail(m: Record<string, any>, studentIdNum: string): string | null {
  const explicit = String(m?.email ?? '').trim().toLowerCase();
  if (explicit && EMAIL_RE.test(explicit)) return explicit;
  if (studentIdNum) {
    const derived = `${studentIdNum.toLowerCase().replace(/[^a-z0-9]/g, '')}@stu.smiu.edu.pk`;
    return EMAIL_RE.test(derived) ? derived : null;
  }
  return null;
}

async function cleanupBrokenApprovalReferences(db: Env['DB']) {
  try {
    await db.prepare('DELETE FROM project_members WHERE user_id NOT IN (SELECT id FROM users)').run();
    await db.prepare('DELETE FROM group_members WHERE user_id NOT IN (SELECT id FROM users)').run();
    await db.prepare('DELETE FROM groups WHERE leader_id NOT IN (SELECT id FROM users)').run();
    await db.prepare('DELETE FROM proposals WHERE submitted_by NOT IN (SELECT id FROM users)').run();
    await db.prepare('DELETE FROM projects WHERE supervisor_id IS NOT NULL AND supervisor_id NOT IN (SELECT id FROM users)').run();
  } catch (e) {
    console.warn('cleanupBrokenApprovalReferences failed:', e);
  }
}

async function ensureApplicationColumns(db: Env['DB']) {
  try {
    const result = await db.prepare('PRAGMA table_info(student_applications)').all();
    const columns = new Set((result?.results || []).map((row: any) => String(row.name)));
    const required = [
      'transcript_certificate',
      'transcript_filename',
      'transcript_text',
      'abstract',
      'problem_statement',
      'objectives',
      'methodology',
      'technologies',
    ];

    for (const column of required) {
      if (!columns.has(column)) {
        await db.prepare(`ALTER TABLE student_applications ADD COLUMN ${column} TEXT`).run();
      }
    }
  } catch (e) {
    console.warn('ensureApplicationColumns failed:', e);
  }
}

const applicationRoutes = new Hono<{ Bindings: Env }>();

applicationRoutes.use('*', async (c, next) => {
  await ensureUserDocumentColumns(c.env.DB);
  await ensureApplicationColumns(c.env.DB);
  await next();
});

const VALID_DEPARTMENTS = [
  'Business Administration',
  'Accounting Banking & Finance',
  'Computer Science',
  'Software Engineering',
  'Artificial Intelligence & Mathematical Sciences',
  'Media & Communication Studies',
  'English',
  'Social and Development Studies',
  'Education',
  'Environmental Sciences'
];

// Department filtering matrix per Program and Shift
export const DEPARTMENT_MATRIX: Record<string, Record<string, string[]>> = {
  BS: {
    Morning: [
      'Computer Science',
      'Software Engineering',
      'Artificial Intelligence & Mathematical Sciences',
      'Business Administration',
      'Accounting Banking & Finance',
      'Media & Communication Studies',
      'English',
      'Social and Development Studies',
      'Education',
      'Environmental Sciences'
    ],
    Evening: [
      'Computer Science',
      'Software Engineering',
      'Artificial Intelligence & Mathematical Sciences',
      'Business Administration',
      'Accounting Banking & Finance',
      'Media & Communication Studies'
    ]
  },
  MS: {
    Morning: [
      'Computer Science',
      'Software Engineering',
      'Business Administration',
      'Media & Communication Studies',
      'English'
    ],
    Evening: [
      'Computer Science',
      'Software Engineering',
      'Artificial Intelligence & Mathematical Sciences',
      'Business Administration'
    ]
  }
};

// GET /api/applications/departments — returns dynamic department matrix
applicationRoutes.get('/departments', (c) => {
  const program = c.req.query('program');
  const shift = c.req.query('shift');

  if (program && shift && DEPARTMENT_MATRIX[program] && DEPARTMENT_MATRIX[program][shift]) {
    return c.json({
      success: true,
      data: DEPARTMENT_MATRIX[program][shift]
    });
  }

  return c.json({ success: true, data: VALID_DEPARTMENTS, matrix: DEPARTMENT_MATRIX });
});

// POST /api/applications — Public Student Application submission (NO LOGIN REQUIRED)
applicationRoutes.post('/', async (c) => {
  try {
    const body = await c.req.json();
    const email = body.email;
    const student_id = (body.student_id || body.student_id_num || '').trim();
    const student_name = (body.student_name || '').trim();
    const program = body.program;
    const shift = body.shift;
    const department = body.department;
    const internship_certificate = body.internship_certificate || body.internship_certificate_pdf;
    const internship_filename = body.internship_filename || body.pdf_name || 'internship_certificate.pdf';
    const transcript_certificate = body.transcript_certificate || body.transcript_certificate_pdf;
    const transcript_filename = body.transcript_filename || body.transcript_pdf_name || 'transcript.pdf';
    const group_name = (body.group_name || '').trim();
    const project_title = (body.project_title || '').trim();
    const abstract = (body.abstract || '').trim();
    const problem_statement = (body.problem_statement || '').trim();
    const objectives = (body.objectives || '').trim();
    const methodology = (body.methodology || '').trim();
    const technologies = (body.technologies || body.methodology || '').trim();
    const group_members = body.group_members || body.members || [];
    const supervisor_preference_1 = body.supervisor_preference_1 || body.pref_1;
    const supervisor_preference_2 = body.supervisor_preference_2 || body.pref_2;
    const supervisor_preference_3 = body.supervisor_preference_3 || body.pref_3;
    const supervisor_priority = body.supervisor_priority || body.priority || 'Normal';

    // 1. Email validation (must end with @stu.smiu.edu.pk)
    if (!email || !email.toLowerCase().endsWith('@stu.smiu.edu.pk')) {
      return c.json({
        success: false,
        error: 'University Email is required and must end with @stu.smiu.edu.pk'
      }, 400);
    }

    // 2. Student ID validation
    if (!student_id) {
      return c.json({ success: false, error: 'Student ID is required' }, 400);
    }

    // 3. Name validation
    if (!student_name) {
      return c.json({ success: false, error: 'Student Name is required' }, 400);
    }

    // 4. Program validation
    if (!program || !['BS', 'MS'].includes(program)) {
      return c.json({ success: false, error: 'Program must be BS or MS' }, 400);
    }

    // 5. Shift validation
    if (!shift || !['Morning', 'Evening'].includes(shift)) {
      return c.json({ success: false, error: 'Shift must be Morning or Evening' }, 400);
    }

    // 6. Department validation with matrix check
    const validDepts = DEPARTMENT_MATRIX[program]?.[shift] || VALID_DEPARTMENTS;
    if (!department || !validDepts.includes(department)) {
      return c.json({
        success: false,
        error: `Selected department is not valid for ${program} (${shift}). Available departments: ${validDepts.join(', ')}`
      }, 400);
    }

    // 7. Internship Certificate (PDF required)
    if (!internship_certificate || typeof internship_certificate !== 'string') {
      return c.json({ success: false, error: 'Internship Certificate is required' }, 400);
    }
    const isInternshipPdf = internship_certificate.startsWith('data:application/pdf;') ||
                            internship_certificate.includes('application/pdf') ||
                            (internship_filename && internship_filename.toLowerCase().endsWith('.pdf'));
    if (!isInternshipPdf) {
      return c.json({ success: false, error: 'Internship Certificate must be a PDF file' }, 400);
    }

    // 7b. Academic Transcript (PDF required)
    if (!transcript_certificate || typeof transcript_certificate !== 'string') {
      return c.json({ success: false, error: 'Academic Transcript is required' }, 400);
    }
    const isTranscriptPdf = transcript_certificate.startsWith('data:application/pdf;') ||
                            transcript_certificate.includes('application/pdf') ||
                            (transcript_filename && transcript_filename.toLowerCase().endsWith('.pdf'));
    if (!isTranscriptPdf) {
      return c.json({ success: false, error: 'Academic Transcript must be a PDF file' }, 400);
    }

    // 8. FYP Group & Project Title
    if (!group_name) {
      return c.json({ success: false, error: 'FYP Group Name is required' }, 400);
    }
    if (!project_title) {
      return c.json({ success: false, error: 'Project Title is required' }, 400);
    }

    // 9. Supervisor Preferences
    if (!supervisor_preference_1) {
      return c.json({ success: false, error: 'Preference 1 Supervisor is required' }, 400);
    }

    // 9b. Group Members — name, student ID and email are all required so every
    // member can actually receive their registration notification.
    const { members: validatedMembers, error: membersError } = normalizeSubmittedMembers(group_members);
    if (membersError) {
      return c.json({ success: false, error: membersError }, 400);
    }

    const leaderTranscriptText = String(body.transcript_text || '').trim() || await extractTranscriptText(transcript_certificate);
    if (!leaderTranscriptText.trim()) {
      return c.json({ success: false, error: 'Your transcript text could not be read. Upload a searchable PDF transcript, not a scanned or password-protected PDF.' }, 400);
    }
    const leaderTranscriptResult = verifyTranscriptEligibility(leaderTranscriptText);
    if (!leaderTranscriptResult.verification_result.is_eligible) {
      return c.json({
        success: false,
        error: `Your transcript is not eligible: ${leaderTranscriptResult.verification_result.rejection_reasons.join(' ')}`,
        transcript_verification: leaderTranscriptResult,
      }, 400);
    }

    for (const [index, member] of validatedMembers.entries()) {
      const label = `Group member ${index + 1}`;
      if (!isPdfDataUrl(member.internship_certificate)) {
        return c.json({ success: false, error: `${label}: Internship letter PDF is required.` }, 400);
      }
      if (!isPdfDataUrl(member.transcript_certificate)) {
        return c.json({ success: false, error: `${label}: Transcript PDF is required.` }, 400);
      }

      const memberTranscriptText = String(member.transcript_text || '').trim() || await extractTranscriptText(member.transcript_certificate);
      if (!memberTranscriptText.trim()) {
        return c.json({ success: false, error: `${label}: transcript text could not be read. Upload a searchable PDF transcript.` }, 400);
      }
      const memberTranscriptResult = verifyTranscriptEligibility(memberTranscriptText);
      member.transcript_verification = memberTranscriptResult;
      if (!memberTranscriptResult.verification_result.is_eligible) {
        return c.json({
          success: false,
          error: `${label} transcript is not eligible: ${memberTranscriptResult.verification_result.rejection_reasons.join(' ')}`,
          transcript_verification: memberTranscriptResult,
        }, 400);
      }
    }

    // 10. Check uniqueness of email and student_id_num
    const existingEmailApp = await c.env.DB.prepare(
      'SELECT id FROM student_applications WHERE email = ? AND status != "rejected"'
    ).bind(email.toLowerCase()).first();
    if (existingEmailApp) {
      return c.json({ success: false, error: 'An application with this email has already been submitted.' }, 409);
    }

    const existingEmailUser = await c.env.DB.prepare(
      'SELECT id FROM users WHERE email = ?'
    ).bind(email.toLowerCase()).first();
    if (existingEmailUser) {
      return c.json({ success: false, error: 'An account with this email already exists.' }, 409);
    }

    const existingStudentIdApp = await c.env.DB.prepare(
      'SELECT id FROM student_applications WHERE student_id_num = ? AND status != "rejected"'
    ).bind(student_id).first();
    if (existingStudentIdApp) {
      return c.json({ success: false, error: 'An application with this Student ID has already been submitted.' }, 409);
    }

    // A Student ID may belong to only ONE user, in any state. Block if this ID is
    // already taken by an existing (active/pending/rejected) account — otherwise a
    // second person could register with the same Student ID and the approval step
    // would resolve to the wrong account.
    if (student_id) {
      const sidOwner = await c.env.DB.prepare(
        `SELECT id, name, email, status FROM users
         WHERE student_id_num IS NOT NULL AND TRIM(student_id_num) = ?`
      ).bind(student_id).first() as Record<string, any> | null;
      if (sidOwner) {
        return c.json({
          success: false,
          error: sidOwner.status === 'pending'
            ? 'This Student ID already has a pending registration request.'
            : 'This Student ID is already registered to another user.',
          existing_status: sidOwner.status
        }, 409);
      }
    }

    const appId = generateId();
    const membersJson = JSON.stringify(validatedMembers);

    const isUrgent = typeof supervisor_priority === 'string' && supervisor_priority.toLowerCase().includes('urgent');
    const dbPriority = isUrgent ? 'Urgent' : 'Normal';
    const initialNotes = (typeof supervisor_priority === 'string' && supervisor_priority !== 'Normal' && supervisor_priority !== 'Urgent') ? `[Priority details: ${supervisor_priority}]` : null;

    const existingPendingUser = await c.env.DB.prepare(
      'SELECT id FROM users WHERE LOWER(email) = LOWER(?) OR student_id_num = ?'
    ).bind(email.toLowerCase().trim(), student_id).first();

    if (existingPendingUser) {
      const pendingUser = await c.env.DB.prepare(
        'SELECT id, status FROM users WHERE id = ?'
      ).bind(existingPendingUser.id as string).first() as Record<string, any> | null;

      if (pendingUser && pendingUser.status === 'pending') {
        return c.json({ success: false, error: 'This student already has a pending registration request.' }, 409);
      }
    }

    const pendingUserId = existingPendingUser?.id || generateId();
    if (!existingPendingUser) {
      await c.env.DB.prepare(
        `INSERT INTO users (id, email, name, role, department, student_id_num, program, shift, status)
         VALUES (?, ?, ?, 'student', ?, ?, ?, ?, 'pending')`
      ).bind(
        pendingUserId,
        email.toLowerCase().trim(),
        student_name,
        department,
        student_id,
        program,
        shift
      ).run();
    }

    await c.env.DB.prepare(
      `INSERT INTO student_applications (
        id, email, student_id_num, student_name, program, shift, department,
        internship_certificate, internship_filename, transcript_certificate, transcript_filename,
        transcript_text,
        group_name, project_title, abstract, problem_statement, objectives, methodology, technologies,
        group_members, supervisor_preference_1, supervisor_preference_2, supervisor_preference_3,
        supervisor_priority, admin_notes, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      appId,
      email.toLowerCase().trim(),
      student_id,
      student_name,
      program,
      shift,
      department,
      internship_certificate,
      internship_filename,
      transcript_certificate,
      transcript_filename,
      leaderTranscriptText,
      group_name,
      project_title,
      abstract || null,
      problem_statement || null,
      objectives || null,
      methodology || null,
      technologies || null,
      membersJson,
      supervisor_preference_1,
      supervisor_preference_2 || null,
      supervisor_preference_3 || null,
      dbPriority,
      initialNotes,
      'submitted'
    ).run();

    await logAuditEvent(c.env.DB, null, 'student', 'student_application_created', {
      entityType: 'student_application',
      entityId: String(appId),
      details: `Student application created for ${student_name}`,
      metadata: { application_id: appId, email: email.toLowerCase().trim(), project_title }
    });

    // Notify coordinator of new student application
    await notifyRole(c.env.DB, 'coordinator', {
      type: 'approval',
      title: 'New Public FYP Student Application',
      body: `${student_name} (${email}) has submitted an FYP application for "${project_title}".`,
      link_view: 'applications',
      ref_id: appId
    });

    // Email Notifications (Asynchronous dispatch via SMTP2GO)
    if (c.env.SMTP2GO_API_KEY) {
      const appUrl = resolveAppUrl(c.req.url, c.env);
      const leaderEmail = email.toLowerCase().trim();

      // 1. Email to Student Leader
      const leaderHtml = buildApplicationSubmittedLeaderEmail({
        leaderName: student_name,
        groupName: group_name,
        projectTitle: project_title,
        memberCount: validatedMembers.length,
        memberNames: validatedMembers.map((m) => m.name),
        supervisorPreference: supervisor_preference_1,
        actionUrl: appUrl,
      });

      const emailTasks: Promise<any>[] = [];

      emailTasks.push(
        sendEmail(c.env, {
          to: leaderEmail,
          subject: `[FYPilot] Application Received: ${group_name}`,
          html: leaderHtml,
        }).catch((e) => console.error('[Email] Error sending to leader:', e))
      );

      // 2. Email to each Group Member
      for (const m of validatedMembers) {
        if (!m.email) continue;
        const memberHtml = buildGroupMemberInvitationEmail({
          memberName: m.name,
          memberIdNum: m.student_id_num,
          memberEmail: m.email,
          leaderName: student_name,
          leaderEmail: leaderEmail,
          leaderStudentId: student_id,
          groupName: group_name,
          projectTitle: project_title,
          program,
          shift,
          department,
          actionUrl: appUrl,
        });
        emailTasks.push(
          sendEmail(c.env, {
            to: m.email,
            subject: `[FYPilot] ${student_name} has registered you for FYP Group: ${group_name}`,
            html: memberHtml,
          }).catch((e) => console.error(`[Email] Error sending to group member ${m.email}:`, e))
        );
      }

      // Crucial for Cloudflare Pages/Workers: await email tasks so runtime doesn't terminate before HTTP completes
      try {
        await Promise.allSettled(emailTasks);
      } catch (err) {
        console.error('[Email] Await error:', err);
      }
    }

    return c.json({
      success: true,
      data: {
        id: appId,
        email: email.toLowerCase().trim(),
        student_id_num: student_id,
        student_name,
        program,
        shift,
        department,
        group_name,
        project_title,
        status: 'submitted'
      },
      message: 'Application submitted successfully! Your application is now pending Admin Review.'
    }, 201);

  } catch (err: any) {
    console.error('Submit application error:', err);
    return c.json({ success: false, error: err?.message || 'Failed to submit application' }, 500);
  }
});

// DELETE /api/applications/bulk — remove EVERY student application.
// Registered before `/:id` so the literal path is matched first.
applicationRoutes.delete('/bulk', async (c) => {
  const actor = await requireBulkDeleteRole(c);
  if (!actor) {
    return c.json({ success: false, error: 'Only coordinators, HOD, Dean or admins can delete all applications' }, 403);
  }

  const body = await c.req.json().catch(() => ({} as any));
  if (body?.confirm !== 'DELETE ALL APPLICATIONS') {
    return c.json({ success: false, error: 'Confirmation phrase did not match' }, 400);
  }

  try {
    const rows = await c.env.DB.prepare('SELECT id FROM student_applications').all();
    const apps = (rows.results || []) as Array<Record<string, any>>;
    if (apps.length === 0) {
      return c.json({ success: true, message: 'There are no applications to delete.', deleted: 0 });
    }

    // Applications are standalone (no foreign keys), but approved ones already
    // produced real accounts — clear those so no orphan accounts remain.
    const ids = apps.map((a) => a.id);
    const idsJson = JSON.stringify(ids);
    const emails = await c.env.DB.prepare('SELECT email, student_id_num FROM student_applications').all();

    await c.env.DB.batch([
      c.env.DB.prepare('DELETE FROM student_applications WHERE id IN (SELECT value FROM json_each(?))').bind(idsJson),
    ]);

    for (const row of (emails.results || []) as Array<Record<string, any>>) {
      if (!row.email && !row.student_id_num) continue;
      await c.env.DB.prepare(
        `DELETE FROM users WHERE role = 'student' AND status != 'active' AND (email = ? OR student_id_num = ?)`
      ).bind(row.email || '', row.student_id_num || '').run();
    }

    await logAuditEvent(c.env.DB, actor.userId, actor.role, 'applications_deleted_all', {
      entityType: 'student_application',
      entityId: '*',
      details: `All ${apps.length} student application(s) deleted`,
      metadata: { scope: 'all', deleted_count: apps.length, application_ids: ids },
    });

    return c.json({
      success: true,
      message: `All ${apps.length} application(s) were deleted.`,
      deleted: apps.length,
    });
  } catch (e: any) {
    console.error('Delete all applications error:', e);
    return c.json({ success: false, error: 'Failed to delete all applications: ' + (e?.message || 'unknown error') }, 500);
  }
});

// POST /api/applications/verify-transcript
applicationRoutes.post('/verify-transcript', async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const rawText = typeof body?.raw_text === 'string' ? body.raw_text : typeof body?.transcript_text === 'string' ? body.transcript_text : '';
    const transcriptInput = body?.transcript_data_url || body?.transcript || body?.transcript_text || body?.transcriptDataUrl || body?.dataUrl || null;

    if (!rawText.trim() && !transcriptInput) {
      return c.json({
        success: false,
        error: 'Transcript content is required.'
      }, 400);
    }

    const extractedText = rawText.trim() || await extractTranscriptText(String(transcriptInput));
    if (!extractedText.trim()) {
      return c.json({
        success: false,
        error: 'Transcript text could not be read. The PDF may be scanned, image-only, or password-protected; upload a searchable transcript PDF.',
      }, 400);
    }
    const result = verifyTranscriptEligibility(extractedText);

    return c.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    return c.json({
      success: false,
      error: error?.message || 'Failed to verify transcript eligibility.'
    }, 500);
  }
});

// GET /api/applications — List applications for Admin / Coordinator
applicationRoutes.get('/', async (c) => {
  const userRole = c.req.header('X-User-Role');
  if (!isExecutiveRole(userRole) && userRole !== 'admin') {
    return c.json({ success: false, error: 'Only executive roles and administrators can view applications' }, 403);
  }

  const result = await c.env.DB.prepare(
    `SELECT a.id, a.email, a.student_id_num, a.student_name, a.program, a.shift, a.department,
            a.group_name, a.project_title, a.group_members, a.supervisor_preference_1,
            a.supervisor_preference_2, a.supervisor_preference_3, a.supervisor_priority,
            a.status, a.admin_notes, a.created_at,
            COALESCE(s1.name, a.supervisor_preference_1) as supervisor_1_name,
            COALESCE(s2.name, a.supervisor_preference_2) as supervisor_2_name,
            COALESCE(s3.name, a.supervisor_preference_3) as supervisor_3_name
     FROM student_applications a
     LEFT JOIN users s1 ON a.supervisor_preference_1 = s1.id OR a.supervisor_preference_1 = s1.name
     LEFT JOIN users s2 ON a.supervisor_preference_2 = s2.id OR a.supervisor_preference_2 = s2.name
     LEFT JOIN users s3 ON a.supervisor_preference_3 = s3.id OR a.supervisor_preference_3 = s3.name
     ORDER BY a.created_at DESC`
  ).all();

  return c.json({ success: true, data: result.results });
});

// GET /api/applications/:id — Detail of single application (including PDF certificate)
applicationRoutes.get('/:id', async (c) => {
  const id = c.req.param('id');
  const app = await c.env.DB.prepare(
    `SELECT a.*,
            COALESCE(s1.name, a.supervisor_preference_1) as supervisor_1_name,
            COALESCE(s2.name, a.supervisor_preference_2) as supervisor_2_name,
            COALESCE(s3.name, a.supervisor_preference_3) as supervisor_3_name
     FROM student_applications a
     LEFT JOIN users s1 ON a.supervisor_preference_1 = s1.id OR a.supervisor_preference_1 = s1.name
     LEFT JOIN users s2 ON a.supervisor_preference_2 = s2.id OR a.supervisor_preference_2 = s2.name
     LEFT JOIN users s3 ON a.supervisor_preference_3 = s3.id OR a.supervisor_preference_3 = s3.name
     WHERE a.id = ?`
  ).bind(id).first();

  if (!app) return c.json({ success: false, error: 'Application not found' }, 404);
  return c.json({ success: true, data: app });
});

// PUT /api/applications/:id/status — Admin Approve / Reject / Request Changes
applicationRoutes.put('/:id/status', async (c) => {
  const userRole = c.req.header('X-User-Role');
  if (!isExecutiveRole(userRole) && userRole !== 'admin') {
    return c.json({ success: false, error: 'Only executive roles and administrators can review applications' }, 403);
  }

  const id = c.req.param('id');
  const body = await c.req.json();
  const { status, admin_notes, password: adminPassword } = body;
  const provisioned_password = (adminPassword && adminPassword.length >= 6) ? adminPassword : 'student123';

  if (!['approved', 'rejected', 'revision_requested'].includes(status)) {
    return c.json({ success: false, error: 'Status must be approved, rejected, or revision_requested' }, 400);
  }

  try {
    const app = await c.env.DB.prepare('SELECT * FROM student_applications WHERE id = ?').bind(id).first() as Record<string, any> | null;
    if (!app) return c.json({ success: false, error: 'Application not found' }, 404);

    if (app.status === 'approved' && status === 'approved') {
      return c.json({ success: false, error: 'Application is already approved' }, 400);
    }

    if (status === 'approved') {
      if (!isPdfDataUrl(app.internship_certificate) || !isPdfDataUrl(app.transcript_certificate)) {
        return c.json({ success: false, error: 'Leader internship letter and transcript PDFs are required before approval.' }, 400);
      }
      const leaderTranscriptText = String(app.transcript_text || '').trim() || await extractTranscriptText(app.transcript_certificate);
      const leaderTranscriptResult = verifyTranscriptEligibility(leaderTranscriptText);
      if (!leaderTranscriptResult.verification_result.is_eligible) {
        return c.json({ success: false, error: `Leader transcript is not eligible: ${leaderTranscriptResult.verification_result.rejection_reasons.join(' ')}` }, 400);
      }

      let approvalMembers: Array<Record<string, any>> = [];
      try {
        approvalMembers = typeof app.group_members === 'string' ? JSON.parse(app.group_members) : (app.group_members || []);
      } catch {
        return c.json({ success: false, error: 'Group member data is invalid. Request a corrected registration.' }, 400);
      }
      if (!Array.isArray(approvalMembers)) {
        return c.json({ success: false, error: 'Group member data is invalid. Request a corrected registration.' }, 400);
      }
      for (const [index, member] of approvalMembers.entries()) {
        if (!isPdfDataUrl(member.internship_certificate) || !isPdfDataUrl(member.transcript_certificate)) {
          return c.json({ success: false, error: `Group member ${index + 1} is missing an internship letter or transcript PDF.` }, 400);
        }
        const memberTranscriptText = String(member.transcript_text || '').trim() || await extractTranscriptText(member.transcript_certificate);
        const memberTranscriptResult = verifyTranscriptEligibility(memberTranscriptText);
        if (!memberTranscriptResult.verification_result.is_eligible) {
          return c.json({ success: false, error: `Group member ${index + 1} transcript is not eligible: ${memberTranscriptResult.verification_result.rejection_reasons.join(' ')}` }, 400);
        }
      }

      await cleanupBrokenApprovalReferences(c.env.DB);

      // 1. Create Student User Account
      let studentId = generateId();
      // Resolve strictly by Student ID (the unique identity). Matching on
      // `email OR student_id_num` could attach the approval to an unrelated
      // account and overwrite its student ID.
      const sidOwner = await c.env.DB.prepare(
        `SELECT id, email FROM users
         WHERE student_id_num IS NOT NULL AND TRIM(student_id_num) = ?`
      ).bind(app.student_id_num).first() as Record<string, any> | null;

      // Fall back to the pending account created at application-submit time,
      // but only when it is genuinely this applicant (same email, no other ID).
      const emailOwner = await c.env.DB.prepare(
        'SELECT id, email, student_id_num FROM users WHERE LOWER(email) = LOWER(?)'
      ).bind(app.email).first() as Record<string, any> | null;
      const emailOwnerIsSamePerson = emailOwner &&
        String(emailOwner.student_id_num || '').trim() === String(app.student_id_num || '').trim();

      const existingUser = sidOwner || (emailOwnerIsSamePerson ? emailOwner : null);

      if (existingUser) {
        studentId = existingUser.id as string;
        await c.env.DB.prepare(
          `UPDATE users SET status = 'active', role = 'student', department = ?, student_id_num = ?, program = ?, shift = ?, password = COALESCE(password, ?), internship_certificate = ?, internship_filename = ?, transcript_certificate = ?, transcript_filename = ? WHERE id = ?`
        ).bind(app.department, app.student_id_num, app.program, app.shift, provisioned_password, app.internship_certificate, app.internship_filename, app.transcript_certificate, app.transcript_filename, studentId).run();
      } else {
        try {
          await c.env.DB.prepare(
            `INSERT INTO users (id, email, name, role, department, student_id_num, program, shift, status, password, internship_certificate, internship_filename, transcript_certificate, transcript_filename)
             VALUES (?, ?, ?, 'student', ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?)`
          ).bind(studentId, app.email, app.student_name, app.department, app.student_id_num, app.program, app.shift, provisioned_password, app.internship_certificate, app.internship_filename, app.transcript_certificate, app.transcript_filename).run();
        } catch (e) {
          // Unique index (0017) rejected a duplicate — re-resolve and reuse the owner.
          const msg = String((e as Error)?.message || e);
          if (!/UNIQUE constraint failed/i.test(msg)) throw e;
          const owner = await c.env.DB.prepare(
            `SELECT id FROM users WHERE student_id_num IS NOT NULL AND TRIM(student_id_num) = ?`
          ).bind(app.student_id_num).first() as Record<string, any> | null;
          if (!owner) throw e;
          studentId = owner.id as string;
          await c.env.DB.prepare(
            `UPDATE users SET status = 'active', role = 'student', department = ?, program = ?, shift = ?, password = COALESCE(password, ?) WHERE id = ?`
          ).bind(app.department, app.program, app.shift, provisioned_password, studentId).run();
        }
      }

      // 2. Create FYP Group
      const groupId = generateId();
      await c.env.DB.prepare(
        `INSERT INTO groups (id, name, leader_id, status) VALUES (?, ?, ?, 'approved')`
      ).bind(groupId, app.group_name, studentId).run();

      // Link leader to group_members
      await c.env.DB.prepare(
        `INSERT INTO group_members (id, group_id, user_id) VALUES (?, ?, ?)`
      ).bind(generateId(), groupId, studentId).run();

      // Handle dynamic team members if specified
      if (app.group_members) {
        try {
          const members = approvalMembers;
          if (Array.isArray(members)) {
            for (const m of members) {
              const memIdNum = String(m.student_id_num || m.student_id || '').trim();
              const memName = m.name || m.student_name;
              if (!memName || !memIdNum) continue;

              const memEmail = resolveMemberEmail(m, memIdNum);
              if (!memEmail) {
                console.error(`Skipped group member ${memName}: no usable email address`);
                continue;
              }

              // A Student ID may belong to only ONE user. Resolve strictly by
              // Student ID — the previous `student_id_num = ? OR email = ?` lookup
              // could match an unrelated account by email and then overwrite that
              // account's program/shift/password, effectively hijacking it.
              const sidOwner = await c.env.DB.prepare(
                `SELECT id, name, email, status FROM users
                 WHERE student_id_num IS NOT NULL AND TRIM(student_id_num) = ?`
              ).bind(memIdNum).first() as Record<string, any> | null;

              // The derived email may already be registered to a DIFFERENT person
              // (different Student ID). Never attach this member to them.
              const emailOwner = await c.env.DB.prepare(
                'SELECT id, student_id_num FROM users WHERE LOWER(email) = ?'
              ).bind(memEmail).first() as Record<string, any> | null;
              if (emailOwner && String(emailOwner.student_id_num || '').trim() !== memIdNum) {
                console.error(`Skipped group member ${memName}: email ${memEmail} belongs to another Student ID`);
                continue;
              }

              let memUserId: string;
              if (sidOwner) {
                memUserId = sidOwner.id as string;
                // Keep an existing password — only default it when none is set.
                await c.env.DB.prepare(
                  `UPDATE users SET status = 'active', role = 'student', department = ?,
                     program = ?, shift = ?, password = COALESCE(password, ?), internship_certificate = ?,
                     internship_filename = ?, transcript_certificate = ?, transcript_filename = ?
                   WHERE id = ?`
                ).bind(app.department, app.program, app.shift, provisioned_password, m.internship_certificate, m.internship_filename, m.transcript_certificate, m.transcript_filename, memUserId).run();
              } else {
                memUserId = generateId();
                await c.env.DB.prepare(
                  `INSERT INTO users (id, email, name, role, department, student_id_num, program, shift, status, password, internship_certificate, internship_filename, transcript_certificate, transcript_filename)
                   VALUES (?, ?, ?, 'student', ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?)`
                ).bind(memUserId, memEmail, memName, app.department, memIdNum, app.program, app.shift, provisioned_password, m.internship_certificate, m.internship_filename, m.transcript_certificate, m.transcript_filename).run();
              }

              const inGroup = await c.env.DB.prepare('SELECT id FROM group_members WHERE group_id = ? AND user_id = ?').bind(groupId, memUserId).first();
              if (!inGroup) {
                await c.env.DB.prepare('INSERT INTO group_members (id, group_id, user_id) VALUES (?, ?, ?)').bind(generateId(), groupId, memUserId).run();
              }
            }
          }
        } catch (e) {
          console.error('Error parsing group members:', e);
        }
      }

      // Find valid supervisor user ID for foreign keys
      let supervisorUserId: string | null = null;
      if (app.supervisor_preference_1) {
        const supUser = await c.env.DB.prepare(
          'SELECT id FROM users WHERE id = ? OR name = ? OR email = ?'
        ).bind(app.supervisor_preference_1, app.supervisor_preference_1, app.supervisor_preference_1).first();
        if (supUser) {
          supervisorUserId = supUser.id as string;
        }
      }

      // 3. Create Approved Proposal
      const proposalId = generateId();
      await c.env.DB.prepare(
        `INSERT INTO proposals (id, title, abstract, problem_statement, objectives, methodology, technologies, status, submitted_by, supervisor_id, group_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'approved', ?, ?, ?)`
      ).bind(
        proposalId,
        app.project_title,
        app.abstract || null,
        app.problem_statement || null,
        app.objectives || null,
        app.methodology || null,
        app.technologies || app.methodology || null,
        studentId,
        supervisorUserId,
        groupId
      ).run();

      // 4. Create Active Project
      const projectId = generateId();
      await c.env.DB.prepare(
        `INSERT INTO projects (id, title, description, proposal_id, status, health, progress, supervisor_id, department)
         VALUES (?, ?, ?, ?, 'active', 'healthy', 0, ?, ?)`
      ).bind(projectId, app.project_title, `FYP Project for ${app.group_name}`, proposalId, supervisorUserId, app.department).run();

      // 5. Add Project Members
      const allGroupMembers = await c.env.DB.prepare('SELECT user_id FROM group_members WHERE group_id = ?').bind(groupId).all();
      for (const row of (allGroupMembers.results || [])) {
        const memberId = (row as any).user_id;
        const memberExists = await c.env.DB.prepare('SELECT id FROM users WHERE id = ?').bind(memberId).first();
        if (!memberExists) continue;
        const inProject = await c.env.DB.prepare('SELECT id FROM project_members WHERE project_id = ? AND user_id = ?').bind(projectId, memberId).first();
        if (inProject) continue;
        await c.env.DB.prepare(
          `INSERT INTO project_members (id, project_id, user_id) VALUES (?, ?, ?)`
        ).bind(generateId(), projectId, memberId).run();
      }

      // 6. Update Application Status
      await c.env.DB.prepare(
        `UPDATE student_applications SET status = 'approved', admin_notes = ?, updated_at = datetime('now') WHERE id = ?`
      ).bind(admin_notes || app.admin_notes || 'Approved by Admin', id).run();
      await logAuditEvent(c.env.DB, c.req.header('X-User-Id') || 'system', userRole, 'student_application_approved', {
        entityType: 'student_application',
        entityId: String(id),
        details: `Student application approved for ${app.student_name}`,
        metadata: { application_id: id, student_email: app.email, project_title: app.project_title }
      });

      // 7. Send notification to student
      await createNotification(c.env.DB, studentId, {
        type: 'approval',
        title: 'FYP Application Approved!',
        body: `Congratulations ${app.student_name}! Your application for "${app.project_title}" has been approved. You now have portal access. Your login: ${app.email}`,
        link_view: 'dashboard',
        ref_id: projectId
      });

      // 8. Email notifications on Approval via SMTP2GO
      if (c.env.SMTP2GO_API_KEY) {
        const appUrl = resolveAppUrl(c.req.url, c.env);

        // (a) To Student Leader
        const leaderEmailHtml = buildApplicationDecisionEmail({
          recipientName: app.student_name,
          groupName: app.group_name,
          projectTitle: app.project_title,
          status: 'approved',
          role: 'leader',
          remarks: admin_notes || app.admin_notes,
          credentials: {
            email: app.email,
            password: provisioned_password,
          },
          actionUrl: appUrl,
        });

        const approvalEmailTasks: Promise<any>[] = [];

        approvalEmailTasks.push(
          sendEmail(c.env, {
            to: app.email,
            subject: `[FYPilot] Application Approved - Welcome to FYPilot!`,
            html: leaderEmailHtml,
          }).catch((e) => console.error('[Email] Error sending approval to leader:', e))
        );

        // (b) To Group Members
        if (app.group_members) {
          try {
            const members = typeof app.group_members === 'string' ? JSON.parse(app.group_members) : app.group_members;
            if (Array.isArray(members)) {
              for (const m of members) {
                const memName = m.name || m.student_name;
                const memIdNum = String(m.student_id_num || m.student_id || '').trim();
                const memEmail = resolveMemberEmail(m, memIdNum);

                if (memName && memEmail) {
                  const memberEmailHtml = buildApplicationDecisionEmail({
                    recipientName: memName,
                    groupName: app.group_name,
                    projectTitle: app.project_title,
                    status: 'approved',
                    role: 'member',
                    remarks: admin_notes || app.admin_notes,
                    credentials: {
                      email: memEmail,
                      password: provisioned_password,
                    },
                    actionUrl: appUrl,
                  });
                  approvalEmailTasks.push(
                    sendEmail(c.env, {
                      to: memEmail,
                      subject: `[FYPilot] FYP Group Approved - Welcome to FYPilot!`,
                      html: memberEmailHtml,
                    }).catch((e) => console.error(`[Email] Error sending approval to member ${memEmail}:`, e))
                  );
                }
              }
            }
          } catch (e) {
            console.error('[Email] Error dispatching to members:', e);
          }
        }

        // (c) To Assigned Supervisor
        if (supervisorUserId) {
          const supUser = await c.env.DB.prepare('SELECT name, email FROM users WHERE id = ?').bind(supervisorUserId).first() as { name?: string; email?: string } | null;
          if (supUser?.email) {
            const supEmailHtml = buildSupervisorAssignedEmail({
              supervisorName: supUser.name || 'Faculty Supervisor',
              groupName: app.group_name,
              projectTitle: app.project_title,
              studentLeaderName: app.student_name,
              studentLeaderEmail: app.email,
              department: app.department,
              actionUrl: appUrl,
            });
            approvalEmailTasks.push(
              sendEmail(c.env, {
                to: supUser.email,
                subject: `[FYPilot] New FYP Group Assigned: ${app.group_name}`,
                html: supEmailHtml,
              }).catch((e) => console.error('[Email] Error sending to supervisor:', e))
            );
          }
        }

        try {
          await Promise.allSettled(approvalEmailTasks);
        } catch (e) {
          console.error('[Email] Error awaiting approval emails:', e);
        }
      }

      return c.json({
        success: true,
        message: 'Application approved! Student account, group, proposal, and project created successfully.'
      });
    }

    // Update status for reject or revision_requested
    await c.env.DB.prepare(
      `UPDATE student_applications SET status = ?, admin_notes = ?, updated_at = datetime('now') WHERE id = ?`
    ).bind(status, admin_notes || app.admin_notes || null, id).run();
    await logAuditEvent(c.env.DB, c.req.header('X-User-Id') || 'system', userRole, status === 'rejected' ? 'student_application_rejected' : 'student_application_revision_requested', {
      entityType: 'student_application',
      entityId: String(id),
      details: `Student application status changed to ${status}`,
      metadata: { application_id: id, student_email: app.email, project_title: app.project_title, status }
    });

    // Email notification on Rejection or Revision Request via SMTP2GO
    if (c.env.SMTP2GO_API_KEY && app.email) {
      const appUrl = resolveAppUrl(c.req.url, c.env);
      const decisionSubject = `[FYPilot] Application Update: ${status === 'rejected' ? 'Application Rejected' : 'Revision Requested'}`;

      // (a) To Student Leader
      const decisionHtml = buildApplicationDecisionEmail({
        recipientName: app.student_name,
        groupName: app.group_name,
        projectTitle: app.project_title,
        status: status,
        role: 'leader',
        remarks: admin_notes || app.admin_notes,
        actionUrl: appUrl,
      });

      const decisionEmailTasks: Promise<any>[] = [];

      decisionEmailTasks.push(
        sendEmail(c.env, {
          to: app.email,
          subject: decisionSubject,
          html: decisionHtml,
        }).catch((e) => console.error('[Email] Error sending decision email:', e))
      );

      // (b) To Group Members — they were added by the leader, so they need the
      // outcome too rather than being left waiting indefinitely.
      if (app.group_members) {
        try {
          const members = typeof app.group_members === 'string' ? JSON.parse(app.group_members) : app.group_members;
          if (Array.isArray(members)) {
            for (const m of members) {
              const memName = m.name || m.student_name;
              const memIdNum = String(m.student_id_num || m.student_id || '').trim();
              const memEmail = resolveMemberEmail(m, memIdNum);
              if (!memName || !memEmail) continue;

              const memberDecisionHtml = buildApplicationDecisionEmail({
                recipientName: memName,
                groupName: app.group_name,
                projectTitle: app.project_title,
                status: status,
                role: 'member',
                remarks: admin_notes || app.admin_notes,
                actionUrl: appUrl,
              });
              decisionEmailTasks.push(
                sendEmail(c.env, {
                  to: memEmail,
                  subject: decisionSubject,
                  html: memberDecisionHtml,
                }).catch((e) => console.error(`[Email] Error sending decision email to member ${memEmail}:`, e))
              );
            }
          }
        } catch (e) {
          console.error('[Email] Error dispatching decision to members:', e);
        }
      }

      try {
        await Promise.allSettled(decisionEmailTasks);
      } catch (e) {
        console.error('[Email] Error awaiting decision emails:', e);
      }
    }

    return c.json({
      success: true,
      message: `Application status updated to ${status}.`
    });
  } catch (err: any) {
    console.error('Update application status error:', err);
    return c.json({ success: false, error: err?.message || 'Internal server error while processing approval' }, 500);
  }
});

export { applicationRoutes };
