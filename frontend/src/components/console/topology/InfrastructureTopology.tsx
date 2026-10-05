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

export function InfrastructureTopology({ nodes }: Props) {
  if (!nodes.length) {
    return (
      <div className="topology-empty">
        <strong>No infrastructure nodes registered.</strong>
        <span>
          Node topology will appear here when Proxima has registered
          infrastructure.
        </span>
      </div>
    );
  }

  return (
    <div className="topology">
      <div className="topology-core">
        <span className="topology-pulse" />
        <strong>PROXIMA</strong>
        <small>enforcement boundary</small>
      </div>

      <div className="topology-links">
        {nodes.map((node) => (
          <div className="topology-node" key={node.id}>
            <span className="node-dot" />
            <div>
              <strong>{node.name ?? node.id}</strong>
              <small>
                {node.region ?? "Region unavailable"} ·{" "}
                {node.environment ?? "Environment unavailable"}
              </small>
            </div>
            <span className="node-status">
              {node.status ?? "UNKNOWN"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
