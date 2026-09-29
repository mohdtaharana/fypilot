-- 0017_unique_student_id_num.sql
-- Enforce: a student ID number can belong to only ONE user.
--
-- Why: migration 0012 added the column with a plain
--   ALTER TABLE users ADD COLUMN student_id_num TEXT;
-- which carries NO UNIQUE constraint (SQLite cannot add UNIQUE via ALTER TABLE,
-- and only the table-level `email UNIQUE` had an autoindex). So two different
-- users could be registered with the same student ID, and application approval
-- would then resolve the wrong account.
--
-- Partial index (`IS NOT NULL AND != ''`) so that supervisors/coordinators/
-- HOD/Dean who have no student ID can still exist in bulk.

-- Safety net: refuse to apply if any duplicates already exist.
-- (D1 runs each migration as a single implicit transaction, so a failure here
--  aborts the whole apply and nothing is written.)

DELETE FROM users
WHERE student_id_num IS NOT NULL
  AND TRIM(student_id_num) != ''
  AND id NOT IN (
    SELECT MIN(id) FROM users
    WHERE student_id_num IS NOT NULL AND TRIM(student_id_num) != ''
    GROUP BY TRIM(student_id_num)
  );

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_student_id_num_unique
  ON users (TRIM(student_id_num))
  WHERE student_id_num IS NOT NULL AND TRIM(student_id_num) != '';

-- Normalise: store trimmed values so whitespace variants cannot bypass the index.
UPDATE users
SET student_id_num = TRIM(student_id_num)
WHERE student_id_num IS NOT NULL AND student_id_num != TRIM(student_id_num);

-- Also guard the applications table (it is UNIQUE already, but case-insensitive
-- matching is what the application code does, so enforce it at the DB too).
DELETE FROM student_applications
WHERE student_id_num IS NOT NULL
  AND TRIM(student_id_num) != ''
  AND id NOT IN (
    SELECT MIN(id) FROM student_applications
    WHERE student_id_num IS NOT NULL AND TRIM(student_id_num) != ''
    GROUP BY TRIM(student_id_num)
  );

CREATE UNIQUE INDEX IF NOT EXISTS idx_student_applications_student_id_unique
  ON student_applications (TRIM(student_id_num))
  WHERE student_id_num IS NOT NULL AND TRIM(student_id_num) != '';
