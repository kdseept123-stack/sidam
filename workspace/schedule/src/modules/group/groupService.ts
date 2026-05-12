import { supabase } from '../../lib/supabase';

export interface Group {
  id: string;
  name: string;
  created_by: string;
  created_at: string;
}

export interface GroupMember {
  group_id: string;
  user_id: string;
  role: 'admin' | 'member';
  notify_changes: boolean;
  joined_at: string;
  profiles: {
    display_name: string;
    avatar_url: string | null;
  };
}

export async function createGroup(name: string, userId: string): Promise<Group> {
  const { data: group, error: groupError } = await supabase
    .from('groups')
    .insert({ name, created_by: userId })
    .select()
    .single();
  if (groupError) throw groupError;

  const { error: memberError } = await supabase
    .from('group_members')
    .insert({ group_id: group.id, user_id: userId, role: 'admin' });
  if (memberError) throw memberError;

  return group;
}

export async function getMyGroup(userId: string): Promise<Group | null> {
  const { data } = await supabase
    .from('group_members')
    .select('groups(*)')
    .eq('user_id', userId)
    .limit(1)
    .single();
  return (data?.groups as unknown as Group) ?? null;
}

export async function getGroupMembers(groupId: string): Promise<GroupMember[]> {
  const { data, error } = await supabase
    .from('group_members')
    .select('*, profiles(display_name, avatar_url)')
    .eq('group_id', groupId);
  if (error) throw error;
  return (data ?? []) as GroupMember[];
}

export function generateInviteCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

export async function createInviteCode(groupId: string, userId: string): Promise<string> {
  const code = generateInviteCode();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const { error } = await supabase
    .from('invite_codes')
    .insert({ code, group_id: groupId, created_by: userId, expires_at: expiresAt });
  if (error) throw error;

  return code;
}

export async function joinGroupWithCode(code: string, userId: string): Promise<Group> {
  const { data, error } = await supabase.functions.invoke('validate-invite-code', {
    body: { code, user_id: userId },
  });
  if (error) throw error;
  if (data.error) throw new Error(data.error);
  return data.group as Group;
}

export async function leaveGroup(groupId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('group_members')
    .delete()
    .eq('group_id', groupId)
    .eq('user_id', userId);
  if (error) throw error;
}

export async function removeMember(groupId: string, targetUserId: string): Promise<void> {
  const { error } = await supabase
    .from('group_members')
    .delete()
    .eq('group_id', groupId)
    .eq('user_id', targetUserId);
  if (error) throw error;
}

export async function updateNotifyChanges(groupId: string, userId: string, notify: boolean): Promise<void> {
  const { error } = await supabase
    .from('group_members')
    .update({ notify_changes: notify })
    .eq('group_id', groupId)
    .eq('user_id', userId);
  if (error) throw error;
}
