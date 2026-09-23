-- Notifications: durable email outbox (audit finding #8).
-- Email delivery must survive the origin request lifecycle and be retried
-- independently by a worker. Channels are decoupled: the in-app inbox row is
-- written immediately, and only the *email* channel is enqueued here.
create table if not exists public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.notifications(id) on delete cascade,
  user_id uuid not null,
  channel text not null default 'email' check (channel in ('email', 'push')),
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'retry_wait', 'sent', 'failed')),
  attempts int not null default 0,
  to_email text,
  provider_message_id text,
  last_error text,
  next_attempt_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists notification_deliveries_due_idx
  on public.notification_deliveries (status, next_attempt_at);

-- Only the privileged service_role/admin client may touch the outbox.
-- Authenticated users never read or enqueue deliveries directly.
alter table public.notification_deliveries enable row level security;