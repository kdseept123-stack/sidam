-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Profiles (extends Supabase auth.users)
create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  display_name text not null,
  avatar_url text,
  expo_push_token text,
  reminder_minutes integer not null default 30,
  created_at timestamptz not null default now()
);

-- Groups
create table public.groups (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Group members
create table public.group_members (
  group_id uuid references public.groups(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  role text not null default 'member' check (role in ('admin', 'member')),
  notify_changes boolean not null default true,
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

-- Invite codes
create table public.invite_codes (
  code text primary key,
  group_id uuid references public.groups(id) on delete cascade not null,
  created_by uuid references public.profiles(id) on delete set null,
  expires_at timestamptz not null,
  used boolean not null default false,
  created_at timestamptz not null default now()
);

-- Events (shared calendar)
create table public.events (
  id uuid primary key default uuid_generate_v4(),
  group_id uuid references public.groups(id) on delete cascade not null,
  created_by uuid references public.profiles(id) on delete set null,
  title text not null,
  start_at timestamptz not null,
  end_at timestamptz,
  memo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Tasks (personal checklist)
create table public.tasks (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  title text not null,
  is_done boolean not null default false,
  date date not null,
  repeat_rule jsonb, -- null | { type: 'daily' | 'weekly' | 'custom', days?: number[] }
  source_event_id uuid references public.events(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Auto-update events.updated_at
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger events_updated_at
  before update on public.events
  for each row execute function public.set_updated_at();

-- Enable Realtime for events
alter publication supabase_realtime add table public.events;

-- ==================== RLS ====================

alter table public.profiles enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.invite_codes enable row level security;
alter table public.events enable row level security;
alter table public.tasks enable row level security;

-- Profiles: users can read all profiles (for displaying member names), only update own
create policy "profiles: read all" on public.profiles for select using (true);
create policy "profiles: update own" on public.profiles for update using (auth.uid() = id);
create policy "profiles: insert own" on public.profiles for insert with check (auth.uid() = id);

-- Groups: only members can read their group
create policy "groups: members can read" on public.groups
  for select using (
    exists (select 1 from public.group_members where group_id = groups.id and user_id = auth.uid())
  );
create policy "groups: authenticated can insert" on public.groups
  for insert with check (auth.uid() is not null);

-- Group members: members can read their group's member list
create policy "group_members: members can read" on public.group_members
  for select using (
    exists (select 1 from public.group_members gm where gm.group_id = group_members.group_id and gm.user_id = auth.uid())
  );
create policy "group_members: insert own" on public.group_members
  for insert with check (auth.uid() = user_id);
create policy "group_members: admin can delete" on public.group_members
  for delete using (
    auth.uid() = user_id or
    exists (select 1 from public.group_members gm where gm.group_id = group_members.group_id and gm.user_id = auth.uid() and gm.role = 'admin')
  );

-- Invite codes: members can read codes for their groups
create policy "invite_codes: members can read" on public.invite_codes
  for select using (
    exists (select 1 from public.group_members where group_id = invite_codes.group_id and user_id = auth.uid())
  );
create policy "invite_codes: members can insert" on public.invite_codes
  for insert with check (
    exists (select 1 from public.group_members where group_id = invite_codes.group_id and user_id = auth.uid())
  );

-- Events: only group members can read/write
create policy "events: members can read" on public.events
  for select using (
    exists (select 1 from public.group_members where group_id = events.group_id and user_id = auth.uid())
  );
create policy "events: members can insert" on public.events
  for insert with check (
    exists (select 1 from public.group_members where group_id = events.group_id and user_id = auth.uid())
  );
create policy "events: members can update" on public.events
  for update using (
    exists (select 1 from public.group_members where group_id = events.group_id and user_id = auth.uid())
  );
create policy "events: members can delete" on public.events
  for delete using (
    exists (select 1 from public.group_members where group_id = events.group_id and user_id = auth.uid())
  );

-- Tasks: users can only read/write own tasks
create policy "tasks: own only" on public.tasks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
