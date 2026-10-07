import { useLocation } from "react-router-dom";
import { ResourceSurface } from "../../components/console/ResourceSurface";

const config: Record<string, Parameters<typeof ResourceSurface>[0]> = {
  "/app/billing/usage": {
    endpoint: "/api/v1/billing/entitlements",
    eyebrow: "BILLING",
    title: "Usage",
    description: "Current plan limits, feature entitlements and capacity available to this workspace.",
    links: [{label:"Plans",href:"/app/billing/plans"},{label:"Invoices",href:"/app/billing/invoices"}],
  },
  "/app/billing/plans": {
    endpoint: "/api/v1/billing/plans",
    eyebrow: "BILLING",
    title: "Plans",
    description: "Review available Agata Proxima plans, limits and feature capabilities.",
    links: [{label:"Usage",href:"/app/billing/usage"},{label:"Invoices",href:"/app/billing/invoices"}],
  },
  "/app/billing/invoices": {
    endpoint: "/api/v1/billing",
    eyebrow: "BILLING",
    title: "Invoices",
    description: "Review billing-account and subscription state. Invoice history will be populated from recorded billing events as that surface is exposed.",
    links: [{label:"Usage",href:"/app/billing/usage"},{label:"Plans",href:"/app/billing/plans"}],
  },
  "/app/developer/api-keys": {
    eyebrow:"DEVELOPER",
    title:"API keys",
    description:"Integration credentials and their security boundary.",
    sections:[
      {title:"Credential policy",text:"Keys should be scoped to the smallest integration surface required. Never place secrets in browser code or commit them to the repository."},
      {title:"Control-plane authentication",text:"Protected API requests use authenticated organization context and preserve tenant boundaries.",href:"/app/developer/tenant-context"},
    ],
    links:[{label:"Tenant context",href:"/app/developer/tenant-context"},{label:"Webhooks",href:"/app/developer/webhooks"},{label:"API reference",href:"/app/developer/api-reference"}],
  },
  "/app/developer/tenant-context": {
    eyebrow:"DEVELOPER",
    title:"Tenant context",
    description:"Understand how authenticated identity and tenant context meet at the protected request boundary.",
    sections:[
      {title:"Identity",text:"Authentication identifies the caller and organization membership."},
      {title:"Tenant boundary",text:"Tenant context determines which customer boundary a protected operation is allowed to address."},
      {title:"Verification",text:"Cross-tenant, missing or malformed context should be rejected and recorded as evidence.",href:"/app/verification"},
    ],
    links:[{label:"API keys",href:"/app/developer/api-keys"},{label:"API reference",href:"/app/developer/api-reference"}],
  },
  "/app/developer/webhooks": {
    eyebrow:"DEVELOPER",
    title:"Webhooks",
    description:"Connect Proxima events to systems your engineering and security teams already operate.",
    sections:[
      {title:"Delivery",text:"Treat event IDs as idempotency keys and handle transient failures with safe retries."},
      {title:"Security",text:"Authenticate incoming deliveries and never place credentials or secrets in event payloads."},
    ],
    links:[{label:"API reference",href:"/app/developer/api-reference"},{label:"Support",href:"/app/support"}],
  },
  "/app/developer/api-reference": {
    eyebrow:"DEVELOPER",
    title:"API reference",
    description:"Explore the authenticated control-plane contracts exposed to integrations.",
    sections:[
      {title:"Organizations",text:"Organization membership establishes the administrative boundary."},
      {title:"Tenants and policies",text:"Tenant and policy APIs establish the data boundary and declared enforcement behavior."},
      {title:"Verification and audit",text:"Verification results and audit events provide inspectable operational evidence."},
    ],
    links:[{label:"Tenant context",href:"/app/developer/tenant-context"},{label:"Documentation",href:"/docs/api-reference"}],
  },
  "/app/settings/authentication": {
    eyebrow:"SETTINGS",
    title:"Authentication",
    description:"Review the workspace authentication and session contract.",
    sections:[
      {title:"Email verification",text:"New accounts must verify their email before password login creates a session."},
      {title:"Session protection",text:"Authenticated sessions use an HttpOnly session cookie plus a CSRF token for state-changing operations."},
      {title:"Recovery",text:"Password recovery uses a time-limited email link rather than silently creating a session."},
    ],
    links:[{label:"Enterprise identity",href:"/app/settings/identity"},{label:"Security",href:"/app/settings/security"}],
  },
  "/app/settings/identity": {
    eyebrow:"SETTINGS",
    title:"Enterprise identity",
    description:"Review enterprise identity and organization OIDC configuration.",
    sections:[
      {title:"OIDC / Entra",text:"Enterprise identity configuration is part of the production readiness contract and must be configured before enterprise sign-in is considered ready."},
      {title:"Organization boundary",text:"Identity configuration belongs to the organization and must not bypass the control-plane organization boundary."},
    ],
    links:[{label:"Authentication",href:"/app/settings/authentication"},{label:"Security",href:"/app/settings/security"}],
  },
  "/app/settings/security": {
    eyebrow:"SETTINGS",
    title:"Security settings",
    description:"Review workspace security and session protection.",
    sections:[
      {title:"Session protection",text:"The control plane uses HttpOnly cookies, explicit expiry and CSRF validation on state-changing requests."},
      {title:"Tenant isolation",text:"Security decisions remain enforceable and independently verifiable.",href:"/app/security/tenant-isolation"},
    ],
    links:[{label:"Security posture",href:"/app/security"},{label:"Audit",href:"/app/audit"}],
  },
  "/app/security/tenant-isolation": {
    eyebrow:"SECURITY",
    title:"Tenant isolation",
    description:"Inspect the explicit tenant-isolation enforcement model.",
    sections:[
      {title:"Layered boundary",text:"Identity, tenant context, Proxima enforcement and PostgreSQL controls form the layered boundary."},
      {title:"Verification",text:"Isolation should be demonstrated through expected-allow and expected-block tests.",href:"/app/verification"},
    ],
  },
  "/app/security/events": {
    endpoint:"/api/v1/audit",
    eyebrow:"SECURITY",
    title:"Security events",
    description:"Review organization-scoped audit evidence relevant to security operations.",
    links:[{label:"Security posture",href:"/app/security"},{label:"Audit",href:"/app/audit"}],
  },
};

export function NestedResource() {
  const location = useLocation();
  const props = config[location.pathname] ?? {
    eyebrow:"RESOURCE",
    title:"Resource detail",
    description:"Inspect the selected control-plane resource.",
  };
  return <ResourceSurface {...props} />;
}
