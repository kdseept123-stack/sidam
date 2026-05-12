import { supabase } from '../../lib/supabase';
import { format } from 'date-fns';

export type RepeatRule =
  | null
  | { type: 'daily' }
  | { type: 'weekly'; days: number[] }  // 0=Sun, 6=Sat
  | { type: 'custom'; days: number[] };

export interface Task {
  id: string;
  user_id: string;
  title: string;
  is_done: boolean;
  date: string;
  repeat_rule: RepeatRule;
  source_event_id: string | null;
  created_at: string;
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

export async function createTask(userId: string, title: string, repeatRule: RepeatRule = null): Promise<Task> {
  const today = format(new Date(), 'yyyy-MM-dd');
  const { data, error } = await supabase
    .from('tasks')
    .insert({ user_id: userId, title, date: today, repeat_rule: repeatRule })
    .select()
    .single();
  if (error) throw error;
  return data as Task;
}

export async function importEventAsTask(userId: string, eventId: string, title: string, eventDate: string): Promise<Task> {
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

  // Find all tasks with repeat rules (use yesterday's entries as templates)
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

    // Check if already exists for today
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
      });
    }
  }
}
