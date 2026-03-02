-- Create plus_ones table to track individual +1 guests
create table public.plus_ones (
  id uuid default uuid_generate_v4() primary key,
  event_id uuid references public.events(id) on delete cascade not null,
  rsvp_response_id uuid references public.rsvp_responses(id) on delete cascade not null,
  guest_id uuid references public.guests(id) on delete set null, -- link to main guest if applicable
  name text not null,
  email text,
  status rsvp_status default 'pending' not null,
  invite_token text unique,
  invite_status invite_status default 'not_sent' not null,
  invite_sent_at timestamptz,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Indexes for performance
create index plus_ones_event_id_idx on public.plus_ones(event_id);
create index plus_ones_rsvp_response_id_idx on public.plus_ones(rsvp_response_id);
create index plus_ones_guest_id_idx on public.plus_ones(guest_id);
create index plus_ones_invite_token_idx on public.plus_ones(invite_token);

-- Trigger for updated_at
create trigger plus_ones_updated_at
  before update on public.plus_ones
  for each row execute function update_updated_at_column();

-- Enable RLS
alter table public.plus_ones enable row level security;

-- RLS policies
-- Hosts can view plus_ones for their events
create policy "Hosts can view plus_ones for their events"
  on public.plus_ones
  for select
  using (
    exists (
      select 1 from public.events
      where events.id = plus_ones.event_id
      and events.user_id = auth.uid()
    )
  );

-- Hosts can manage plus_ones for their events
create policy "Hosts can manage plus_ones for their events"
  on public.plus_ones
  for all
  using (
    exists (
      select 1 from public.events
      where events.id = plus_ones.event_id
      and events.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.events
      where events.id = plus_ones.event_id
      and events.user_id = auth.uid()
    )
  );

-- Add plus_ones_data JSONB field to rsvp_responses for storing names during RSVP
alter table public.rsvp_responses
  add column if not exists plus_ones_data jsonb default '[]'::jsonb;

-- Add comment explaining the field
comment on column public.rsvp_responses.plus_ones_data is 'Array of {name, email} objects for +1s collected during RSVP';
