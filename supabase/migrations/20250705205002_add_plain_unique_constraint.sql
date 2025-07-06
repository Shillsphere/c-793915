-- Add a plain unique constraint for follow-up matching
ALTER TABLE connection_followups
  ADD CONSTRAINT connection_followups_campaign_id_prospect_profile_url_key
  UNIQUE (campaign_id, prospect_profile_url); 