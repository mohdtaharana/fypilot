-- Reports the plain sum of the awarded criteria against the printed 100-mark
-- grand total, with no scaling.
--
-- Migration 0021 rescaled rows from the 85-mark rubric onto 100, so
-- total_score is currently a derived figure while raw_score holds the sum the
-- examiner actually awarded. Restore that sum as the reported total and regrade
-- from it, so a 77-mark paper reads 77/100 rather than 90.6/100.
--
-- In SQLite every SET expression reads the pre-update row, so the grade CASE
-- below regrades the original raw_score.
UPDATE fyp_evaluations
SET total_score = raw_score,
    grade = CASE
      WHEN raw_score >= 90 THEN 'A+'
      WHEN raw_score >= 80 THEN 'A'
      WHEN raw_score >= 70 THEN 'B'
      WHEN raw_score >= 60 THEN 'C'
      WHEN raw_score >= 50 THEN 'D'
      ELSE 'F'
    END
WHERE raw_score IS NOT NULL
  AND total_score <> raw_score;
