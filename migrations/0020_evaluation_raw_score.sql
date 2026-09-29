-- The evaluation document is marked out of 100 while the itemised criteria sum
-- to 85, so total_score holds the normalised document marks and raw_score keeps
-- the actual sum of the printed criterion maxima for audit.
ALTER TABLE fyp_evaluations ADD COLUMN raw_score INTEGER;
