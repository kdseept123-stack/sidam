-- Fix infinite recursion in group_members RLS policies
-- group_members 정책이 자신을 참조하는 순환 참조 문제 해결
-- SECURITY DEFINER 함수를 통해 RLS를 우회하여 멤버십 확인

create or replace function public.is_group_member(p_group_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.group_members
    where group_id = p_group_id and user_id = p_user_id
  );
$$;

-- group_members 정책 재설정
drop policy if exists "group_members: members can read" on public.group_members;
create policy "group_members: members can read" on public.group_members
  for select using (public.is_group_member(group_members.group_id, auth.uid()));

-- groups 정책 재설정
drop policy if exists "groups: members can read" on public.groups;
create policy "groups: members can read" on public.groups
  for select using (public.is_group_member(groups.id, auth.uid()));

-- events 정책 재설정
drop policy if exists "events: members can read" on public.events;
drop policy if exists "events: members can insert" on public.events;
drop policy if exists "events: members can update" on public.events;
drop policy if exists "events: members can delete" on public.events;

create policy "events: members can read" on public.events
  for select using (public.is_group_member(events.group_id, auth.uid()));
create policy "events: members can insert" on public.events
  for insert with check (public.is_group_member(events.group_id, auth.uid()));
create policy "events: members can update" on public.events
  for update using (public.is_group_member(events.group_id, auth.uid()));
create policy "events: members can delete" on public.events
  for delete using (public.is_group_member(events.group_id, auth.uid()));

-- invite_codes 정책 재설정
drop policy if exists "invite_codes: members can read" on public.invite_codes;
drop policy if exists "invite_codes: members can insert" on public.invite_codes;

create policy "invite_codes: members can read" on public.invite_codes
  for select using (public.is_group_member(invite_codes.group_id, auth.uid()));
create policy "invite_codes: members can insert" on public.invite_codes
  for insert with check (public.is_group_member(invite_codes.group_id, auth.uid()));
