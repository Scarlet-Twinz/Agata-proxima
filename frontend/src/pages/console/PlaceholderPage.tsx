export default function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="console-page">
      <header className="console-page-heading">
        <div>
          <span className="eyebrow">PROXIMA CONSOLE</span>
          <h1>{title}</h1>
          <p>
            This workspace surface is being connected to the Proxima control
            plane.
          </p>
        </div>
      </header>

      <section className="console-empty">
        <strong>{title}</strong>
        <p>
          The navigation and application boundary are ready. The underlying
          data surface will be connected to the Rust control plane next.
        </p>
      </section>
    </div>
  );
}
