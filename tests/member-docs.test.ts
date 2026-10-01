import { test } from 'node:test';
import assert from 'node:assert/strict';

import { validateMemberDocuments } from '../src/modules/groups/member-docs';

const validPdf = 'data:application/pdf;base64,JVBERi0xLjQK';

test('validateMemberDocuments accepts a student with both internship and transcript PDFs', async () => {
  const result = await validateMemberDocuments({
    internship_certificate: validPdf,
    internship_filename: 'internship.pdf',
    transcript_certificate: validPdf,
    transcript_filename: 'transcript.pdf',
    transcript_text: `
      Student Name: Rana Taha
      Student ID: CSC-23S-071
      Program: BS Computer Science
      Semester 1: 18 Credits
      Semester 2: 18 Credits
      Semester 3: 18 Credits
      Semester 4: 18 Credits
      Semester 5: 18 Credits
      Semester 6: 17 Credits
      Total Credit Hours Earned: 107
    `,
  });

  assert.equal(result.ok, true);
  assert.equal(result.error, null);
});

test('validateMemberDocuments rejects members missing either document', async () => {
  const result = await validateMemberDocuments({
    internship_certificate: validPdf,
    internship_filename: 'internship.pdf',
  });

  assert.equal(result.ok, false);
  assert.match(String(result.error), /transcript/i);
});

test('validateMemberDocuments rejects transcripts below the required semester and credit thresholds', async () => {
  const result = await validateMemberDocuments({
    internship_certificate: validPdf,
    internship_filename: 'internship.pdf',
    transcript_certificate: validPdf,
    transcript_filename: 'transcript.pdf',
    transcript_text: `
      Student Name: Ali Khan
      Student ID: CS-12B-002
      Program: BS Software Engineering
      Semester 1: 15 Credits
      Semester 2: 16 Credits
      Semester 3: 14 Credits
      Total Credit Hours Earned: 45
    `,
  });

  assert.equal(result.ok, false);
  assert.match(String(result.error), /semester|credit/i);
});
