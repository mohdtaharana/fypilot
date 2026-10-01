import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { WorkerMessageHandler } from 'pdfjs-dist/legacy/build/pdf.worker.mjs';

const pdfjs = pdfjsLib as any;
(globalThis as any).pdfjsWorker = { WorkerMessageHandler };

function decodeDataUrl(dataUrl: string): Uint8Array | null {
  if (!dataUrl || typeof dataUrl !== 'string') return null;
  const match = /^data:([^;,]+);base64,(.*)$/i.exec(dataUrl);
  if (!match) return null;
  const base64 = match[2] || '';
  const normalized = base64.replace(/\s/g, '');
  try {
    const binary = atob(normalized);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
  } catch {
    return null;
  }
}

async function extractPdfText(dataUrl: string): Promise<string> {
  const bytes = decodeDataUrl(dataUrl);
  if (!bytes) return '';

  try {
    const loadingTask = pdfjs.getDocument({ data: bytes });
    const pdf = await loadingTask.promise;
    let extractedText = '';

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      const pageText = (content.items || [])
        .map((item: any) => ('str' in item ? String(item.str) : ''))
        .join(' ');
      extractedText += `${pageText}\n`;
    }

    return extractedText;
  } catch (error) {
    console.error('Transcript PDF text extraction failed:', error);
    return '';
  }
}

function normalizeText(rawText: string): string {
  return String(rawText || '')
    .replace(/\r/g, '\n')
    .replace(/[\u00A0\t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function findFieldValue(text: string, labelPatterns: string[]): string {
  const normalized = normalizeText(text);
  const lines = normalized.split(/\n+/);

  for (const line of lines) {
    const lowerLine = line.toLowerCase();
    if (labelPatterns.some((pattern) => lowerLine.includes(pattern.toLowerCase()))) {
      const match = line.match(/[:\-]?(\s*)([A-Za-z0-9][A-Za-z0-9/().&\s'-]+)/i);
      if (match && match[2]) {
        return match[2].trim();
      }
    }
  }

  const joined = normalized.replace(/\s+/g, ' ');
  for (const pattern of labelPatterns) {
    const regex = new RegExp(`${pattern.replace(/[-/\^$*+?.()|[\]{}]/g, '\\$&')}\\s*[:\-]?\\s*([A-Za-z0-9][A-Za-z0-9/().&\\s'-]*)`, 'i');
    const match = joined.match(regex);
    if (match && match[1]) {
      return match[1].trim();
    }
  }

  return '';
}

function findName(text: string): string {
  const flattened = normalizeText(text).replace(/\s+/g, ' ');
  const labeledName = flattened.match(
    /(?:student\s+name|(?<!father's\s)\bname)\s*[:\-]?\s*([A-Z][A-Za-z.'\-]*(?:\s+[A-Z][A-Za-z.'\-]*){1,4})(?=\s+(?:father's\s+name|student\s*(?:id|number)|roll\s+no|program|degree|department|faculty|issue\s+date|date\s+of\s+admission|no\.?\s+of\s+credit\s+hours|semester\b)|$)/i
  );
  if (labeledName?.[1]) return labeledName[1].trim();

  const lines = normalizeText(text).split(/\n+/);
  for (const line of lines) {
    if (/student\s*(id|number|roll)|program|semester|cgpa/i.test(line)) continue;
    if (/[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,}/.test(line) && line.length > 3 && line.length < 80) {
      return line.trim();
    }
  }

  return '';
}

function findStudentId(text: string): string {
  const patterns = [
    /(?:student\s*id|student\s*number|roll\s*no|roll\s*number|id\s*no)\s*[:\-]?\s*([A-Za-z0-9-]+)/i,
    /([A-Z]{2,5}-\d{2}[A-Z]-\d{2,4}|[A-Z]{2,5}-\d{2}[A-Z]-\d{3,6})/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) return match[1].trim();
  }

  return '';
}

function findProgram(text: string): string {
  const flattened = normalizeText(text).replace(/\s+/g, ' ');
  const labeledProgram = flattened.match(
    /(?:degree\s+program|program|degree)\s*[:\-]?\s*(.+?)(?=\s+(?:issue\s+date|name|student\s+id|faculty|semester|shift|cgpa|no\.?\s+of\s+credit\s+hours)\b|$)/i
  );
  if (labeledProgram?.[1]) return labeledProgram[1].trim();

  const degree = flattened.match(/\b((?:BS|MS)\s+[A-Za-z0-9&/() .'-]+?)(?=\s+(?:issue\s+date|name|student\s+id|faculty|semester|shift|cgpa|no\.?\s+of\s+credit\s+hours)\b|$)/i);
  return degree?.[1]?.trim() || '';
}

function findCgpa(text: string): string {
  const match = text.match(/(?:CGPA|cumulative\s+gpa|gpa)\s*[:\-]?\s*([0-9]+(?:\.\d+)?)/i);
  if (match && match[1]) return match[1].trim();
  return '';
}

function parseSemesterRows(text: string): Record<number, number> {
  const rows: Record<number, number> = {};
  const flattened = normalizeText(text).replace(/\s+/g, ' ');
  const semesterMatches = Array.from(flattened.matchAll(/\bsemester\s*[-:]?\s*(\d{1,2})\b/gi));
  let previousCumulativeCredits = 0;

  for (let index = 0; index < semesterMatches.length; index += 1) {
    const match = semesterMatches[index];
    const semesterNumber = Number(match[1]);
    if (!semesterNumber || semesterNumber > 12) continue;

    const segmentStart = (match.index || 0) + match[0].length;
    const segmentEnd = semesterMatches[index + 1]?.index ?? flattened.length;
    const segment = flattened.slice(segmentStart, segmentEnd);
    const cumulativeTotal = segment.match(/\bgrand\s+total\b[\s\S]{0,100}?\b\d{1,5}\s+\d{1,5}\s+(\d{1,3})\s+cgpa\b/i);
    const semesterTotal = segment.match(/\btotal\s+marks\s+obtained\b[\s\S]{0,100}?\b\d{1,5}\s+\d{1,5}\s+(\d{1,3})\s+gpa\b/i);
    const explicitCredits = segment.match(/(?:^|\b)(\d{1,2}(?:\.\d+)?)\s*(?:credit(?:s|\s+hours?)?|cr\.?\s*hrs?\b)/i);
    const numbers = Array.from(segment.matchAll(/\d{1,3}(?:\.\d+)?/g)).map((number) => Number(number[0]));
    let creditCandidate: number | undefined;
    if (cumulativeTotal) {
      const cumulativeCredits = Number(cumulativeTotal[1]);
      creditCandidate = cumulativeCredits - previousCumulativeCredits;
      previousCumulativeCredits = cumulativeCredits;
    } else if (semesterTotal) {
      creditCandidate = Number(semesterTotal[1]);
    } else if (explicitCredits) {
      creditCandidate = Number(explicitCredits[1]);
    } else {
      creditCandidate = numbers.find((value) => value >= 9 && value <= 30);
    }

    if (typeof creditCandidate === 'number' && creditCandidate >= 9 && creditCandidate <= 30) {
      rows[semesterNumber] = creditCandidate;
    }
  }

  return rows;
}

function findTotalCreditHours(text: string, semesterCredits: Record<number, number>): number {
  const explicitMatches = [
    /(?:total\s+credit\s+hours|total\s+credits|earned\s+credit\s+hours|cumulative\s+credit\s+hours)\s*[:\-]?\s*(\d{1,3})/i,
    /credit\s+hours\s+earned\s*(?:up\s+to\s+semester\s+6|by\s+semester\s+6)?\s*[:\-]?\s*(\d{1,3})/i,
  ];

  for (const pattern of explicitMatches) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const value = Number(match[1]);
      if (!Number.isNaN(value)) return value;
    }
  }

  const sum = Object.values(semesterCredits).reduce((total, value) => total + value, 0);
  return sum || 0;
}

function evaluateTranscript(rawText: string) {
  const text = normalizeText(rawText);
  const name = findName(text) || '';
  const studentId = findStudentId(text) || '';
  const program = findProgram(text) || '';
  const cgpa = findCgpa(text) || '';

  const semesterCredits = parseSemesterRows(text);
  const completedSemesters = Object.keys(semesterCredits).length;

  const creditsBySemester6 = Object.entries(semesterCredits)
    .filter(([semester]) => Number(semester) <= 6)
    .reduce((sum, [, credit]) => sum + Number(credit || 0), 0);

  const totalCreditHours = findTotalCreditHours(text, semesterCredits) || creditsBySemester6;
  const actualAtSemester6 = Number(creditsBySemester6 || totalCreditHours || 0);

  const semestersRequired = 6;
  const creditsRequired = 90;
  const semestersPassed = completedSemesters >= semestersRequired;
  const creditsPassed = actualAtSemester6 >= creditsRequired;

  const rejectionReasons: string[] = [];
  if (!semestersPassed) {
    rejectionReasons.push(`Completed semesters below minimum requirement: ${completedSemesters} found, required ${semestersRequired}.`);
  }
  if (!creditsPassed) {
    rejectionReasons.push(`Cumulative credit hours at Semester 6 below minimum requirement: ${actualAtSemester6} found, required ${creditsRequired}.`);
  }

  return {
    student_info: {
      name,
      student_id: studentId,
      program,
      total_semesters_found: completedSemesters || 0,
      total_credit_hours_earned: totalCreditHours || 0,
      cgpa,
    },
    verification_result: {
      is_eligible: semestersPassed && creditsPassed,
      evaluations: {
        semesters_check: {
          required: semestersRequired,
          actual: completedSemesters || 0,
          passed: semestersPassed,
        },
        credit_hours_check: {
          required: creditsRequired,
          actual_at_semester_6: actualAtSemester6 || 0,
          passed: creditsPassed,
        },
      },
      rejection_reasons: rejectionReasons,
    },
  };
}

export async function extractTranscriptText(transcriptInput: string | null | undefined): Promise<string> {
  if (!transcriptInput || typeof transcriptInput !== 'string') return '';
  const trimmed = transcriptInput.trim();
  if (!trimmed) return '';

  if (trimmed.startsWith('data:')) {
    if (/application\/pdf|pdf/i.test(trimmed)) {
      return await extractPdfText(trimmed);
    }

    const base64Match = /^data:([^;,]+);base64,(.*)$/i.exec(trimmed);
    if (base64Match && base64Match[2]) {
      try {
        const binary = atob(base64Match[2].replace(/\s/g, ''));
        return new TextDecoder().decode(new Uint8Array(binary.length).map((_, index) => binary.charCodeAt(index)));
      } catch {
        return trimmed;
      }
    }
  }

  return trimmed;
}

export function verifyTranscriptEligibility(rawText: string): Record<string, any> {
  if (!rawText || !String(rawText).trim()) {
    return {
      student_info: {
        name: '',
        student_id: '',
        program: '',
        total_semesters_found: 0,
        total_credit_hours_earned: 0,
        cgpa: '',
      },
      verification_result: {
        is_eligible: false,
        evaluations: {
          semesters_check: {
            required: 6,
            actual: 0,
            passed: false,
          },
          credit_hours_check: {
            required: 90,
            actual_at_semester_6: 0,
            passed: false,
          },
        },
        rejection_reasons: ['No transcript content was provided for parsing and verification.'],
      },
    };
  }

  return evaluateTranscript(rawText);
}
