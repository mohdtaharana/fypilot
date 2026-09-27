-- Migration 0013: Add Transcript Certificate columns to student_applications
ALTER TABLE student_applications ADD COLUMN transcript_certificate TEXT;
ALTER TABLE student_applications ADD COLUMN transcript_filename TEXT;
