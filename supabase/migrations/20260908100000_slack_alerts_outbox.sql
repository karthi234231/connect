-- Slack admin alerts: durable outbox (HOST-ASYNC-03, audit finding #225).
-- Slack webhooks called inline from a domain request can be silently dropped
-- on crash/timeout and have no retry. Domain services enqueue a row instead;
-- the queue worker drains it with claim/lease + bounded retry, mirroring the
-- notification_deliveries outbox (finding #8).
create table if not exists public.slack_alerts (
  id uuid primary key default gen_random_uuid(),
  dedupe_key text unique,
  text text not null,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'retry_wait', 'sent', 'failed')),
  attempts int not null default 0,
  last_error text,
  next_attempt_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists slack_alerts_due_idx
  on public.slack_alerts (status, next_attempt_at);

-- Service-role only. Alerts are system-generated; no user-facing table.
alter table public.slack_alerts enable row level security;
