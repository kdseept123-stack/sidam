-- Add category, due_date, group_id to tasks
alter table public.tasks
  add column if not exists category text check (category in ('urgent', 'quick', 'longterm', 'reduce')),
  add column if not exists due_date date,
  add column if not exists group_id uuid references public.groups(id) on delete set null;

-- Drop old single policy and split into per-operation policies
drop policy if exists "tasks: own only" on public.tasks;

-- SELECT: own tasks + group members' tasks (if task has group_id)
create policy "tasks: select own or group" on public.tasks
  for select using (
    auth.uid() = user_id
    or (
      group_id is not null
      and exists (
        select 1 from public.group_members
        where group_members.group_id = tasks.group_id
          and group_members.user_id = auth.uid()
      )
    )
  );

create policy "tasks: insert own" on public.tasks
  for insert with check (auth.uid() = user_id);

create policy "tasks: update own" on public.tasks
  for update using (auth.uid() = user_id);

create policy "tasks: delete own" on public.tasks
  for delete using (auth.uid() = user_id);

-- Enable realtime for tasks (group sharing)
alter publication supabase_realtime add table public.tasks;
