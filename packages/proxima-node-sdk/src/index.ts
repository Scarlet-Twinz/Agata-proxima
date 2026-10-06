export type TenantContext = {
  tenantToken: string;
};

export function createTenantContext(tenantToken: string): TenantContext {
  if (!tenantToken.trim()) throw new Error("A signed tenant token is required.");
  return { tenantToken };
}

export function proximaStartupOptions(context: TenantContext): string {
  return `-c proxima_tenant_token=${context.tenantToken}`;
}

/**
 * Returns a PostgreSQL URL with the Proxima tenant startup option.
 * The signed token is encoded as a URL parameter; do not put signing
 * credentials in browser code or source control.
 */
export function proximaDatabaseUrl(databaseUrl: string, context: TenantContext): string {
  const url = new URL(databaseUrl);
  url.searchParams.set("options", proximaStartupOptions(context));
  return url.toString();
}
