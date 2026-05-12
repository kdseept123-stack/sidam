import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  const { code, user_id } = await req.json();

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // Atomically validate and consume the invite code
  const { data: invite, error: fetchError } = await supabase
    .from('invite_codes')
    .select('*, groups(*)')
    .eq('code', code)
    .eq('used', false)
    .gt('expires_at', new Date().toISOString())
    .single();

  if (fetchError || !invite) {
    return new Response(JSON.stringify({ error: 'Invalid or expired invite code' }), { status: 200 });
  }

  // Check if user is already a member
  const { data: existing } = await supabase
    .from('group_members')
    .select('user_id')
    .eq('group_id', invite.group_id)
    .eq('user_id', user_id)
    .single();

  if (existing) {
    return new Response(JSON.stringify({ error: 'Already a member of this group' }), { status: 200 });
  }

  // Mark code as used
  const { error: updateError } = await supabase
    .from('invite_codes')
    .update({ used: true })
    .eq('code', code);

  if (updateError) {
    return new Response(JSON.stringify({ error: 'Failed to validate code' }), { status: 200 });
  }

  // Add user to group
  const { error: memberError } = await supabase
    .from('group_members')
    .insert({ group_id: invite.group_id, user_id, role: 'member' });

  if (memberError) {
    return new Response(JSON.stringify({ error: 'Failed to join group' }), { status: 200 });
  }

  return new Response(JSON.stringify({ group: invite.groups }), { status: 200 });
});
