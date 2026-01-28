-- Create test organization "CSAAS公司"
INSERT INTO organizations (name, radar_activated, created_at, updated_at)
VALUES ('CSAAS公司', false, NOW(), NOW())
ON CONFLICT DO NOTHING
RETURNING id, name, radar_activated;
