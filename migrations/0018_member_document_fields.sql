-- Migration 0018: Persist uploaded internship/transcript docs on each student profile.
ALTER TABLE users ADD COLUMN internship_certificate TEXT;
ALTER TABLE users ADD COLUMN internship_filename TEXT;
ALTER TABLE users ADD COLUMN transcript_certificate TEXT;
ALTER TABLE users ADD COLUMN transcript_filename TEXT;
