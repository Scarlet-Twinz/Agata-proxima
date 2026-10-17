type NodeRecord = {
  id: string;
  name?: string;
  region?: string;
  environment?: string;
  status?: string;
};

type Props = {
  nodes: NodeRecord[];
};

function nodeState(status?: string) {
  const normalized = status?.toLowerCase() ?? "unknown";
  if (["healthy", "online", "active", "ready", "connected"].some((value) => normalized.includes(value))) return "healthy";
  if (["degraded", "warning", "pending", "provisioning"].some((value) => normalized.includes(value))) return "degraded";
  return "inactive";
}

export function InfrastructureTopology({ nodes }: Props) {
  return (
    <div className="topology">
      <div className="topology-core">
        <span className="topology-pulse" />
        <strong>PROXIMA</strong>
        <small>enforcement boundary</small>
      </div>

      <div className={`topology-links${nodes.length ? " topology-links--connected" : ""}`} aria-label="Registered infrastructure nodes">
        {nodes.length ? nodes.map((node) => (
          <div className="topology-node" key={node.id}>
            <span className={`node-dot node-dot--${nodeState(node.status)}`} aria-hidden="true" />
            <div>
              <strong>{node.name ?? node.id}</strong>
              <small>
                {node.region ?? "Region unavailable"} ·{" "}
                {node.environment ?? "Environment unavailable"}
              </small>
            </div>
            <span className={`node-status node-status--${nodeState(node.status)}`}>
              {node.status ?? "UNKNOWN"}
            </span>
          </div>
        )) : (
          <div className="topology-node topology-node--empty" role="status">
            <span className="node-dot node-dot--idle" />
            <div>
              <strong>No infrastructure nodes registered</strong>
              <small>Register a node to populate the live topology. No sample nodes are shown.</small>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
