import { createTenantContext, proximaDatabaseUrl, proximaStartupOptions } from "./index.ts";

const context = createTenantContext("signed-token");
if (proximaStartupOptions(context) !== "-c proxima_tenant_token=signed-token") throw new Error("startup option mismatch");
const url = proximaDatabaseUrl("postgres://user:pass@example.test:5432/app", context);
if (!url.includes("proxima_tenant_token")) throw new Error("database URL missing tenant option");
