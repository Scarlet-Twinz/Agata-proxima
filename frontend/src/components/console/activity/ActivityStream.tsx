import { Link } from "react-router-dom";

type Activity = {
  id: string;
  type: string;
  message: string;
  timestamp: string;
  href?: string;
};

type Props = {
  items: Activity[];
};

export function ActivityStream({ items }: Props) {
  if (!items.length) {
    return (
      <div className="empty-state">
        <strong>No activity recorded.</strong>
        <span>
          Proxima will surface control-plane and security activity here when
          events are available.
        </span>
      </div>
    );
  }

  return (
    <div className="activity-stream">
      {items.map((item) => {
        const content = (
          <>
            <span className="activity-marker" />
            <span className="activity-copy">
              <strong>{item.type}</strong>
              <span>{item.message}</span>
              <time dateTime={item.timestamp}>
                {new Date(item.timestamp).toLocaleString()}
              </time>
            </span>
          </>
        );

        return item.href ? (
          <Link className="activity-row" to={item.href} key={item.id}>
            {content}
          </Link>
        ) : (
          <div className="activity-row" key={item.id}>
            {content}
          </div>
        );
      })}
    </div>
  );
}
