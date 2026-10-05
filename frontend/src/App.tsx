import { Navigate, Route, Routes } from "react-router-dom";
import { ConsoleLayout } from "./layouts/console/ConsoleLayout";
import { Overview } from "./pages/console/Overview";
import {
  Audit,
  Billing,
  Deployments,
  Developer,
  Nodes,
  Policies,
  Security,
  Settings,
  Support,
  Team,
  Tenants,
  Verification,
} from "./pages/console/ConsoleSurfaces";
import { NestedResource } from "./pages/console/NestedResource";

export function App() {
  return (
    <Routes>
      <Route path="/app" element={<ConsoleLayout />}>
        <Route index element={<Overview />} />

        <Route path="security" element={<Security />} />
        <Route path="security/tenant-isolation" element={<NestedResource />} />
        <Route path="security/events" element={<NestedResource />} />
        <Route path="security/events/:eventId" element={<NestedResource />} />

        <Route path="tenants" element={<Tenants />} />
        <Route path="tenants/:tenantId" element={<NestedResource />} />

        <Route path="policies" element={<Policies />} />
        <Route path="policies/:policyId" element={<NestedResource />} />

        <Route path="nodes" element={<Nodes />} />
        <Route path="nodes/:nodeId" element={<NestedResource />} />

        <Route path="deployments" element={<Deployments />} />
        <Route
          path="deployments/:deploymentId"
          element={<NestedResource />}
        />

        <Route path="verification" element={<Verification />} />
        <Route path="verification/:runId" element={<NestedResource />} />

        <Route path="audit" element={<Audit />} />
        <Route path="audit/:eventId" element={<NestedResource />} />

        <Route path="team" element={<Team />} />
        <Route path="team/members/:memberId" element={<NestedResource />} />
        <Route path="team/invitations" element={<NestedResource />} />
        <Route path="team/roles" element={<NestedResource />} />

        <Route path="billing" element={<Billing />} />
        <Route path="billing/usage" element={<NestedResource />} />
        <Route path="billing/plans" element={<NestedResource />} />
        <Route path="billing/invoices" element={<NestedResource />} />

        <Route path="developer" element={<Developer />} />
        <Route path="developer/api-keys" element={<NestedResource />} />
        <Route
          path="developer/service-accounts"
          element={<NestedResource />}
        />
        <Route
          path="developer/authentication"
          element={<NestedResource />}
        />
        <Route
          path="developer/tenant-context"
          element={<NestedResource />}
        />
        <Route path="developer/webhooks" element={<NestedResource />} />
        <Route path="developer/events" element={<NestedResource />} />
        <Route
          path="developer/environments"
          element={<NestedResource />}
        />
        <Route path="developer/sdks" element={<NestedResource />} />
        <Route path="developer/cli" element={<NestedResource />} />
        <Route path="developer/terraform" element={<NestedResource />} />
        <Route
          path="developer/api-reference"
          element={<NestedResource />}
        />

        <Route path="settings" element={<Settings />} />
        <Route
          path="settings/members"
          element={<NestedResource />}
        />
        <Route
          path="settings/authentication"
          element={<NestedResource />}
        />
        <Route path="settings/identity" element={<NestedResource />} />
        <Route path="settings/api" element={<NestedResource />} />
        <Route path="settings/security" element={<NestedResource />} />
        <Route
          path="settings/environments"
          element={<NestedResource />}
        />
        <Route
          path="settings/notifications"
          element={<NestedResource />}
        />
        <Route path="settings/danger" element={<NestedResource />} />

        <Route path="support" element={<Support />} />
      </Route>

      <Route path="*" element={<Navigate to="/app" replace />} />
    </Routes>
  );
}
