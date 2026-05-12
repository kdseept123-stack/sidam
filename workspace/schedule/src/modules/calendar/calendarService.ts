import { supabase } from '../../lib/supabase';
import { format, startOfMonth, endOfMonth } from 'date-fns';

export interface CalendarEvent {
  id: string;
  group_id: string;
  created_by: string;
  title: string;
  start_at: string;
  end_at: string | null;
  memo: string | null;
  created_at: string;
  updated_at: string;
  profiles?: { display_name: string; avatar_url: string | null };
}

export interface CreateEventInput {
  group_id: string;
  created_by: string;
  title: string;
  start_at: string;
  end_at?: string;
  memo?: string;
}

export async function getEventsForMonth(groupId: string, year: number, month: number): Promise<Record<string, CalendarEvent[]>> {
  const start = startOfMonth(new Date(year, month - 1)).toISOString();
  const end = endOfMonth(new Date(year, month - 1)).toISOString();

  const { data, error } = await supabase
    .from('events')
    .select('*, profiles(display_name, avatar_url)')
    .eq('group_id', groupId)
    .gte('start_at', start)
    .lte('start_at', end)
    .order('start_at');

  if (error) throw error;

  return (data ?? []).reduce<Record<string, CalendarEvent[]>>((acc, event) => {
    const day = format(new Date(event.start_at), 'yyyy-MM-dd');
    acc[day] = [...(acc[day] ?? []), event as CalendarEvent];
    return acc;
  }, {});
}

export async function getEventsForDay(groupId: string, date: Date): Promise<CalendarEvent[]> {
  const dayStr = format(date, 'yyyy-MM-dd');
  const { data, error } = await supabase
    .from('events')
    .select('*, profiles(display_name, avatar_url)')
    .eq('group_id', groupId)
    .gte('start_at', `${dayStr}T00:00:00`)
    .lte('start_at', `${dayStr}T23:59:59`)
    .order('start_at');

  if (error) throw error;
  return (data ?? []) as CalendarEvent[];
}

export async function createEvent(input: CreateEventInput): Promise<CalendarEvent> {
  const { data, error } = await supabase
    .from('events')
    .insert(input)
    .select('*, profiles(display_name, avatar_url)')
    .single();
  if (error) throw error;
  return data as CalendarEvent;
}

export async function updateEvent(id: string, updates: Partial<Pick<CalendarEvent, 'title' | 'start_at' | 'end_at' | 'memo'>>): Promise<CalendarEvent> {
  const { data, error } = await supabase
    .from('events')
    .update(updates)
    .eq('id', id)
    .select('*, profiles(display_name, avatar_url)')
    .single();
  if (error) throw error;
  return data as CalendarEvent;
}

export async function deleteEvent(id: string): Promise<void> {
  const { error } = await supabase.from('events').delete().eq('id', id);
  if (error) throw error;
}

export function subscribeToGroupEvents(groupId: string, onChange: (event: CalendarEvent, action: 'INSERT' | 'UPDATE' | 'DELETE') => void) {
  return supabase
    .channel(`events:group_id=eq.${groupId}`)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'events',
      filter: `group_id=eq.${groupId}`,
    }, (payload) => {
      onChange(payload.new as CalendarEvent ?? payload.old as CalendarEvent, payload.eventType as any);
    })
    .subscribe();
}
