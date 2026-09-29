/**
 * FYP external evaluation rubric — single source of truth.
 *
 * The API serves this to the evaluator form and validates submissions against
 * the exact same definition, so the displayed max marks and the accepted range
 * can never drift apart.
 *
 * Section and criterion labels are transcribed verbatim from the official
 * evaluation document. Do not paraphrase them here: the printed form and the
 * on-screen form must read identically.
 */

export type CriterionField = {
  key: string;
  label: string;
  hint?: string;
  max: number;
};

export type CriterionSection = {
  key: string;
  label: string;
  icon: string;
  max: number;
  fields: CriterionField[];
};

export const EVALUATION_SECTIONS: CriterionSection[] = [
  {
    key: 'project_content',
    label: 'Project/Thesis Content',
    icon: 'fa-file-lines',
    max: 30,
    fields: [
      { key: 'objectives', label: 'Clear definition of objectives', max: 6 },
      { key: 'literature', label: 'Research depth and quality of literature', max: 6 },
      { key: 'methodology', label: 'Design and implementation methodology', max: 6 },
      { key: 'results_analysis', label: 'Analysis of results', max: 6 },
      { key: 'innovation', label: 'Innovation/Originality', max: 6 },
    ],
  },
  {
    key: 'technical_proficiency',
    label: 'Technical Proficiency',
    icon: 'fa-code',
    max: 20,
    fields: [
      { key: 'coding_skills', label: 'Coding/Development skills', max: 7 },
      { key: 'tools_used', label: 'Use of relevant tools and technologies', max: 7 },
      { key: 'complexity', label: 'Complexity of problem solved', max: 6 },
    ],
  },
  {
    key: 'presentation_skills',
    label: 'Presentation Skills',
    icon: 'fa-microphone-lines',
    max: 15,
    fields: [
      { key: 'clarity', label: 'Clarity of presentation', max: 5 },
      { key: 'explanation', label: 'Ability to explain project', max: 5 },
      { key: 'qa_handling', label: 'Handling questions from examiners', max: 5 },
    ],
  },
  {
    key: 'report_quality',
    label: 'Report Quality',
    icon: 'fa-book-open',
    max: 10,
    fields: [
      { key: 'structure', label: 'Structure and organization', max: 3 },
      { key: 'conciseness', label: 'Clarity and conciseness', max: 4 },
      { key: 'citations', label: 'Proper citation and referencing', max: 3 },
    ],
  },
  {
    key: 'teamwork',
    label: 'Teamwork (External)',
    icon: 'fa-users',
    max: 5,
    fields: [
      { key: 'contribution', label: 'Collaboration and contribution of each member', max: 5 },
    ],
  },
  {
    key: 'overall_impact',
    label: 'Overall Impact (Internal)',
    icon: 'fa-bullseye',
    max: 20,
    fields: [
      { key: 'real_world_app', label: 'Potential for real-world application', max: 10 },
      { key: 'project_complexity', label: 'Project/Thesis complexity', max: 10 },
    ],
  },
];

/**
 * Sum of the itemised criterion maxima printed on the form. Derived, never
 * hardcoded, so the rubric and the denominator can never drift apart.
 */
export const RUBRIC_MAX_MARKS = EVALUATION_SECTIONS.reduce((sum, s) => sum + s.max, 0);

/**
 * Grand total the form is marked out of, as printed on the document.
 *
 * The obtained marks are reported as the plain sum of the criteria the examiner
 * awarded — no scaling, weighting or normalisation — so 77 awarded reads
 * 77/100 everywhere: on the form, in the stored record, in the email and on the
 * dashboard.
 */
export const DOCUMENT_TOTAL_MARKS = 100;

/** Denominator shown everywhere a total is displayed. */
export const TOTAL_MAX_MARKS = DOCUMENT_TOTAL_MARKS;

/** Section subtotals must equal the sum of their own fields, always. */
for (const section of EVALUATION_SECTIONS) {
  const fieldSum = section.fields.reduce((sum, f) => sum + f.max, 0);
  if (fieldSum !== section.max) {
    throw new Error(
      `Evaluation section "${section.key}" declares max ${section.max} but its fields sum to ${fieldSum}`
    );
  }
}

/**
 * The criteria must add up to the printed grand total, otherwise a flawless
 * evaluation could never reach 100/100. Checked at module load so a mistyped
 * maximum fails loudly instead of quietly capping every score.
 */
if (RUBRIC_MAX_MARKS !== DOCUMENT_TOTAL_MARKS) {
  throw new Error(
    `Evaluation criteria total ${RUBRIC_MAX_MARKS} but the form is marked out of ${DOCUMENT_TOTAL_MARKS}`
  );
}

/** section key -> { fieldKey: max } */
export const CRITERIA_LIMITS: Record<string, Record<string, number>> = Object.fromEntries(
  EVALUATION_SECTIONS.map((section) => [section.key, Object.fromEntries(section.fields.map((f) => [f.key, f.max]))])
);

export const SECTION_TOTAL_COLUMNS: Record<string, string> = {
  project_content: 'content_total',
  technical_proficiency: 'technical_total',
  presentation_skills: 'presentation_total',
  report_quality: 'report_total',
  teamwork: 'teamwork_total',
  overall_impact: 'impact_total',
};

// ===== Form header (document metadata block) =====

export type HeaderFieldType = 'text' | 'date' | 'readonly' | 'select';

export type HeaderField = {
  key: string;
  label: string;
  type: HeaderFieldType;
  required?: boolean;
  placeholder?: string;
  /** Choices for `type: 'select'`. */
  options?: string[];
  /** 2 = full width on the two-column metadata grid. */
  span?: 1 | 2;
};

/**
 * Every department the university runs, flattened from the BS/MS program and
 * shift matrix the application form already uses. Keeping the examiner to a
 * dropdown means the score sheet can be grouped by department later instead of
 * collecting a dozen spellings of "Computer Science".
 */
export const EVALUATION_DEPARTMENTS: string[] = [
  'Business Administration',
  'Accounting Banking & Finance',
  'Computer Science',
  'Software Engineering',
  'Artificial Intelligence & Mathematical Sciences',
  'Media & Communication Studies',
  'English',
  'Social and Development Studies',
  'Education',
  'Environmental Sciences',
];

export const EVALUATION_HEADER_FIELDS: HeaderField[] = [
  {
    key: 'department',
    label: 'Department',
    type: 'select',
    required: true,
    options: EVALUATION_DEPARTMENTS,
  },
  {
    key: 'degree_subject',
    label: 'Bachelor of Science in',
    type: 'select',
    required: true,
    options: EVALUATION_DEPARTMENTS,
  },
  { key: 'members', label: 'Group Members Names & IDs', type: 'readonly', span: 2 },
  { key: 'project_title', label: 'Project Title', type: 'readonly', span: 2 },
  { key: 'supervisor', label: 'Supervisor', type: 'readonly', span: 2 },
  { key: 'presentation_date', label: 'Date of Presentation', type: 'date' },
];

// ===== Form footer (document signature block) =====

export type FooterFieldType = 'textarea' | 'computed' | 'text' | 'signature';

export type FooterField = {
  key: string;
  label: string;
  type: FooterFieldType;
  required?: boolean;
  placeholder?: string;
};

export const EVALUATION_FOOTER_FIELDS: FooterField[] = [
  {
    key: 'comments',
    label: 'Comments and Suggestions',
    type: 'textarea',
    placeholder: 'Overall observations and recommendations…',
  },
  { key: 'total', label: 'Total Marks Obtained', type: 'computed' },
  { key: 'grade', label: 'Grade', type: 'computed' },
  { key: 'examiner_name', label: "Examiner's Name", type: 'text', required: true, placeholder: 'e.g., Dr. Jane Smith' },
  { key: 'signature_confirmed', label: "Examiner's Signature", type: 'signature' },
];

/** Text the examiner supplies outside the scored rubric. */
export const EVALUATION_TEXT_FIELDS = EVALUATION_FOOTER_FIELDS.filter(
  (f): f is FooterField & { type: 'text' | 'textarea' } => f.type === 'text' || f.type === 'textarea'
).map((f) => f.key);

export const MAX_TEXT_LENGTH: Record<string, number> = {
  department: 120,
  degree_subject: 120,
  presentation_date: 40,
  comments: 5000,
  examiner_name: 120,
};

export type ScoreValidation =
  | {
      ok: true;
      scores: Record<string, number>;
      sectionTotals: Record<string, number>;
      /** Plain sum of the criteria the examiner awarded, out of TOTAL_MAX_MARKS. */
      total: number;
      grade: string;
    }
  | { ok: false; errors: string[] };

/** Grade band applied to the grand total. */
export function gradeForScore(total: number): string {
  if (total >= 90) return 'A+';
  if (total >= 80) return 'A';
  if (total >= 70) return 'B';
  if (total >= 60) return 'C';
  if (total >= 50) return 'D';
  return 'F';
}

/**
 * Validate raw criterion input and compute every total from scratch.
 * The client-supplied totals are deliberately ignored.
 */
export function scoreEvaluation(input: Record<string, unknown>): ScoreValidation {
  const errors: string[] = [];
  const scores: Record<string, number> = {};
  const sectionTotals: Record<string, number> = {};

  for (const section of EVALUATION_SECTIONS) {
    let sectionSum = 0;
    for (const field of section.fields) {
      const raw = input[field.key];
      if (raw === undefined || raw === null || raw === '') {
        errors.push(`${field.label} is required`);
        continue;
      }
      const value = typeof raw === 'number' ? raw : Number(raw);
      if (!Number.isFinite(value)) {
        errors.push(`${field.label} must be a number`);
        continue;
      }
      if (value < 0 || value > field.max) {
        errors.push(`${field.label} must be between 0 and ${field.max}`);
        continue;
      }
      scores[field.key] = value;
      sectionSum += value;
    }
    sectionTotals[section.key] = sectionSum;
  }

  if (errors.length) return { ok: false, errors };

  const total = Object.values(sectionTotals).reduce((sum, v) => sum + v, 0);
  return { ok: true, scores, sectionTotals, total, grade: gradeForScore(total) };
}

/** Criteria payload consumed by the evaluator form. */
export function criteriaPayload() {
  return {
    sections: EVALUATION_SECTIONS,
    totalMax: TOTAL_MAX_MARKS,
    headerFields: EVALUATION_HEADER_FIELDS,
    footerFields: EVALUATION_FOOTER_FIELDS,
    grades: GRADE_BANDS,
  };
}

export const GRADE_BANDS: { grade: string; min: number }[] = [
  { grade: 'A+', min: 90 },
  { grade: 'A', min: 80 },
  { grade: 'B', min: 70 },
  { grade: 'C', min: 60 },
  { grade: 'D', min: 50 },
  { grade: 'F', min: 0 },
];
