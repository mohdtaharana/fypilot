import { test } from 'node:test';
import assert from 'node:assert/strict';

import { extractTranscriptText, verifyTranscriptEligibility } from '../src/modules/applications/transcript-verifier';

const SAMPLE_TRANSCRIPT = `
Student Name: Rana Taha
Student ID: CSC-23S-071
Program: BS Computer Science
CGPA: 3.6

Semester 1: 18 Credits, SGPA 3.45
Semester 2: 18 Credits, SGPA 3.52
Semester 3: 18 Credits, SGPA 3.60
Semester 4: 18 Credits, SGPA 3.70
Semester 5: 18 Credits, SGPA 3.80
Semester 6: 17 Credits, SGPA 3.90
Semester 7: 18 Credits, SGPA 3.95

Total Credit Hours Earned: 107
`;

function createTextPdfDataUrl(text: string): string {
  const textLines = text.split('\n').map((line) => line.replace(/([\\()])/g, '\\$1'));
  const stream = `BT /F1 12 Tf\n72 720 Td\n${textLines.map((line, index) => `${index ? '0 -20 Td\n' : ''}(${line}) Tj\n`).join('')}ET`;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
  ];

  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (const [index, object] of objects.entries()) {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  }
  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('');
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return `data:application/pdf;base64,${btoa(pdf)}`;
}

test('verifyTranscriptEligibility accepts a student meeting both conditions', () => {
  const result = verifyTranscriptEligibility(SAMPLE_TRANSCRIPT);

  assert.equal(result.verification_result.is_eligible, true);
  assert.equal(result.verification_result.evaluations.semesters_check.actual, 7);
  assert.equal(result.verification_result.evaluations.credit_hours_check.actual_at_semester_6, 107);
  assert.deepEqual(result.verification_result.rejection_reasons, []);
});

test('verifyTranscriptEligibility rejects a student below the minimum semester or credit threshold', () => {
  const result = verifyTranscriptEligibility(`
  Student Name: Ali Khan
  Student ID: CS-12B-002
  Program: BS Software Engineering
  CGPA: 2.9
  Semester 1: 15 Credits
  Semester 2: 16 Credits
  Semester 3: 14 Credits
  Total Credit Hours Earned: 45
  `);

  assert.equal(result.verification_result.is_eligible, false);
  assert.equal(result.verification_result.evaluations.semesters_check.passed, false);
  assert.equal(result.verification_result.evaluations.credit_hours_check.passed, false);
  assert.ok(result.verification_result.rejection_reasons.length > 0);
});

test('verifyTranscriptEligibility parses semester rows from flattened PDF text', () => {
  const result = verifyTranscriptEligibility(
    'Student Name: Rana Taha Program: BS Computer Science Semester 1: 18 Credits, SGPA 3.45 Semester 2: 18 Credits, SGPA 3.52 Semester 3: 18 Credits, SGPA 3.60 Semester 4: 18 Credits, SGPA 3.70 Semester 5: 18 Credits, SGPA 3.80 Semester 6: 17 Credits, SGPA 3.90 Semester 7: 18 Credits, SGPA 3.95'
  );

  assert.equal(result.verification_result.is_eligible, true);
  assert.equal(result.verification_result.evaluations.semesters_check.actual, 7);
  assert.equal(result.verification_result.evaluations.credit_hours_check.actual_at_semester_6, 107);
});

test('verifyTranscriptEligibility does not count gaps in semester numbers as completed semesters', () => {
  const result = verifyTranscriptEligibility(
    'Student Name: Ali Khan Semester 1: 18 Credits Semester 7: 18 Credits Total Credit Hours Earned: 36'
  );

  assert.equal(result.verification_result.evaluations.semesters_check.actual, 2);
  assert.equal(result.verification_result.is_eligible, false);
});

test('verifyTranscriptEligibility reads SMIU cumulative Grand Total credit rows', () => {
  const result = verifyTranscriptEligibility(`
    Name: Rana Taha Taha Father's Name: Rana Khalid Mahmood
    Student ID / Enrl. / Reg.# CSC-23S-071
    Program: BS Computer Science
    No. of Credit Hours Earned 110
    Semester 1 Spring 2023 Total Marks Obtained 339 500 14 GPA 2.5 Grand Total 339 500 14 CGPA 2.5
    Semester 2 Fall 2023 Total Marks Obtained 421 600 16 GPA 2.79 Grand Total 760 1100 30 CGPA 2.65
    Semester 3 Spring 2024 Total Marks Obtained 508 600 17 GPA 3.51 Grand Total 1268 1700 47 CGPA 2.96
    Semester 4 Fall 2024 Total Marks Obtained 442 550 16 GPA 3.41 Grand Total 1710 2250 63 CGPA 3.08
    Semester 5 Spring 2025 Total Marks Obtained 421 550 16 GPA 3.25 Grand Total 2131 2800 79 CGPA 3.11
    Semester 6 Fall 2025 Total Marks Obtained 515 650 18 GPA 3.51 Grand Total 2646 3450 97 CGPA 3.19
    Semester 7 Spring 2026 Total Marks Obtained 382 500 13 GPA 3.2 Grand Total 3028 3950 110 CGPA 3.19
  `);

  assert.equal(result.verification_result.is_eligible, true);
  assert.equal(result.student_info.name, 'Rana Taha Taha');
  assert.equal(result.student_info.student_id, 'CSC-23S-071');
  assert.equal(result.student_info.program, 'BS Computer Science');
  assert.equal(result.student_info.total_semesters_found, 7);
  assert.equal(result.student_info.total_credit_hours_earned, 110);
  assert.equal(result.verification_result.evaluations.credit_hours_check.actual_at_semester_6, 97);
});

test('extractTranscriptText reads selectable text from a PDF data URL', async () => {
  const transcript = [
    'Student Name: Rana Taha',
    'Semester 1: 18 Credits',
    'Semester 2: 18 Credits',
    'Semester 3: 18 Credits',
    'Semester 4: 18 Credits',
    'Semester 5: 18 Credits',
    'Semester 6: 17 Credits',
  ].join('\n');
  const extracted = await extractTranscriptText(createTextPdfDataUrl(transcript));

  assert.match(extracted, /Student Name: Rana Taha/);
  const result = verifyTranscriptEligibility(extracted);
  assert.equal(result.verification_result.is_eligible, true, JSON.stringify({ extracted, result }));
});
