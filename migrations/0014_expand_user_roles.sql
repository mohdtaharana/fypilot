-- Migration 0014: Allow executive roles HOD and Dean in the users table.
--
-- The rebuild of the users table moved into 0015, which already drops and recreates
-- every table that references users. Doing it here was impossible: D1 refuses
-- PRAGMA foreign_keys = OFF and PRAGMA writable_schema, and PRAGMA defer_foreign_keys
-- only defers the violation caused by "DROP TABLE users" until the migration ends,
-- where it still fails. Inside 0015 the users table can be dropped safely because all
-- of its child tables are dropped (and snapshotted) first, children before parents.
--
-- Kept as a separate file so migration 0014 stays recorded as applied on databases
-- that already ran it. The statement below is a no-op.

SELECT 1;
