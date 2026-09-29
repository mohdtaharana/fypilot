-- Rows written before the 100-mark normalisation stored the raw rubric sum in
-- total_score (out of 85) and have no raw_score. Convert them in place so the
-- stored total, the displayed denominator and the grade all agree.
--
-- In SQLite every SET expression reads the pre-update row, so the grade CASE
-- below scales the original total_score, not the one assigned above it.
UPDATE fyp_evaluations
SET raw_score = total_score,
    total_score = ROUND(total_score * 100.0 / 85, 1),
    grade = CASE
      WHEN ROUND(total_score * 100.0 / 85, 1) >= 90 THEN 'A+'
      WHEN ROUND(total_score * 100.0 / 85, 1) >= 80 THEN 'A'
      WHEN ROUND(total_score * 100.0 / 85, 1) >= 70 THEN 'B'
      WHEN ROUND(total_score * 100.0 / 85, 1) >= 60 THEN 'C'
      WHEN ROUND(total_score * 100.0 / 85, 1) >= 50 THEN 'D'
      ELSE 'F'
    END
WHERE raw_score IS NULL AND total_score > 0;
