import { getAuth } from 'firebase-admin/auth';

export async function resolveFirebaseIdentity(idToken: string) {
  // Verify identity server-side; this does not by itself authorize an Agata organization/tenant.
  const decoded = await getAuth().verifyIdToken(idToken, true);
  // Resolve organization membership and tenant context from trusted server-side records.
  return { uid: decoded.uid };
}
