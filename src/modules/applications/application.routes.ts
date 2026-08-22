import { Hono } from 'hono';
import type { Env } from '../ai/ai.types';
import { generateId } from '../ai/ai.utils';
import { createNotification, notifyRole } from '../notifications/notification.routes';

const applicationRoutes = new Hono<{ Bindings: Env }>();

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
    const group_name = (body.group_name || '').trim();
    const project_title = (body.project_title || '').trim();
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
    const isPdf = internship_certificate.startsWith('data:application/pdf;') ||
                  internship_certificate.includes('application/pdf') ||
                  (internship_filename && internship_filename.toLowerCase().endsWith('.pdf'));
    if (!isPdf) {
      return c.json({ success: false, error: 'Internship Certificate must be a PDF file' }, 400);
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

    const appId = generateId();
    const membersJson = JSON.stringify(Array.isArray(group_members) ? group_members : []);

    const isUrgent = typeof supervisor_priority === 'string' && supervisor_priority.toLowerCase().includes('urgent');
    const dbPriority = isUrgent ? 'Urgent' : 'Normal';
    const initialNotes = (typeof supervisor_priority === 'string' && supervisor_priority !== 'Normal' && supervisor_priority !== 'Urgent') ? `[Priority details: ${supervisor_priority}]` : null;

    await c.env.DB.prepare(
      `INSERT INTO student_applications (
        id, email, student_id_num, student_name, program, shift, department,
        internship_certificate, internship_filename, group_name, project_title,
        group_members, supervisor_preference_1, supervisor_preference_2, supervisor_preference_3,
        supervisor_priority, admin_notes, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'submitted')`
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
      group_name,
      project_title,
      membersJson,
      supervisor_preference_1,
      supervisor_preference_2 || null,
      supervisor_preference_3 || null,
      dbPriority,
      initialNotes
    ).run();

    // Notify coordinator of new student application
    await notifyRole(c.env.DB, 'coordinator', {
      type: 'approval',
      title: 'New Public FYP Student Application',
      body: `${student_name} (${email}) has submitted an FYP application for "${project_title}".`,
      link_view: 'applications',
      ref_id: appId
    });

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

// GET /api/applications — List applications for Admin / Coordinator
applicationRoutes.get('/', async (c) => {
  const userRole = c.req.header('X-User-Role');
  if (userRole !== 'coordinator' && userRole !== 'admin') {
    return c.json({ success: false, error: 'Only administrators can view applications' }, 403);
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
  if (userRole !== 'coordinator' && userRole !== 'admin') {
    return c.json({ success: false, error: 'Only administrators can review applications' }, 403);
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
      // 1. Create Student User Account
      let studentId = generateId();
      const existingUser = await c.env.DB.prepare('SELECT id FROM users WHERE email = ? OR student_id_num = ?').bind(app.email, app.student_id_num).first();
      
      if (existingUser) {
        studentId = existingUser.id as string;
        await c.env.DB.prepare(
          `UPDATE users SET status = 'active', role = 'student', department = ?, student_id_num = ?, program = ?, shift = ?, password = ? WHERE id = ?`
        ).bind(app.department, app.student_id_num, app.program, app.shift, provisioned_password, studentId).run();
      } else {
        await c.env.DB.prepare(
          `INSERT INTO users (id, email, name, role, department, student_id_num, program, shift, status, password)
           VALUES (?, ?, ?, 'student', ?, ?, ?, ?, 'active', ?)`
        ).bind(studentId, app.email, app.student_name, app.department, app.student_id_num, app.program, app.shift, provisioned_password).run();
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
          const members = typeof app.group_members === 'string' ? JSON.parse(app.group_members) : app.group_members;
          if (Array.isArray(members)) {
            for (const m of members) {
              const memIdNum = m.student_id_num || m.student_id;
              const memName = m.name || m.student_name;
              if (memName && memIdNum) {
                const memEmail = `${memIdNum.toLowerCase().replace(/[^a-z0-9]/g, '')}@stu.smiu.edu.pk`;
                let memUser = await c.env.DB.prepare('SELECT id FROM users WHERE student_id_num = ? OR email = ?').bind(memIdNum, memEmail).first();
                let memUserId = memUser ? (memUser.id as string) : generateId();
                if (memUser) {
                  await c.env.DB.prepare(
                    `UPDATE users SET status = 'active', role = 'student', department = ?, student_id_num = ?, program = ?, shift = ?, password = ? WHERE id = ?`
                  ).bind(app.department, memIdNum, app.program, app.shift, provisioned_password, memUserId).run();
                } else {
                  await c.env.DB.prepare(
                    `INSERT INTO users (id, email, name, role, department, student_id_num, program, shift, status, password)
                     VALUES (?, ?, ?, 'student', ?, ?, ?, ?, 'active', ?)`
                  ).bind(memUserId, memEmail, memName, app.department, memIdNum, app.program, app.shift, provisioned_password).run();
                }
                // Add to group if not already added
                const inGroup = await c.env.DB.prepare('SELECT id FROM group_members WHERE group_id = ? AND user_id = ?').bind(groupId, memUserId).first();
                if (!inGroup) {
                  await c.env.DB.prepare('INSERT INTO group_members (id, group_id, user_id) VALUES (?, ?, ?)').bind(generateId(), groupId, memUserId).run();
                }
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
        `INSERT INTO proposals (id, title, status, submitted_by, supervisor_id, group_id)
         VALUES (?, ?, 'approved', ?, ?, ?)`
      ).bind(proposalId, app.project_title, studentId, supervisorUserId, groupId).run();

      // 4. Create Active Project
      const projectId = generateId();
      await c.env.DB.prepare(
        `INSERT INTO projects (id, title, description, proposal_id, status, health, progress, supervisor_id, department)
         VALUES (?, ?, ?, ?, 'active', 'healthy', 0, ?, ?)`
      ).bind(projectId, app.project_title, `FYP Project for ${app.group_name}`, proposalId, supervisorUserId, app.department).run();

      // 5. Add Project Members
      const allGroupMembers = await c.env.DB.prepare('SELECT user_id FROM group_members WHERE group_id = ?').bind(groupId).all();
      for (const row of (allGroupMembers.results || [])) {
        await c.env.DB.prepare(
          `INSERT INTO project_members (id, project_id, user_id) VALUES (?, ?, ?)`
        ).bind(generateId(), projectId, (row as any).user_id).run();
      }

      // 6. Update Application Status
      await c.env.DB.prepare(
        `UPDATE student_applications SET status = 'approved', admin_notes = ?, updated_at = datetime('now') WHERE id = ?`
      ).bind(admin_notes || app.admin_notes || 'Approved by Admin', id).run();

      // 7. Send notification to student
      await createNotification(c.env.DB, studentId, {
        type: 'approval',
        title: 'FYP Application Approved!',
        body: `Congratulations ${app.student_name}! Your application for "${app.project_title}" has been approved. You now have portal access. Your login: ${app.email}`,
        link_view: 'dashboard',
        ref_id: projectId
      });

      return c.json({
        success: true,
        message: 'Application approved! Student account, group, proposal, and project created successfully.'
      });
    }

    // Update status for reject or revision_requested
    await c.env.DB.prepare(
      `UPDATE student_applications SET status = ?, admin_notes = ?, updated_at = datetime('now') WHERE id = ?`
    ).bind(status, admin_notes || app.admin_notes || null, id).run();

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
