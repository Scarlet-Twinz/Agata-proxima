export type MetricPoint = {
  timestamp: string;
  value: number;
};

export type OverviewData = {
  protection?: {
    tenantIsolation?: string;
    policyEnforcement?: string;
    verification?: string;
    databaseProtection?: string;
  };

  verificationTrend?: MetricPoint[];

  tenants?: {
    id: string;
    name: string;
    status: string;
    environment?: string;
    nodeId?: string;
    lastVerifiedAt?: string;
  }[];

  nodes?: {
    id: string;
    name?: string;
    region?: string;
    environment?: string;
    status?: string;
    version?: string;
  }[];

  recentActivity?: {
    id: string;
    type: string;
    message: string;
    timestamp: string;
    href?: string;
  }[];
};

export type ResourceRecord = Record<string, unknown>;
