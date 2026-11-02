ALTER TABLE civica_civic_claims
  ADD COLUMN submitted_at BIGINT UNSIGNED NULL AFTER checked_at;

UPDATE civica_civic_claims
SET submitted_at = checked_at
WHERE submitted_at IS NULL;

ALTER TABLE civica_civic_claims
  MODIFY COLUMN submitted_at BIGINT UNSIGNED NOT NULL,
  MODIFY COLUMN checked_at BIGINT UNSIGNED NULL DEFAULT NULL;

UPDATE civica_civic_claims
SET checked_at = NULL
WHERE status = 'community_submitted';

ALTER TABLE civica_civic_claims
  ADD KEY idx_civic_claims_proposal_submitted (proposal_id, submitted_at);

INSERT IGNORE INTO civica_civic_schema_migrations (version, applied_at)
VALUES ('0004_claim_submission_timestamps_v1', UNIX_TIMESTAMP() * 1000);
