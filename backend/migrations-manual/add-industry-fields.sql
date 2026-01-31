-- Migration: Add Industry Fields to RawContent
-- Story 3.1: Configure industry radar information sources
-- Run with: npm run typeorm migration:run

ALTER TABLE raw_contents
ADD COLUMN IF NOT EXISTS "contentType" varchar(50);

ALTER TABLE raw_contents
ADD COLUMN IF NOT EXISTS "peerName" varchar(255);

-- Add comments for documentation
COMMENT ON COLUMN raw_contents."contentType" IS 'Content type: article, recruitment, or conference (Story 3.1)';
COMMENT ON COLUMN raw_contents."peerName" IS 'Peer institution name for industry radar matching (Story 3.1)';
