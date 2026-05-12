import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface WebhookPayload {
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  table: string;
  record: Record<string, any>;
  old_record: Record<string, any> | null;
  schema: string;
}

serve(async (req) => {
  const payload: WebhookPayload = await req.json();
  const event = payload.record ?? payload.old_record;
  if (!event) return new Response('ok');

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const actorId = event.created_by;
  const groupId = event.group_id;

  // Get group members who have notify_changes = true, excluding the actor
  const { data: members } = await supabase
    .from('group_members')
    .select('user_id, profiles(expo_push_token, display_name)')
    .eq('group_id', groupId)
    .eq('notify_changes', true)
    .neq('user_id', actorId);

  if (!members || members.length === 0) return new Response('ok');

  // Get actor's display name
  const { data: actor } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', actorId)
    .single();

  const actorName = actor?.display_name ?? '가족';
  const actionLabel = payload.type === 'INSERT' ? '추가했어요' : payload.type === 'UPDATE' ? '수정했어요' : '삭제했어요';

  const tokens = members
    .map((m: any) => m.profiles?.expo_push_token)
    .filter(Boolean);

  if (tokens.length === 0) return new Response('ok');

  await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(tokens.map((token: string) => ({
      to: token,
      title: `${actorName}이(가) 일정을 ${actionLabel}`,
      body: event.title,
      data: { groupId, eventId: event.id },
    }))),
  });

  return new Response('ok');
});
