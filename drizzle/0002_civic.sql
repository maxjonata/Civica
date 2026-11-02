CREATE TABLE IF NOT EXISTS civica_civic_schema_migrations (
  version VARCHAR(80) NOT NULL PRIMARY KEY,
  applied_at BIGINT UNSIGNED NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS civica_civic_sessions (
  token_hash CHAR(64) NOT NULL PRIMARY KEY,
  csrf_hash CHAR(64) NOT NULL,
  created_at BIGINT UNSIGNED NOT NULL,
  expires_at BIGINT UNSIGNED NOT NULL,
  rate_window_start BIGINT UNSIGNED NOT NULL,
  mutation_count INT UNSIGNED NOT NULL DEFAULT 0,
  KEY idx_civic_session_expiry (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS civica_civic_proposals (
  id CHAR(36) NOT NULL PRIMARY KEY,
  kind VARCHAR(32) NOT NULL,
  title VARCHAR(140) NOT NULL,
  summary VARCHAR(320) NOT NULL,
  description MEDIUMTEXT NOT NULL,
  desired_change TEXT NOT NULL,
  municipality_code CHAR(7) NOT NULL,
  municipality VARCHAR(120) NOT NULL,
  state CHAR(2) NOT NULL,
  area_label VARCHAR(120) NULL,
  public_location VARCHAR(220) NULL,
  latitude DECIMAL(9,6) NULL,
  longitude DECIMAL(9,6) NULL,
  location_precision VARCHAR(24) NOT NULL DEFAULT 'municipality',
  pseudonym VARCHAR(40) NULL,
  owner_scope_hash CHAR(64) NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'published',
  created_at BIGINT UNSIGNED NOT NULL,
  updated_at BIGINT UNSIGNED NOT NULL,
  KEY idx_civic_proposals_status_created (status, created_at),
  KEY idx_civic_proposals_municipality (municipality_code, status),
  KEY idx_civic_proposals_kind (kind, status),
  FULLTEXT KEY idx_civic_proposals_search (title, summary, description)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS civica_civic_votes (
  proposal_id CHAR(36) NOT NULL,
  voter_scope_hash CHAR(64) NOT NULL,
  choice VARCHAR(24) NOT NULL,
  created_at BIGINT UNSIGNED NOT NULL,
  updated_at BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (proposal_id, voter_scope_hash),
  KEY idx_civic_votes_proposal_choice (proposal_id, choice),
  CONSTRAINT fk_civic_votes_proposal FOREIGN KEY (proposal_id)
    REFERENCES civica_civic_proposals(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS civica_civic_comments (
  id CHAR(36) NOT NULL PRIMARY KEY,
  proposal_id CHAR(36) NOT NULL,
  stance VARCHAR(32) NOT NULL,
  pseudonym VARCHAR(40) NOT NULL,
  body TEXT NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'published',
  created_at BIGINT UNSIGNED NOT NULL,
  KEY idx_civic_comments_proposal_created (proposal_id, status, created_at),
  CONSTRAINT fk_civic_comments_proposal FOREIGN KEY (proposal_id)
    REFERENCES civica_civic_proposals(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS civica_civic_claims (
  id CHAR(36) NOT NULL PRIMARY KEY,
  proposal_id CHAR(36) NOT NULL,
  category VARCHAR(24) NOT NULL,
  claim_type VARCHAR(32) NOT NULL,
  relation_label VARCHAR(16) NOT NULL,
  statement_text TEXT NOT NULL,
  source_title VARCHAR(300) NULL,
  source_url VARCHAR(1000) NULL,
  source_excerpt TEXT NULL,
  jurisdiction VARCHAR(160) NULL,
  source_date CHAR(10) NULL,
  checked_at BIGINT UNSIGNED NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'community_submitted',
  KEY idx_civic_claims_proposal (proposal_id, checked_at),
  CONSTRAINT fk_civic_claims_proposal FOREIGN KEY (proposal_id)
    REFERENCES civica_civic_proposals(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS civica_civic_media (
  id CHAR(36) NOT NULL PRIMARY KEY,
  proposal_id CHAR(36) NOT NULL,
  owner_scope_hash CHAR(64) NOT NULL,
  webp_bytes LONGBLOB NOT NULL,
  alt_text VARCHAR(300) NOT NULL,
  width_px SMALLINT UNSIGNED NOT NULL,
  height_px SMALLINT UNSIGNED NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'published',
  created_at BIGINT UNSIGNED NOT NULL,
  KEY idx_civic_media_proposal (proposal_id, status, created_at),
  CONSTRAINT fk_civic_media_proposal FOREIGN KEY (proposal_id)
    REFERENCES civica_civic_proposals(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS civica_civic_region_submissions (
  proposal_id CHAR(36) NOT NULL,
  region_scope_hash CHAR(64) NOT NULL,
  municipality_code CHAR(7) NOT NULL,
  municipality VARCHAR(120) NOT NULL,
  state CHAR(2) NOT NULL,
  created_at BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (proposal_id, region_scope_hash),
  KEY idx_civic_region_municipality (proposal_id, municipality_code),
  CONSTRAINT fk_civic_region_proposal FOREIGN KEY (proposal_id)
    REFERENCES civica_civic_proposals(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS civica_civic_profile_submissions (
  scope_hash CHAR(64) NOT NULL PRIMARY KEY,
  survey_version VARCHAR(32) NOT NULL,
  profile_hash CHAR(64) NOT NULL,
  submitted_at BIGINT UNSIGNED NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS civica_civic_profile_cohorts (
  survey_version VARCHAR(32) NOT NULL,
  profile_hash CHAR(64) NOT NULL,
  answers_json TEXT NOT NULL,
  participant_count INT UNSIGNED NOT NULL,
  updated_at BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (survey_version, profile_hash)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS civica_civic_public_positions (
  id CHAR(36) NOT NULL PRIMARY KEY,
  actor_label VARCHAR(180) NOT NULL,
  actor_role VARCHAR(160) NOT NULL,
  topic VARCHAR(80) NOT NULL,
  position_value TINYINT NOT NULL,
  source_title VARCHAR(300) NOT NULL,
  source_url VARCHAR(1000) NOT NULL,
  source_date CHAR(10) NOT NULL,
  verification_status VARCHAR(16) NOT NULL DEFAULT 'pending',
  KEY idx_civic_public_positions_verified (verification_status, actor_label, topic)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO civica_civic_schema_migrations (version, applied_at)
VALUES ('0002_civic_v1', UNIX_TIMESTAMP() * 1000);
