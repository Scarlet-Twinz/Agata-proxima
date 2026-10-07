import { useLocation } from "react-router-dom";
import { ResourceSurface } from "../../components/console/ResourceSurface";

const titles: Record<string, { eyebrow: string; title: string; description: string }> = {
  "/app/billing/usage": {
    eyebrow: "BILLING",
    title: "Usage",
    description: "Inspect workspace usage and consumption against the current entitlement.",
  },
  "/app/billing/plans": {
    eyebrow: "BILLING",
    title: "Plans",
    description: "Review available plans and the workspace entitlement state.",
  },
  "/app/billing/invoices": {
    eyebrow: "BILLING",
    title: "Invoices",
    description: "Review invoice history and billing records for this workspace.",
  },
  "/app/developer/api-keys": {
    eyebrow: "DEVELOPER",
    title: "API keys",
    description: "Manage credentials used to integrate with the Proxima control plane.",
  },
  "/app/developer/tenant-context": {
    eyebrow: "DEVELOPER",
    title: "Tenant context",
    description: "Inspect the tenant context contract used by protected requests.",
  },
  "/app/developer/webhooks": {
    eyebrow: "DEVELOPER",
    title: "Webhooks",
    description: "Inspect webhook delivery and integration configuration.",
  },
  "/app/developer/api-reference": {
    eyebrow: "DEVELOPER",
    title: "API reference",
    description: "Explore the control-plane API surface exposed to integrations.",
  },
  "/app/settings/authentication": {
    eyebrow: "SETTINGS",
    title: "Authentication",
    description: "Configure workspace authentication and session controls.",
  },
  "/app/settings/identity": {
    eyebrow: "SETTINGS",
    title: "Enterprise identity",
    description: "Inspect enterprise identity and organization identity configuration.",
  },
  "/app/settings/security": {
    eyebrow: "SETTINGS",
    title: "Security settings",
    description: "Configure workspace security controls and protection preferences.",
  },
  "/app/security/tenant-isolation": {
    eyebrow: "SECURITY",
    title: "Tenant isolation",
    description: "Inspect the tenant-isolation enforcement boundary.",
  },
  "/app/security/events": {
    eyebrow: "SECURITY",
    title: "Security events",
    description: "Inspect security events reported by the control plane.",
  },
};

export function NestedResource() {
  const location = useLocation();
  const config = titles[location.pathname] ?? {
    eyebrow: "RESOURCE",
    title: "Resource detail",
    description: "Inspect the selected control-plane resource.",
  };

  return (
    <ResourceSurface
      eyebrow={config.eyebrow}
      title={config.title}
      description={config.description}
      links={[
        { label: "Overview", href: "/app" },
        { label: "Security", href: "/app/security" },
        { label: "Verification", href: "/app/verification" },
        { label: "Audit", href: "/app/audit" },
      ]}
    />
  );
}
