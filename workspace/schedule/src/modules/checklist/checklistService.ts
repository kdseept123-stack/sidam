import { supabase } from '../../lib/supabase';
import { format, startOfWeek, endOfWeek } from 'date-fns';

export type Category = 'urgent' | 'quick' | 'longterm' | 'reduce';

export type RepeatRule =
  | null
  | { type: 'daily' }
  | { type: 'weekly'; days: number[] }
  | { type: 'custom'; days: number[] };

export interface Task {
  id: string;
  user_id: string;
  title: string;
  is_done: boolean;
  date: string;
  due_date: string | null;
  category: Category | null;
  group_id: string | null;
  repeat_rule: RepeatRule;
  source_event_id: string | null;
  created_at: string;
  profiles?: { display_name: string };
}

export interface TodayStats {
  total: number;
  done: number;
  remaining: number;
}

export interface CategorySummary {
  category: Category;
  count: number;
  topTitle: string | null;
}

export interface MemberTaskCount {
  user_id: string;
  display_name: string;
  remaining: number;
}

export async function getTasksForToday(userId: string): Promise<Task[]> {
  const today = format(new Date(), 'yyyy-MM-dd');
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('user_id', userId)
    .eq('date', today)
    .order('created_at');
  if (error) throw error;
  return (data ?? []) as Task[];
}

export async function getTodayStats(userId: string): Promise<TodayStats> {
  const tasks = await getTasksForToday(userId);
  const done = tasks.filter(t => t.is_done).length;
  return { total: tasks.length, done, remaining: tasks.length - done };
}

export async function getWeekCategorySummary(groupId: string): Promise<CategorySummary[]> {
  const now = new Date();
  const weekStart = format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd');
  const weekEnd = format(endOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd');

  const { data, error } = await supabase
    .from('tasks')
    .select('category, title, is_done')
    .eq('group_id', groupId)
    .eq('is_done', false)
    .not('category', 'is', null)
    .gte('date', weekStart)
    .lte('date', weekEnd);

  if (error) throw error;
  const tasks = (data ?? []) as { category: Category; title: string; is_done: boolean }[];

  const categories: Category[] = ['urgent', 'quick', 'longterm', 'reduce'];
  return categories.map(cat => {
    const matching = tasks.filter(t => t.category === cat);
    return {
      category: cat,
      count: matching.length,
      topTitle: matching[0]?.title ?? null,
    };
  });
}

export async function getMemberTaskCounts(groupId: string): Promise<MemberTaskCount[]> {
  const today = format(new Date(), 'yyyy-MM-dd');

  const { data, error } = await supabase
    .from('tasks')
    .select('user_id, profiles(display_name)')
    .eq('group_id', groupId)
    .eq('is_done', false)
    .gte('date', today);

  if (error) throw error;
  const rows = (data ?? []) as { user_id: string; profiles: { display_name: string }[] | { display_name: string } | null }[];

  const map: Record<string, MemberTaskCount> = {};
  for (const r of rows) {
    const name = Array.isArray(r.profiles)
      ? (r.profiles[0]?.display_name ?? '알 수 없음')
      : (r.profiles?.display_name ?? '알 수 없음');
    if (!map[r.user_id]) {
      map[r.user_id] = { user_id: r.user_id, display_name: name, remaining: 0 };
    }
    map[r.user_id].remaining += 1;
  }
  return Object.values(map);
}

export async function getAllActiveTasks(userId: string): Promise<Task[]> {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('user_id', userId)
    .eq('is_done', false)
    .order('created_at');
  if (error) throw error;
  return (data ?? []) as Task[];
}

export async function createTask(
  userId: string,
  title: string,
  repeatRule: RepeatRule = null,
  category: Category | null = null,
  dueDate: string | null = null,
  groupId: string | null = null,
): Promise<Task> {
  const today = format(new Date(), 'yyyy-MM-dd');
  const { data, error } = await supabase
    .from('tasks')
    .insert({
      user_id: userId,
      title,
      date: dueDate ?? today,
      due_date: dueDate,
      category,
      group_id: groupId,
      repeat_rule: repeatRule,
    })
    .select()
    .single();
  if (error) throw error;
  return data as Task;
}

export async function importEventAsTask(
  userId: string,
  eventId: string,
  title: string,
  eventDate: string,
): Promise<Task> {
  const { data, error } = await supabase
    .from('tasks')
    .insert({ user_id: userId, title, date: eventDate, source_event_id: eventId })
    .select()
    .single();
  if (error) throw error;
  return data as Task;
}

export async function toggleTask(id: string, isDone: boolean): Promise<void> {
  const { error } = await supabase.from('tasks').update({ is_done: isDone }).eq('id', id);
  if (error) throw error;
}

export async function deleteTask(id: string): Promise<void> {
  const { error } = await supabase.from('tasks').delete().eq('id', id);
  if (error) throw error;
}

export function expandRepeatRuleForDate(rule: RepeatRule, date: Date): boolean {
  if (!rule) return false;
  const day = date.getDay();
  if (rule.type === 'daily') return true;
  if (rule.type === 'weekly') return rule.days.includes(day);
  if (rule.type === 'custom') return rule.days.includes(day);
  return false;
}

export async function generateDailyTasks(userId: string): Promise<void> {
  const today = format(new Date(), 'yyyy-MM-dd');
  const todayDate = new Date();

  const { data: repeatTasks } = await supabase
    .from('tasks')
    .select('*')
    .eq('user_id', userId)
    .not('repeat_rule', 'is', null);

  if (!repeatTasks) return;

  const seen = new Set<string>();
  for (const task of repeatTasks) {
    const key = `${task.title}-${task.repeat_rule?.type}`;
    if (seen.has(key)) continue;
    seen.add(key);

    if (!expandRepeatRuleForDate(task.repeat_rule, todayDate)) continue;

    const { data: existing } = await supabase
      .from('tasks')
      .select('id')
      .eq('user_id', userId)
      .eq('date', today)
      .eq('title', task.title)
      .single();

    if (!existing) {
      await supabase.from('tasks').insert({
        user_id: userId,
        title: task.title,
        date: today,
        repeat_rule: task.repeat_rule,
        category: task.category ?? null,
        group_id: task.group_id ?? null,
      });
    }
  }
}
