-- Add kw_variation_index to campaigns for persistent keyword rotation
ALTER TABLE campaigns
ADD COLUMN kw_variation_index int NOT NULL DEFAULT 0; 