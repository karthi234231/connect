-- ============================================================
-- 012_connections.sql — People Connections (W3.5)
--
-- A people-first networking branch, separate from idea validation
-- (Web §6 "Connections flow"). Users can send/accept/decline
-- connection requests; an accepted request creates an ACTIVE match
-- so the pair can message each other.
--
-- Privacy/RLS model (§7.2/§7.3):
--   * connection_requests: requester manages own outbound request
--     (insert/cancel); addressee manages inbound request
--     (accept/decline). No other user can touch a row.
--   * No self-request (requester_id <> addressee_id).
--   * Suppression of blocked pairs is enforced in the service layer
--     (filterBlockedCandidates), not RLS.
-- ============================================================

-- Enum --------------------------------------------------------
create type public.connection_status as enum
  ('pending', 'accepted', 'declined');

-- connection_requests ------------------------------------------
create table public.connection_requests (
  id            uuid primary key default gen_random_uuid(),
  requester_id  uuid not null references public.profiles (id) on delete cascade,
  addressee_id  uuid not null references public.profiles (id) on delete cascade,
  status        public.connection_status not null default 'pending',
  message       text check (char_length(message) between 1 and 500),
  responded_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint connection_requests_no_self check (requester_id <> addressee_id),
  constraint connection_requests_pair_unique unique (requester_id, addressee_id)
);

create trigger connection_requests_touch_updated_at
  before update on public.connection_requests
  for each row execute function public.touch_updated_at();

create index connection_requests_requester_idx on public.connection_requests (requester_id);
create index connection_requests_addressee_idx on public.connection_requests (addressee_id);
create index connection_requests_status_idx on public.connection_requests (status);

-- RLS ----------------------------------------------------------
alter table public.connection_requests enable row level security;

-- Read: requester sees own outbound; addressee sees own inbound.
create policy "Connection requests are readable by requester or addressee"
  on public.connection_requests for select
  using (auth.uid() = requester_id or auth.uid() = addressee_id);

-- Insert: users can only send a request from themselves.
create policy "Users can send connection requests"
  on public.connection_requests for insert
  with check (auth.uid() = requester_id);

-- Update: requester can cancel own pending; addressee can accept/decline.
create policy "Requester can cancel own pending request"
  on public.connection_requests for update
  using (auth.uid() = requester_id and status = 'pending')
  with check (auth.uid() = requester_id and status = 'declined');

create policy "Addressee can accept or decline a request"
  on public.connection_requests for update
  using (auth.uid() = addressee_id and status = 'pending')
  with check (auth.uid() = addressee_id and status in ('accepted', 'declined'));

-- Delete: requester can cancel own pending request.
drop policy if exists "Requester can cancel own pending request" on public.connection_requests;
create policy "Requester can cancel own pending request"
  on public.connection_requests for delete
  using (auth.uid() = requester_id and status = 'pending');

-- Grants -------------------------------------------------------
grant select, insert, update, delete on public.connection_requests to authenticated;
grant select, insert, update, delete on public.connection_requests to service_role;
