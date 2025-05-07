-- Create campaign_links table
CREATE TABLE IF NOT EXISTS campaign_links (
    id SERIAL PRIMARY KEY,
    campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    link_url TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(campaign_id)
);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_campaign_links_campaign_id ON campaign_links(campaign_id);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_campaign_links_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_campaign_links_updated_at
    BEFORE UPDATE ON campaign_links
    FOR EACH ROW
    EXECUTE FUNCTION update_campaign_links_updated_at(); 
