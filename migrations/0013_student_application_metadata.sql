-- Migration 0013: Add registration-time project metadata fields to student applications

ALTER TABLE student_applications ADD COLUMN abstract TEXT;
ALTER TABLE student_applications ADD COLUMN problem_statement TEXT;
ALTER TABLE student_applications ADD COLUMN objectives TEXT;
ALTER TABLE student_applications ADD COLUMN methodology TEXT;
ALTER TABLE student_applications ADD COLUMN technologies TEXT;
