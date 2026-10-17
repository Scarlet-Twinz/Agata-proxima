import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const allowedOrigin = Deno.env.get('SUPABASE_ALLOWED_ORIGIN');
const agataBaseUrl = (Deno.env.get('AGATA_API_BASE_URL') || 'https://api.agataproxima.com').replace(/\/+$/, '');
const agataApiKey = Deno.env.get('AGATA_API_KEY');
const agataOrganizationId = Deno.env.get('AGATA_ORGANIZATION_ID');

if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey || !allowedOrigin) {
  throw new Error('Supabase URL, anon key, service-role key and allowed origin must be configured as Edge Function secrets.');
}
if (!agataApiKey?.startsWith('aga_') || !agataOrganizationId) {
  throw new Error('An organization-scoped Agata API key and its matching organization ID are required.');
}

const corsHeaders = {
  'Access-Control-Allow-Origin': allowedOrigin,
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Vary': 'Origin',
};
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: corsHeaders });

Deno.serve(async (request) => {
  if (request.headers.get('origin') !== allowedOrigin) return json({ error: 'origin_not_allowed' }, 403);
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const authorization = request.headers.get('authorization') || '';
  if (!authorization.startsWith('Bearer ')) return json({ error: 'authentication_required' }, 401);
  const userToken = authorization.slice('Bearer '.length);

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${userToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user) return json({ error: 'invalid_supabase_session' }, 401);

  // The service-role key stays server-side and bypasses RLS only for this trusted membership check.
  const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: membership, error: membershipError } = await adminClient
    .from('agata_organization_memberships')
    .select('role,status')
    .eq('user_id', user.id)
    .eq('agata_organization_id', agataOrganizationId)
    .maybeSingle();
  if (membershipError) {
    console.error('Agata membership lookup failed:', membershipError.code || 'database_error');
    return json({ error: 'membership_lookup_failed' }, 500);
  }
  if (!membership || membership.status !== 'active' || !['owner', 'admin', 'operator', 'viewer'].includes(membership.role)) {
    return json({ error: 'organization_access_denied' }, 403);
  }

  const agataResponse = await fetch(`${agataBaseUrl}/api/v1/tenants`, {
    headers: { Authorization: `Bearer ${agataApiKey}`, Accept: 'application/json' },
  });
  if (!agataResponse.ok) {
    console.error('Agata API request failed with status:', agataResponse.status);
    return json({ error: 'agata_api_request_failed' }, 502);
  }
  return json({ organization_id: agataOrganizationId, tenants: await agataResponse.json() });
});
