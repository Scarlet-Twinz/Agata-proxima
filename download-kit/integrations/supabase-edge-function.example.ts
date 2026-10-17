// Run this only in a Supabase Edge Function or other trusted server-side runtime.
// Set AGATA_API_BASE_URL and AGATA_API_KEY using project secrets.
const baseUrl = Deno.env.get('AGATA_API_BASE_URL');
const apiKey = Deno.env.get('AGATA_API_KEY');
if (!baseUrl || !apiKey?.startsWith('aga_')) throw new Error('Agata server secrets are missing');

export async function listAgataTenants() {
  const response = await fetch(`${baseUrl.replace(/\/+$/, '')}/api/v1/tenants`, {
    headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
  });
  if (!response.ok) throw new Error(`Agata API returned ${response.status}`);
  return response.json();
}
// Verify the Supabase user and organization membership before calling this function.
