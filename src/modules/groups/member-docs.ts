export type MemberDocumentInput = Record<string, any>;

import { extractTranscriptText, verifyTranscriptEligibility } from '../applications/transcript-verifier';

export function isPdfDataUrl(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  return trimmed.startsWith('data:application/pdf;') || trimmed.includes('application/pdf');
}

export function resolveMemberDocumentValue(member: MemberDocumentInput | null | undefined, keys: string[]): string | null {
  if (!member) return null;
  for (const key of keys) {
    const val = member[key];
    if (typeof val === 'string' && val.trim()) return val.trim();
  }
  return null;
}

async function validateTranscriptDocument(member: MemberDocumentInput | null | undefined) {
  const transcriptText = resolveMemberDocumentValue(member, [
    'transcript_text',
    'transcript_text_data',
    'transcript_content',
    'academic_transcript_text',
    'transcript_data',
  ]);

  const transcriptUrl = resolveMemberDocumentValue(member, [
    'transcript_certificate',
    'transcript_certificate_pdf',
    'transcript',
    'transcript_pdf',
    'transcript_doc',
  ]);

  const rawTranscript = transcriptText || transcriptUrl || '';
  if (!rawTranscript) {
    return {
      ok: false,
      error: 'Each member must upload a valid academic transcript PDF before being added to the group.',
    };
  }

  try {
    const extractedText = rawTranscript.startsWith('data:') ? await extractTranscriptText(rawTranscript) : rawTranscript;
    const verification = verifyTranscriptEligibility(extractedText);
    if (!verification?.verification_result?.is_eligible) {
      const reasons = verification?.verification_result?.rejection_reasons?.length
        ? verification.verification_result.rejection_reasons.join(' ')
        : 'The transcript did not meet the minimum semester and credit-hour eligibility requirements.';
      return {
        ok: false,
        error: `Transcript validation failed: ${reasons}`,
      };
    }
  } catch (error) {
    return {
      ok: false,
      error: 'Unable to verify the transcript. Please upload a readable PDF transcript with at least 6 completed semesters and 90 credit hours.',
    };
  }

  return { ok: true, error: null };
}

export async function ensureUserDocumentColumns(db: { prepare: (query: string) => { all: () => Promise<any>; run: () => Promise<any> } }) {
  const tableInfo = await db.prepare('PRAGMA table_info(users)').all();
  const columns = new Set((tableInfo?.results || []).map((row: any) => String(row.name)));

  for (const column of [
    'internship_certificate',
    'internship_filename',
    'transcript_certificate',
    'transcript_filename',
  ]) {
    if (!columns.has(column)) {
      await db.prepare(`ALTER TABLE users ADD COLUMN ${column} TEXT`).run();
    }
  }
}

export async function validateMemberDocuments(member: MemberDocumentInput | null | undefined) {
  const internship = resolveMemberDocumentValue(member, [
    'internship_certificate',
    'internship_certificate_pdf',
    'internship_letter',
    'internship_letter_pdf',
    'internship_doc',
  ]);

  const transcript = resolveMemberDocumentValue(member, [
    'transcript_certificate',
    'transcript_certificate_pdf',
    'transcript',
    'transcript_pdf',
    'transcript_doc',
    'transcript_text',
    'transcript_text_data',
  ]);

  if (!internship || !isPdfDataUrl(internship)) {
    return {
      ok: false,
      error: 'Each member must upload a valid internship letter PDF before being added to the group.',
    };
  }

  if (!transcript || !isPdfDataUrl(transcript)) {
    return {
      ok: false,
      error: 'Each member must upload a valid academic transcript PDF before being added to the group.',
    };
  }

  const transcriptCheck = await validateTranscriptDocument(member);
  if (!transcriptCheck.ok) {
    return transcriptCheck;
  }

  return { ok: true, error: null };
}
