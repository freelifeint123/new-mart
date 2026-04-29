/* ──────────────────────────────────────────────────────────────────────────── */
/* 0051_otp_bypass_audit.sql — OTP Bypass Audit Log Table */
/* ──────────────────────────────────────────────────────────────────────────── */

/* ── OTP Bypass Audit Log ───────────────────────────────────────────────────── */
CREATE TABLE IF NOT EXISTS otp_bypass_audit (
  id VARCHAR(36) PRIMARY KEY,
  event_type VARCHAR(100) NOT NULL,
  /* E.g., 'otp_global_disable', 'otp_bypass_granted', 'login_per_user_bypass', 'login_global_bypass', 'login_whitelist_bypass' */
  
  user_id VARCHAR(36),
  admin_id VARCHAR(36),
  phone VARCHAR(20),
  email VARCHAR(255),
  bypass_reason VARCHAR(100),
  /* E.g., 'admin_action', 'global_disable', 'per_user_bypass', 'whitelist' */
  
  expires_at TIMESTAMP NULL,
  ip_address VARCHAR(45),
  user_agent VARCHAR(500),
  metadata JSON,
  
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_event_type (event_type),
  INDEX idx_user_id (user_id),
  INDEX idx_admin_id (admin_id),
  INDEX idx_created_at (created_at),
  INDEX idx_phone (phone),
  INDEX idx_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

/* ── Per-User OTP Bypass Column (if not already added) ──────────────────────── */
ALTER TABLE users ADD COLUMN IF NOT EXISTS otp_bypass_until TIMESTAMP NULL DEFAULT NULL;
ALTER TABLE users ADD INDEX IF NOT EXISTS idx_otp_bypass_until (otp_bypass_until);

/* ── Constraint on bypass_code format ─────────────────────────────────────────*/
ALTER TABLE whitelist_users ADD CONSTRAINT chk_bypass_code_format 
  CHECK (bypass_code REGEXP '^[0-9]{6}$');

COMMIT;
