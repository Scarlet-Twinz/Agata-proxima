import { ResourceSurface } from "../../components/console/ResourceSurface";

export function Security() {
  return <ResourceSurface eyebrow="SECURITY" title="Security posture" description="Observe organization-scoped security and platform state returned by the control plane." endpoint="/api/v1/platform/status" docsHref="/app/docs/security" links={[{label:"Tenant isolation",href:"/app/security/tenant-isolation"},{label:"Verification",href:"/app/verification"},{label:"Security events",href:"/app/security/events"}]} />;
}

export function Tenants() {
  return <ResourceSurface eyebrow="TENANTS" title="Tenant registry" description="Create and inspect protected tenant contexts within the active organization." endpoint="/api/v1/tenants" createEndpoint="/api/v1/tenants" createFields={[{key:"project_id",label:"Project ID",placeholder:"UUID of the project"},{key:"name",label:"Tenant name"},{key:"slug",label:"Tenant slug"},{key:"isolation_mode",label:"Isolation mode",type:"select",options:[{label:"Enforced proxy",value:"enforced-proxy"},{label:"Engine",value:"engine"},{label:"SDK",value:"sdk"}]}]} docsHref="/app/docs/tenants" links={[{label:"Projects",href:"/app/projects"},{label:"Verification",href:"/app/verification"},{label:"Policies",href:"/app/policies"}]} transformCreate={(values,organizationId)=>({...values,organization_id:organizationId})} />;
}

export function Policies() {
  return <ResourceSurface eyebrow="POLICIES" title="Policy control" description="Create and inspect organization-scoped policy versions and their desired enforcement state." endpoint="/api/v1/policies" createEndpoint="/api/v1/policies" createFields={[{key:"name",label:"Policy name"},{key:"version",label:"Version"},{key:"document",label:"Policy JSON",type:"textarea",placeholder:'{"rules":[]}'}]} docsHref="/app/docs/policies" links={[{label:"Deployments",href:"/app/deployments"},{label:"Verification",href:"/app/verification"}]} transformCreate={(values,organizationId)=>{let document={rules:[]};try{document=JSON.parse(values.document||'{"rules":[]}')}catch{throw new Error("Policy JSON must be valid JSON.")}return {...values,organization_id:organizationId,version:Number(values.version||1),document};}} />;
}

export function Nodes() {
  return <ResourceSurface eyebrow="INFRASTRUCTURE" title="Node inventory" description="Register and inspect Proxima enforcement infrastructure." endpoint="/api/v1/nodes" createEndpoint="/api/v1/nodes" createFields={[{key:"name",label:"Node name"},{key:"environment",label:"Environment",type:"select",options:[{label:"Development",value:"development"},{label:"Staging",value:"staging"},{label:"Production",value:"production"}]},{key:"region",label:"Region",placeholder:"e.g. eu-west-1"}]} docsHref="/app/docs/nodes" links={[{label:"Deployments",href:"/app/deployments"},{label:"Security",href:"/app/security"}]} />;
}

export function Deployments() {
  return <ResourceSurface eyebrow="DEPLOYMENTS" title="Deployment history" description="Queue and inspect organization-scoped deployment intent and observed state." endpoint="/api/v1/deployments" createEndpoint="/api/v1/deployments" createFields={[{key:"node_id",label:"Node ID",placeholder:"UUID of the target node"},{key:"version",label:"Version"},{key:"desired_state",label:"Desired state",type:"select",options:[{label:"Present",value:"present"},{label:"Absent",value:"absent"}]}]} docsHref="/app/docs/deployments" links={[{label:"Policies",href:"/app/policies"},{label:"Verification",href:"/app/verification"},{label:"Nodes",href:"/app/nodes"}]} />;
}

export function Verification() {
  return <ResourceSurface eyebrow="VERIFICATION" title="Verification evidence" description="Record and inspect explicit tenant-isolation verification evidence." endpoint="/api/v1/verifications" createEndpoint="/api/v1/verifications" createFields={[{key:"tenant_id",label:"Tenant ID",placeholder:"Optional tenant UUID"},{key:"kind",label:"Verification kind",placeholder:"e.g. tenant-isolation"},{key:"status",label:"Status",type:"select",options:[{label:"Pass",value:"pass"},{label:"Fail",value:"fail"},{label:"Review",value:"review"}]},{key:"evidence",label:"Evidence JSON",type:"textarea",placeholder:'{"test":"cross-tenant-read","result":"denied"}'}]} docsHref="/app/docs/verification" links={[{label:"Security",href:"/app/security"},{label:"Audit",href:"/app/audit"}]} transformCreate={(values,organizationId)=>{let evidence={};try{evidence=JSON.parse(values.evidence||"{}")}catch{throw new Error("Evidence must be valid JSON.")}return {...values,organization_id:organizationId,tenant_id:values.tenant_id||null,evidence};}} />;
}

export function Audit() {
  return <ResourceSurface eyebrow="AUDIT" title="Audit stream" description="Inspect organization-scoped administrative and security evidence." endpoint="/api/v1/audit" docsHref="/app/docs/audit" links={[{label:"Verification",href:"/app/verification"},{label:"Security",href:"/app/security"}]} />;
}

export function Team() {
  return <ResourceSurface eyebrow="TEAM" title="Team and access" description="Inspect current organization membership. Invitations remain organization-scoped and auditable." endpoint="/api/v1/organization/team" docsHref="/app/docs/team" links={[{label:"Settings",href:"/app/settings"},{label:"Authentication",href:"/app/settings/authentication"}]} />;
}

export function Billing() {
  return <ResourceSurface eyebrow="BILLING" title="Billing" description="Inspect the current organization entitlement while Paystack billing is completed in Phase 3B." endpoint="/api/v1/billing/entitlements" docsHref="/app/docs/billing" links={[{label:"Usage",href:"/app/billing/usage"},{label:"Plans",href:"/app/billing/plans"},{label:"Invoices",href:"/app/billing/invoices"}]} />;
}

export function Developer() {
  return <ResourceSurface eyebrow="DEVELOPER" title="Developer platform" description="Inspect registered customer integrations and continue through the integration quickstart." endpoint="/api/v1/integrations" docsHref="/app/docs/developer" links={[{label:"Quickstart",href:"/app/developer/quickstart"},{label:"API keys",href:"/app/developer/api-keys"},{label:"Tenant context",href:"/app/developer/tenant-context"},{label:"API reference",href:"/app/developer/api-reference"}]} />;
}

export function Settings() {
  return <ResourceSurface eyebrow="SETTINGS" title="Workspace settings" description="Manage the active organization boundary and inspect its memberships." endpoint="/api/v1/organizations" createEndpoint="/api/v1/organizations" createFields={[{key:"name",label:"Organization name",placeholder:"e.g. Acme Ltd"}]} docsHref="/app/docs/settings" links={[{label:"Team",href:"/app/team"},{label:"Authentication",href:"/app/settings/authentication"},{label:"Enterprise identity",href:"/app/settings/identity"},{label:"Security",href:"/app/settings/security"}]} transformCreate={(values)=>({name:values.name?.trim()})} />;
}

export function Support() {
  return <ResourceSurface eyebrow="SUPPORT" title="Support" description="Inspect your organization’s support requests and submit a new request without leaving the authenticated control plane." endpoint="/api/v1/support" createEndpoint="/api/v1/support" createFields={[{key:"subject",label:"Subject"},{key:"message",label:"Message",type:"textarea",placeholder:"Describe the expected behavior, observed behavior, environment and evidence."},{key:"priority",label:"Priority",type:"select",options:[{label:"Normal",value:"normal"},{label:"High",value:"high"},{label:"Urgent",value:"urgent"}]}]} docsHref="/app/docs/support" links={[{label:"Documentation",href:"/app/docs/overview"},{label:"Security",href:"/app/security"},{label:"Audit",href:"/app/audit"}]} />;
}
