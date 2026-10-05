import { ResourceSurface } from "../../components/console/ResourceSurface";

export function Security() {
  return (
    <ResourceSurface
      eyebrow="SECURITY"
      title="Security posture"
      description="Observe the controls protecting the Proxima isolation boundary."
      links={[
        { label: "Tenant isolation", href: "/app/security/tenant-isolation" },
        { label: "Verification", href: "/app/verification" },
        { label: "Security events", href: "/app/security/events" },
      ]}
    />
  );
}

export function Tenants() {
  return (
    <ResourceSurface
      eyebrow="TENANTS"
      title="Tenant registry"
      description="Manage and inspect protected tenant contexts."
      links={[
        { label: "Verification", href: "/app/verification" },
        { label: "Policies", href: "/app/policies" },
        { label: "Nodes", href: "/app/nodes" },
      ]}
    />
  );
}

export function Policies() {
  return (
    <ResourceSurface
      eyebrow="POLICIES"
      title="Policy control"
      description="Inspect enforcement policy, versions, and deployment state."
      links={[
        { label: "Deployments", href: "/app/deployments" },
        { label: "Verification", href: "/app/verification" },
      ]}
    />
  );
}

export function Nodes() {
  return (
    <ResourceSurface
      eyebrow="INFRASTRUCTURE"
      title="Node inventory"
      description="Inspect Proxima enforcement infrastructure and topology."
      links={[
        { label: "Deployments", href: "/app/deployments" },
        { label: "Security", href: "/app/security" },
      ]}
    />
  );
}

export function Deployments() {
  return (
    <ResourceSurface
      eyebrow="DEPLOYMENTS"
      title="Deployment history"
      description="Track control-plane and enforcement deployments."
      links={[
        { label: "Policies", href: "/app/policies" },
        { label: "Verification", href: "/app/verification" },
        { label: "Nodes", href: "/app/nodes" },
      ]}
    />
  );
}

export function Verification() {
  return (
    <ResourceSurface
      eyebrow="VERIFICATION"
      title="Verification evidence"
      description="Inspect independently verifiable tenant-isolation decisions."
      links={[
        { label: "Security", href: "/app/security" },
        { label: "Audit", href: "/app/audit" },
      ]}
    />
  );
}

export function Audit() {
  return (
    <ResourceSurface
      eyebrow="AUDIT"
      title="Audit stream"
      description="Search control-plane and security evidence."
      links={[
        { label: "Verification", href: "/app/verification" },
        { label: "Security", href: "/app/security" },
      ]}
    />
  );
}

export function Team() {
  return (
    <ResourceSurface
      eyebrow="TEAM"
      title="Team and access"
      description="Manage organization members, roles, and invitations."
      links={[
        { label: "Settings", href: "/app/settings" },
        { label: "Authentication", href: "/app/settings/authentication" },
      ]}
    />
  );
}

export function Billing() {
  return (
    <ResourceSurface
      eyebrow="BILLING"
      title="Billing"
      description="Inspect plan, entitlement, usage, and billing state."
      links={[
        { label: "Usage", href: "/app/billing/usage" },
        { label: "Plans", href: "/app/billing/plans" },
        { label: "Invoices", href: "/app/billing/invoices" },
      ]}
    />
  );
}

export function Developer() {
  return (
    <ResourceSurface
      eyebrow="DEVELOPER"
      title="Developer platform"
      description="Build integrations against the Proxima control plane."
      links={[
        { label: "API keys", href: "/app/developer/api-keys" },
        { label: "Tenant context", href: "/app/developer/tenant-context" },
        { label: "Webhooks", href: "/app/developer/webhooks" },
        { label: "API reference", href: "/app/developer/api-reference" },
      ]}
    />
  );
}

export function Settings() {
  return (
    <ResourceSurface
      eyebrow="SETTINGS"
      title="Workspace settings"
      description="Configure workspace, authentication, security, and environments."
      links={[
        { label: "Authentication", href: "/app/settings/authentication" },
        { label: "Enterprise identity", href: "/app/settings/identity" },
        { label: "Security", href: "/app/settings/security" },
      ]}
    />
  );
}

export function Support() {
  return (
    <ResourceSurface
      eyebrow="SUPPORT"
      title="Support"
      description="Get help with your Proxima workspace and deployment."
      links={[
        { label: "Documentation", href: "/docs" },
        { label: "Contact support", href: "/contact" },
        { label: "Security", href: "/app/security" },
      ]}
    />
  );
}
