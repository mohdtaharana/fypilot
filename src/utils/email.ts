// FYPilot Email Service via SMTP2GO
import type { Env } from '../modules/ai/ai.types';

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: string;
}

export interface SendEmailResult {
  success: boolean;
  id?: string;
  error?: string;
  deliveredTo?: string | string[];
}

/**
 * Send an email using the SMTP2GO v3 REST API.
 *
 * SMTP2GO is used because it can deliver to arbitrary recipients (including
 * student addresses on any domain) without the sender owning a domain of their
 * own — the sender address only needs to be verified once in the SMTP2GO
 * dashboard. This is a real send; there is no rerouting or test-mode fallback.
 */
export async function sendEmail(
  env: Env,
  options: SendEmailOptions
): Promise<SendEmailResult> {
  const apiKey = (env.SMTP2GO_API_KEY || 'api-305973256B3C44A58AF85DB8AC226D5D').trim();
  if (!apiKey) {
    console.warn('[Email] SMTP2GO_API_KEY not configured. Skipping email dispatch.');
    return { success: false, error: 'SMTP2GO_API_KEY is not configured' };
  }

  const from = (options.from || env.EMAIL_FROM || env.SENDER_EMAIL || 'FYPilot <csc23s071@stu.smiu.edu.pk>').trim();
  if (!from) {
    console.warn('[Email] EMAIL_FROM not configured. Skipping email dispatch.');
    return { success: false, error: 'EMAIL_FROM is not configured' };
  }

  // Strip a display-name wrapper if one was supplied ("FYPilot <a@b.com>"),
  // since SMTP2GO expects a bare address in `sender`.
  const sender = extractAddress(from);
  if (!sender) {
    return { success: false, error: `EMAIL_FROM "${from}" is not a valid email address` };
  }

  const to = (Array.isArray(options.to) ? options.to : [options.to])
    .map((addr) => String(addr || '').trim())
    .filter((addr) => EMAIL_RE.test(addr));

  if (to.length === 0) {
    return { success: false, error: 'No valid recipient email address provided' };
  }

  // Always send one email per recipient so no one can see other recipients
  // in the To: header (SMTP2GO puts all `to` addresses in one email otherwise).
  if (to.length === 1) {
    const result = await callSmtp2GoApi(apiKey, sender, to, options.subject, options.html, options.text);
    if (result.success) {
      return { success: true, id: result.id, deliveredTo: to };
    }
    return { success: false, error: result.error };
  }

  // Multiple addresses supplied — send individually so each person only sees
  // their own address and gets a clean, private copy of the email.
  const ids: string[] = [];
  const failed: string[] = [];
  for (const addr of to) {
    const result = await callSmtp2GoApi(apiKey, sender, [addr], options.subject, options.html, options.text);
    if (result.success && result.id) {
      ids.push(result.id);
    } else {
      failed.push(`${addr}: ${result.error || 'unknown'}`);
    }
  }
  if (failed.length > 0 && ids.length === 0) {
    return { success: false, error: failed.join('; '), deliveredTo: [] };
  }
  return { success: true, id: ids[0], deliveredTo: to };
}

/**
 * Send a separate, fully personalized email to each recipient.
 * Each entry in `recipients` can carry its own html/text body, so every person
 * gets a unique email with only their name in the greeting — no one ever sees
 * another recipient's address or name.
 *
 * @param env   Cloudflare env bindings (must contain SMTP2GO_API_KEY, EMAIL_FROM)
 * @param recipients  Array of { email, subject, html, text? } — one item per person
 * @returns Summary: how many succeeded and any per-address errors
 */
export async function sendPersonalizedEmails(
  env: Env,
  recipients: Array<{ email: string; subject: string; html: string; text?: string }>
): Promise<{ successCount: number; failCount: number; errors: string[] }> {
  const errors: string[] = [];
  let successCount = 0;
  let failCount = 0;

  for (const r of recipients) {
    const result = await sendEmail(env, {
      to: r.email,
      subject: r.subject,
      html: r.html,
      text: r.text,
    });
    if (result.success) {
      successCount++;
    } else {
      errors.push(`${r.email}: ${result.error || 'unknown error'}`);
      failCount++;
    }
  }

  return { successCount, failCount, errors };
}


function extractAddress(value: string): string | null {
  const angle = value.match(/<([^>]+)>/);
  const addr = (angle ? angle[1] : value).trim();
  return EMAIL_RE.test(addr) ? addr : null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

async function callSmtp2GoApi(
  apiKey: string,
  sender: string,
  to: string[],
  subject: string,
  html: string,
  text?: string
): Promise<{ success: boolean; id?: string; error?: string; status?: number }> {
  try {
    const res = await fetch('https://api.smtp2go.com/v3/email/send', {
      method: 'POST',
      headers: {
        'X-Smtp2go-Api-Key': apiKey,
        'Content-Type': 'application/json',
        'accept': 'application/json',
      },
      body: JSON.stringify({
        sender,
        to,
        subject,
        html_body: html,
        ...(text ? { text_body: text } : {}),
      }),
    });

    const data = (await res.json().catch(() => ({}))) as any;

    if (!res.ok) {
      const errMsg = data?.data?.error || data?.error || data?.message || `HTTP ${res.status}`;
      return { success: false, error: errMsg, status: res.status };
    }

    // SMTP2GO returns HTTP 200 with a per-send error payload in some failure cases.
    const sendErrors = data?.data?.failed_sends;
    if (Array.isArray(sendErrors) && sendErrors.length > 0) {
      const reasons = sendErrors
        .map((f: any) => `${f?.email || 'recipient'}: ${f?.error || 'rejected'}`)
        .join('; ');
      return { success: false, error: reasons, status: res.status };
    }

    return { success: true, id: data?.data?.request_id, status: res.status };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Network error' };
  }
}

/**
 * Resolve the public base URL of the running app from the incoming request, so
 * email links point at the real deployment instead of a hardcoded localhost.
 * Falls back to APP_BASE_URL, then localhost for local dev.
 */
export function resolveAppUrl(requestUrl: string, env?: { APP_BASE_URL?: string }): string {
  const fallback = (env?.APP_BASE_URL || '').trim().replace(/\/+$/, '');
  let origin = '';
  try {
    const parsed = new URL(requestUrl);
    // Ignore internal/localhost origins so a tunnel or proxy header does not
    // produce unusable links in production.
    const isLocal = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1' || parsed.hostname === '::1';
    if (!isLocal) origin = parsed.origin;
  } catch {
    origin = '';
  }
  return origin || fallback || 'http://localhost:3000';
}

/**
 * Escape untrusted values before interpolating them into email HTML.
 * Member/leader names come from a public, unauthenticated form.
 */
export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// -------------------------------------------------------------
// FYPilot HTML Email Templates
// -------------------------------------------------------------

interface BaseTemplateOptions {
  title: string;
  badge?: { text: string; color: string; bg: string };
  contentHtml: string;
  actionButton?: { text: string; url: string };
  footerNote?: string;
}

function renderBaseTemplate(options: BaseTemplateOptions): string {
  const { title, badge, contentHtml, actionButton, footerNote } = options;

  const badgeHtml = badge
    ? `<span style="display:inline-block;padding:4px 10px;font-size:12px;font-weight:600;color:${badge.color};background-color:${badge.bg};border-radius:9999px;margin-bottom:12px;text-transform:uppercase;letter-spacing:0.05em;">${badge.text}</span>`
    : '';

  const actionHtml = actionButton
    ? `
      <div style="margin: 28px 0 10px; text-align: center;">
        <a href="${actionButton.url}" target="_blank" style="display: inline-block; background-color: #0284c7; color: #ffffff; font-weight: 600; font-size: 14px; text-decoration: none; padding: 12px 24px; border-radius: 8px; box-shadow: 0 2px 4px rgba(2, 132, 199, 0.2);">
          ${actionButton.text} &rarr;
        </a>
      </div>
    `
    : '';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; -webkit-font-smoothing: antialiased;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f1f5f9; padding: 32px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 580px; background-color: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%); padding: 24px 32px; text-align: left;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    <h1 style="margin: 0; color: #ffffff; font-size: 20px; font-weight: 700; letter-spacing: -0.02em;">
                      FYPilot <span style="font-weight: 400; font-size: 14px; opacity: 0.9;">| Intelligence Layer</span>
                    </h1>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 32px 32px 24px;">
              ${badgeHtml}
              <h2 style="margin: 0 0 16px; font-size: 20px; font-weight: 700; color: #0f172a; line-height: 1.3;">
                ${title}
              </h2>
              <div style="font-size: 15px; line-height: 1.6; color: #334155;">
                ${contentHtml}
              </div>
              ${actionHtml}
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding: 0 32px;">
              <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 0;">
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 32px; background-color: #fafafa; text-align: center; font-size: 12px; color: #64748b; line-height: 1.5;">
              <p style="margin: 0 0 4px;">
                ${footerNote || 'This is an automated notification from your FYPilot FYP Management Portal.'}
              </p>
              <p style="margin: 0; font-size: 11px; color: #94a3b8;">
                &copy; ${new Date().getFullYear()} FYPilot. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

/**
 * 1. Group Member Registration Invitation Email
 * Sent to each member added by the student leader, so they know who registered
 * them and the details of the group they were placed in.
 */
export function buildGroupMemberInvitationEmail(params: {
  memberName: string;
  memberIdNum?: string;
  memberEmail?: string;
  leaderName: string;
  leaderEmail: string;
  leaderStudentId?: string;
  groupName: string;
  projectTitle: string;
  program?: string;
  shift?: string;
  department?: string;
  actionUrl?: string;
}) {
  const memberName = escapeHtml(params.memberName);
  const leaderName = escapeHtml(params.leaderName);
  const content = `
    <p style="margin-top: 0;">Dear <strong>${memberName}</strong>,</p>
    <p>You have been registered for Final Year Project on FYPilot. <strong>${leaderName}</strong> (${escapeHtml(params.leaderEmail)}${params.leaderStudentId ? ` &middot; ${escapeHtml(params.leaderStudentId)}` : ''}) registered you as a member of their group.</p>

    <div style="background-color: #f8fafc; border-left: 4px solid #0284c7; padding: 14px 16px; margin: 20px 0; border-radius: 4px;">
      <div style="margin-bottom: 6px;"><strong style="color: #64748b; font-size: 12px; text-transform: uppercase;">FYP Group Name:</strong> <span style="font-weight: 600; color: #0f172a;">${escapeHtml(params.groupName)}</span></div>
      <div><strong style="color: #64748b; font-size: 12px; text-transform: uppercase;">Proposed Project:</strong> <span style="font-weight: 600; color: #0f172a;">${escapeHtml(params.projectTitle)}</span></div>
      ${params.memberIdNum ? `<div style="margin-top: 6px;"><strong style="color: #64748b; font-size: 12px; text-transform: uppercase;">Your Student ID:</strong> <span style="font-family: monospace; color: #0284c7;">${escapeHtml(params.memberIdNum)}</span></div>` : ''}
      ${params.memberEmail ? `<div><strong style="color: #64748b; font-size: 12px; text-transform: uppercase;">Your Email:</strong> <span style="font-family: monospace; color: #0284c7;">${escapeHtml(params.memberEmail)}</span></div>` : ''}
      ${params.program ? `<div><strong style="color: #64748b; font-size: 12px; text-transform: uppercase;">Program:</strong> <span style="font-weight: 600; color: #0f172a;">${escapeHtml(params.program)} (${escapeHtml(params.shift || '')} shift)</span></div>` : ''}
      ${params.department ? `<div><strong style="color: #64748b; font-size: 12px; text-transform: uppercase;">Department:</strong> <span style="font-weight: 600; color: #0f172a;">${escapeHtml(params.department)}</span></div>` : ''}
    </div>

    <p style="font-weight: 600; color: #0f172a;">What happens next</p>
    <ol style="margin: 8px 0 20px 20px; padding: 0; color: #334155; line-height: 1.7;">
      <li>The FYP Coordinator Committee is reviewing your group's registration request.</li>
      <li>Once approved, the coordinator sets your portal login and sends you the credentials by email at this address.</li>
      <li>After that you can sign in and collaborate with your team on the project.</li>
    </ol>

    <p style="color: #64748b; font-size: 13px;">If you were not expecting this, or the details above are wrong, simply ignore this email and reply to your team leader.</p>
  `;

  return renderBaseTemplate({
    title: 'You Have Been Registered for FYP',
    badge: { text: 'Group Member Registration', color: '#0284c7', bg: '#e0f2fe' },
    contentHtml: content,
    actionButton: params.actionUrl
      ? { text: 'View FYPilot Portal', url: params.actionUrl }
      : undefined,
  });
}

/**
 * 2. Leader Application Submission Confirmation
 */
export function buildApplicationSubmittedLeaderEmail(params: {
  leaderName: string;
  groupName: string;
  projectTitle: string;
  memberCount: number;
  memberNames?: string[];
  supervisorPreference: string;
  actionUrl?: string;
}) {
  const roster = (params.memberNames || []).filter(Boolean);
  const content = `
    <p style="margin-top: 0;">Dear <strong>${escapeHtml(params.leaderName)}</strong>,</p>
    <p>Your FYP registration and proposal submission has been received successfully!</p>

    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 18px; margin: 18px 0; font-size: 14px; line-height: 1.6;">
      <div><strong>Group Name:</strong> ${escapeHtml(params.groupName)}</div>
      <div><strong>Project Title:</strong> ${escapeHtml(params.projectTitle)}</div>
      <div><strong>Team Members:</strong> Leader + ${params.memberCount} member(s)</div>
      <div><strong>Supervisor Preference 1:</strong> ${escapeHtml(params.supervisorPreference)}</div>
      <div><strong>Current Status:</strong> <span style="color: #d97706; font-weight: 600;">Pending Coordinator Review</span></div>
    </div>

    ${roster.length ? `
    <p style="font-weight: 600; color: #0f172a; margin-bottom: 6px;">Members who were notified</p>
    <ul style="margin: 0 0 18px 20px; padding: 0; color: #334155; line-height: 1.7;">
      ${roster.map((n) => `<li>${escapeHtml(n)}</li>`).join('')}
    </ul>` : ''}

    <p>All members of your group have been notified by email. You will receive an email as soon as the coordinator approves or provides feedback on your application.</p>
  `;

  return renderBaseTemplate({
    title: 'FYP Application Submitted',
    badge: { text: 'Application Pending', color: '#d97706', bg: '#fef3c7' },
    contentHtml: content,
    actionButton: params.actionUrl
      ? { text: 'Check Application Status', url: params.actionUrl }
      : undefined,
  });
}

/**
 * 3. Application Decision (Approved / Rejected / Revision Requested)
 * Sent to Leader & Group Members when coordinator takes action.
 */
export function buildApplicationDecisionEmail(params: {
  recipientName: string;
  groupName: string;
  projectTitle: string;
  status: 'approved' | 'rejected' | 'revision_requested' | string;
  remarks?: string;
  role: 'leader' | 'member';
  credentials?: { email: string; password?: string };
  actionUrl?: string;
}) {
  const isApproved = params.status === 'approved';
  const isRejected = params.status === 'rejected';

  const badgeColor = isApproved ? '#16a34a' : isRejected ? '#dc2626' : '#d97706';
  const badgeBg = isApproved ? '#dcfce7' : isRejected ? '#fee2e2' : '#fef3c7';
  const statusLabel = isApproved
    ? 'Application Approved!'
    : isRejected
    ? 'Application Rejected'
    : 'Revision Requested';

  const credentialsBlock = isApproved && params.credentials
    ? `
      <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 14px 18px; margin: 20px 0;">
        <strong style="color: #166534; font-size: 13px; text-transform: uppercase;">Your FYPilot Login Credentials:</strong>
        <div style="font-size: 14px; margin-top: 6px;"><strong>Email:</strong> ${escapeHtml(params.credentials.email)}</div>
        ${params.credentials.password ? `<div style="font-size: 14px;"><strong>Password:</strong> <code style="background:#dcfce7;padding:2px 6px;border-radius:4px;font-family:monospace;">${escapeHtml(params.credentials.password)}</code></div>` : ''}
      </div>
    `
    : '';

  const remarksBlock = params.remarks
    ? `
      <div style="background-color: #f8fafc; border-left: 4px solid #0284c7; padding: 12px 16px; margin: 16px 0; border-radius: 4px;">
        <strong style="color: #0f172a; font-size: 12px; text-transform: uppercase;">Coordinator Remarks:</strong>
        <p style="margin: 6px 0 0; color: #334155; font-style: italic;">"${escapeHtml(params.remarks)}"</p>
      </div>
    `
    : '';

  const projectTitle = escapeHtml(params.projectTitle);
  const groupName = escapeHtml(params.groupName);

  const mainMessage = isApproved
    ? `Congratulations! Your FYP application for <strong>"${projectTitle}"</strong> (Group: <em>${groupName}</em>) has been <strong>approved</strong> by the coordinator.`
    : isRejected
    ? `Your FYP application for <strong>"${projectTitle}"</strong> (Group: <em>${groupName}</em>) was not approved.`
    : `The coordinator has requested revisions on your FYP application for <strong>"${projectTitle}"</strong>.`;

  const content = `
    <p style="margin-top: 0;">Dear <strong>${escapeHtml(params.recipientName)}</strong>,</p>
    <p>${mainMessage}</p>
    ${remarksBlock}
    ${credentialsBlock}
    <p>Please log in to the portal to view details and proceed with your project milestones.</p>
  `;

  return renderBaseTemplate({
    title: statusLabel,
    badge: { text: statusLabel, color: badgeColor, bg: badgeBg },
    contentHtml: content,
    actionButton: params.actionUrl
      ? {
          text: isApproved ? 'Log In to FYPilot' : 'View Portal',
          url: params.actionUrl,
        }
      : undefined,
  });
}

/**
 * 4. Supervisor Assignment Notification
 * Sent to Faculty Supervisor when an FYP group is assigned to them.
 */
export function buildSupervisorAssignedEmail(params: {
  supervisorName: string;
  groupName: string;
  projectTitle: string;
  studentLeaderName: string;
  studentLeaderEmail: string;
  department?: string;
  actionUrl?: string;
}) {
  const leaderEmail = escapeHtml(params.studentLeaderEmail);
  const content = `
    <p style="margin-top: 0;">Dear <strong>${escapeHtml(params.supervisorName)}</strong>,</p>
    <p>You have been assigned as the <strong>Faculty Supervisor</strong> for a newly approved FYP project:</p>

    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 18px; margin: 18px 0; font-size: 14px; line-height: 1.6;">
      <div><strong>Project Title:</strong> ${escapeHtml(params.projectTitle)}</div>
      <div><strong>FYP Group Name:</strong> ${escapeHtml(params.groupName)}</div>
      <div><strong>Team Leader:</strong> ${escapeHtml(params.studentLeaderName)} (<a href="mailto:${leaderEmail}" style="color: #0284c7;">${leaderEmail}</a>)</div>
      ${params.department ? `<div><strong>Department:</strong> ${escapeHtml(params.department)}</div>` : ''}
    </div>

    <p>You can now monitor the team's weekly progress, schedule meetings, and evaluate milestone deliverables through your supervisor dashboard.</p>
  `;

  return renderBaseTemplate({
    title: 'New FYP Group Assigned to You',
    badge: { text: 'Supervisor Assignment', color: '#0284c7', bg: '#e0f2fe' },
    contentHtml: content,
    actionButton: params.actionUrl
      ? { text: 'Open Supervisor Dashboard', url: params.actionUrl }
      : undefined,
  });
}

/**
 * 5. Security Alert: Audit Log Export / Download
 * Sent to HOD, Dean, and Coordinator when someone downloads audit logs.
 */
export function buildAuditLogExportAlertEmail(params: {
  exporterRole: string;
  exporterId?: string;
  format: string;
  timestamp: string;
  ip?: string;
  actionUrl?: string;
}) {
  const content = `
    <p style="margin-top: 0;"><strong>Security & Compliance Notice:</strong></p>
    <p>System audit logs were exported and downloaded from FYPilot:</p>

    <div style="background-color: #fff1f2; border: 1px solid #fecdd3; border-radius: 8px; padding: 14px 18px; margin: 18px 0; font-size: 14px; line-height: 1.6;">
      <div><strong>Actor Role:</strong> <span style="text-transform: uppercase; font-weight: bold; color: #be123c;">${escapeHtml(params.exporterRole)}</span></div>
      ${params.exporterId ? `<div><strong>User ID:</strong> <code style="background: #ffe4e6; padding: 2px 4px; border-radius: 3px;">${escapeHtml(params.exporterId)}</code></div>` : ''}
      <div><strong>Export Format:</strong> ${escapeHtml(params.format).toUpperCase()}</div>
      <div><strong>Timestamp:</strong> ${escapeHtml(params.timestamp)}</div>
      ${params.ip ? `<div><strong>Client IP:</strong> ${escapeHtml(params.ip)}</div>` : ''}
    </div>

    <p style="font-size: 13px; color: #64748b;">If this activity was unauthorized, please inspect the system audit trail immediately.</p>
  `;

  return renderBaseTemplate({
    title: 'Audit Logs Exported',
    badge: { text: 'Security Audit Alert', color: '#e11d48', bg: '#ffe4e6' },
    contentHtml: content,
    actionButton: params.actionUrl
      ? { text: 'View Audit Trail', url: params.actionUrl }
      : undefined,
  });
}

/**
 * 6. Standard In-App Notification Email wrapper
 */
export function buildNotificationEmail(params: {
  title: string;
  body: string;
  recipientName?: string;
  actionUrl?: string;
  actionText?: string;
}) {
  const greeting = params.recipientName ? `<p style="margin-top: 0;">Dear <strong>${escapeHtml(params.recipientName)}</strong>,</p>` : '';
  const content = `
    ${greeting}
    <p>${escapeHtml(params.body)}</p>
  `;

  return renderBaseTemplate({
    title: escapeHtml(params.title),
    badge: { text: 'Notification', color: '#0284c7', bg: '#e0f2fe' },
    contentHtml: content,
    actionButton: params.actionUrl
      ? { text: params.actionText || 'Open FYPilot', url: params.actionUrl }
      : undefined,
  });
}

/**
 * 7. Proposal Status Update Email
 */
export function buildProposalStatusEmail(params: {
  studentName: string;
  proposalTitle: string;
  status: 'approved' | 'rejected' | 'revision_requested' | string;
  remarks?: string;
  actionUrl?: string;
}) {
  const isApproved = params.status === 'approved';
  const isRejected = params.status === 'rejected';

  const badgeColor = isApproved ? '#16a34a' : isRejected ? '#dc2626' : '#d97706';
  const badgeBg = isApproved ? '#dcfce7' : isRejected ? '#fee2e2' : '#fef3c7';
  const statusLabel = isApproved
    ? 'Proposal Approved'
    : isRejected
    ? 'Proposal Rejected'
    : 'Revision Requested';

  const remarksBlock = params.remarks
    ? `
      <div style="background-color: #f8fafc; border-left: 4px solid #0284c7; padding: 12px 16px; margin: 16px 0; border-radius: 4px;">
        <strong style="color: #0f172a; font-size: 13px; text-transform: uppercase;">Reviewer Remarks:</strong>
        <p style="margin: 6px 0 0; color: #334155; font-style: italic;">"${escapeHtml(params.remarks)}"</p>
      </div>
    `
    : '';

  const content = `
    <p style="margin-top: 0;">Dear <strong>${escapeHtml(params.studentName)}</strong>,</p>
    <p>Your FYP proposal has been reviewed:</p>
    <div style="background-color: #f1f5f9; padding: 12px 16px; border-radius: 6px; margin: 12px 0;">
      <span style="font-size: 12px; color: #64748b; text-transform: uppercase; font-weight: 600;">Proposal Title</span>
      <div style="font-weight: 600; color: #0f172a; font-size: 15px; margin-top: 2px;">${escapeHtml(params.proposalTitle)}</div>
    </div>
    ${remarksBlock}
    <p>Please log in to your FYPilot dashboard to review details and take the next required steps.</p>
  `;

  return renderBaseTemplate({
    title: statusLabel,
    badge: { text: statusLabel, color: badgeColor, bg: badgeBg },
    contentHtml: content,
    actionButton: params.actionUrl
      ? { text: 'View Proposal in FYPilot', url: params.actionUrl }
      : undefined,
  });
}
