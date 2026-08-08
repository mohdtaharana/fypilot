-- User self-registration & coordinator approval workflow
-- Adds an approval status to the users table:
--   active  = approved, can use the platform
--   pending = registered but awaiting coordinator approval (can only register)
--   rejected = registration declined by coordinator

ALTER TABLE users ADD COLUMN status TEXT DEFAULT 'active' CHECK(status IN ('active', 'pending', 'rejected'));

CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
