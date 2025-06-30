CREATE TABLE public.job_logs (
  id BIGSERIAL PRIMARY KEY,
  campaign_id BIGINT REFERENCES public.campaigns(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT,
  details TEXT
);

