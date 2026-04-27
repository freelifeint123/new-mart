-- Track whether an admin account is still using its seeded "default"
-- credentials. Powers the optional first-login popup that asks the
-- super-admin to customise their username and/or password.
--
-- Defaults to FALSE so we do NOT pop the dialog at every existing admin
-- (sub-admins were created with custom credentials by a super-admin).
-- The seed code explicitly flips it to TRUE for the bootstrap super-admin
-- and the boot reconciliation path.

ALTER TABLE "admin_accounts"
  ADD COLUMN IF NOT EXISTS "default_credentials" boolean NOT NULL DEFAULT false;
