import { ResourceSurface } from "../../components/console/ResourceSurface";

export function NestedResource() {
  return (
    <ResourceSurface
      eyebrow="RESOURCE"
      title="Resource detail"
      description="Inspect the selected control-plane resource."
      links={[
        { label: "Overview", href: "/app" },
        { label: "Security", href: "/app/security" },
        { label: "Verification", href: "/app/verification" },
        { label: "Audit", href: "/app/audit" },
      ]}
    />
  );
}
