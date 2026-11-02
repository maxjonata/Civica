-- Cívica production schema for Supabase Postgres.
-- Tables live outside Supabase's exposed public schema and deny API roles.
CREATE SCHEMA IF NOT EXISTS civica;

CREATE TABLE civica.civica_civic_schema_migrations (
  version varchar(80) PRIMARY KEY,
  applied_at bigint NOT NULL
);

CREATE TABLE civica.civica_civic_sessions (
  token_hash char(64) PRIMARY KEY,
  csrf_hash char(64) NOT NULL,
  created_at bigint NOT NULL,
  expires_at bigint NOT NULL,
  rate_window_start bigint NOT NULL,
  mutation_count integer NOT NULL DEFAULT 0
);
CREATE INDEX idx_civic_session_expiry ON civica.civica_civic_sessions (expires_at);

CREATE TABLE civica.civica_civic_proposals (
  id uuid PRIMARY KEY,
  kind varchar(32) NOT NULL,
  title varchar(140) NOT NULL,
  summary varchar(320) NOT NULL,
  description text NOT NULL,
  desired_change text NOT NULL,
  municipality_code char(7),
  municipality varchar(120),
  state char(2),
  area_label varchar(120),
  public_location varchar(220),
  latitude numeric(9,6),
  longitude numeric(9,6),
  location_precision varchar(24) NOT NULL DEFAULT 'not_provided',
  pseudonym varchar(40),
  owner_scope_hash char(64) NOT NULL,
  status varchar(16) NOT NULL DEFAULT 'published',
  created_at bigint NOT NULL,
  updated_at bigint NOT NULL
);
CREATE INDEX idx_civic_proposals_status_created ON civica.civica_civic_proposals (status, created_at DESC);
CREATE INDEX idx_civic_proposals_municipality ON civica.civica_civic_proposals (municipality_code, status);
CREATE INDEX idx_civic_proposals_kind ON civica.civica_civic_proposals (kind, status);
CREATE INDEX idx_civic_proposals_search ON civica.civica_civic_proposals USING gin (to_tsvector('simple', title || ' ' || summary || ' ' || description));

CREATE TABLE civica.civica_civic_votes (
  proposal_id uuid NOT NULL REFERENCES civica.civica_civic_proposals(id) ON DELETE CASCADE,
  voter_scope_hash char(64) NOT NULL,
  choice varchar(24) NOT NULL,
  created_at bigint NOT NULL,
  updated_at bigint NOT NULL,
  PRIMARY KEY (proposal_id, voter_scope_hash)
);
CREATE INDEX idx_civic_votes_proposal_choice ON civica.civica_civic_votes (proposal_id, choice);

CREATE TABLE civica.civica_civic_comments (
  id uuid PRIMARY KEY,
  proposal_id uuid NOT NULL REFERENCES civica.civica_civic_proposals(id) ON DELETE CASCADE,
  stance varchar(32) NOT NULL,
  pseudonym varchar(40) NOT NULL,
  body text NOT NULL,
  status varchar(16) NOT NULL DEFAULT 'published',
  created_at bigint NOT NULL
);
CREATE INDEX idx_civic_comments_proposal_created ON civica.civica_civic_comments (proposal_id, status, created_at);

CREATE TABLE civica.civica_civic_claims (
  id uuid PRIMARY KEY,
  proposal_id uuid NOT NULL REFERENCES civica.civica_civic_proposals(id) ON DELETE CASCADE,
  category varchar(24) NOT NULL,
  claim_type varchar(32) NOT NULL,
  relation_label varchar(16) NOT NULL,
  statement_text text NOT NULL,
  source_title varchar(300),
  source_url varchar(1000),
  source_excerpt text,
  jurisdiction varchar(160),
  source_date char(10),
  submitted_at bigint NOT NULL,
  checked_at bigint,
  status varchar(24) NOT NULL DEFAULT 'community_submitted'
);
CREATE INDEX idx_civic_claims_proposal_submitted ON civica.civica_civic_claims (proposal_id, submitted_at);

CREATE TABLE civica.civica_civic_media (
  id uuid PRIMARY KEY,
  proposal_id uuid NOT NULL REFERENCES civica.civica_civic_proposals(id) ON DELETE CASCADE,
  owner_scope_hash char(64) NOT NULL,
  webp_bytes bytea NOT NULL,
  alt_text varchar(300) NOT NULL,
  width_px smallint NOT NULL,
  height_px smallint NOT NULL,
  status varchar(16) NOT NULL DEFAULT 'published',
  created_at bigint NOT NULL
);
CREATE INDEX idx_civic_media_proposal ON civica.civica_civic_media (proposal_id, status, created_at);

CREATE TABLE civica.civica_civic_region_submissions (
  proposal_id uuid NOT NULL REFERENCES civica.civica_civic_proposals(id) ON DELETE CASCADE,
  region_scope_hash char(64) NOT NULL,
  municipality_code char(7) NOT NULL,
  municipality varchar(120) NOT NULL,
  state char(2) NOT NULL,
  created_at bigint NOT NULL,
  PRIMARY KEY (proposal_id, region_scope_hash)
);
CREATE INDEX idx_civic_region_municipality ON civica.civica_civic_region_submissions (proposal_id, municipality_code);

CREATE TABLE civica.civica_civic_profile_submissions (
  scope_hash char(64) PRIMARY KEY,
  survey_version varchar(32) NOT NULL,
  profile_hash char(64) NOT NULL,
  submitted_at bigint NOT NULL
);

CREATE TABLE civica.civica_civic_profile_cohorts (
  survey_version varchar(32) NOT NULL,
  profile_hash char(64) NOT NULL,
  answers_json text NOT NULL,
  participant_count integer NOT NULL,
  updated_at bigint NOT NULL,
  PRIMARY KEY (survey_version, profile_hash)
);

CREATE TABLE civica.civica_civic_public_positions (
  id uuid PRIMARY KEY,
  actor_label varchar(180) NOT NULL,
  actor_role varchar(160) NOT NULL,
  topic varchar(80) NOT NULL,
  position_value smallint NOT NULL,
  source_title varchar(300) NOT NULL,
  source_url varchar(1000) NOT NULL,
  source_date char(10) NOT NULL,
  verification_status varchar(16) NOT NULL DEFAULT 'pending'
);
CREATE INDEX idx_civic_public_positions_verified ON civica.civica_civic_public_positions (verification_status, actor_label, topic);

-- Keep all tables inaccessible to Supabase API roles; access is through the server.
DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'civica_civic_schema_migrations', 'civica_civic_sessions', 'civica_civic_proposals',
    'civica_civic_votes', 'civica_civic_comments', 'civica_civic_claims', 'civica_civic_media',
    'civica_civic_region_submissions', 'civica_civic_profile_submissions',
    'civica_civic_profile_cohorts', 'civica_civic_public_positions'
  ] LOOP
    EXECUTE format('ALTER TABLE civica.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('REVOKE ALL ON TABLE civica.%I FROM anon, authenticated', table_name);
  END LOOP;
END $$;

REVOKE ALL ON SCHEMA civica FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA civica TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA civica TO service_role;

INSERT INTO civica.civica_civic_schema_migrations (version, applied_at)
VALUES ('0004_claim_submission_timestamps_v1', (extract(epoch FROM clock_timestamp()) * 1000)::bigint);
