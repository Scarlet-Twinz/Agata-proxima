import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

if (!getApps().length) initializeApp();

const agataBaseUrl = (process.env.AGATA_API_BASE_URL || 'https://api.agataproxima.com').replace(/\/+$/, '');
const agataApiKey = process.env.AGATA_API_KEY;
const agataOrganizationId = process.env.AGATA_ORGANIZATION_ID;
if (!agataApiKey?.startsWith('aga_') || !agataOrganizationId) {
  throw new Error('An organization-scoped Agata API key and its matching organization ID are required.');
}

// Create agataOrganizationMemberships/{firebaseUid} documents only from a trusted
// server/admin process. Firestore client rules must deny clients read/write access.
export async function listAgataTenantsForFirebaseUser(idToken: string) {
  const decoded = await getAuth().verifyIdToken(idToken, true);
  const membership = await getFirestore().collection('agataOrganizationMemberships').doc(decoded.uid).get();
  const record = membership.data();
  if (!membership.exists || record?.organizationId !== agataOrganizationId || record?.status !== 'active' ||
      !['owner', 'admin', 'operator', 'viewer'].includes(record?.role)) {
    const error = new Error('Organization access denied');
    Object.assign(error, { status: 403 });
    throw error;
  }

  const response = await fetch(`${agataBaseUrl}/api/v1/tenants`, {
    headers: { Authorization: `Bearer ${agataApiKey}`, Accept: 'application/json' },
  });
  if (!response.ok) {
    const error = new Error(`Agata API request failed with status ${response.status}`);
    Object.assign(error, { status: response.status === 401 ? 502 : response.status });
    throw error;
  }
  return { organization_id: agataOrganizationId, tenants: await response.json() };
}
