/** A styleguide section with an anchor. */
export function Section({ id, title, description, children }) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className="scroll-mt-20 border-t border-line pt-8"
    >
      <h2 id={`${id}-title`} className="text-2xl font-bold text-brand-800">
        {title}
      </h2>
      {description && <p className="mt-1 max-w-3xl text-muted">{description}</p>}
      <div className="mt-5 flex flex-col gap-6">{children}</div>
    </section>
  );
}

/** A labelled example inside a section. */
export function Example({ title, children, className = '' }) {
  return (
    <div>
      {title && (
        <h3 className="mb-2 text-sm font-bold tracking-wide text-sand-600 uppercase">{title}</h3>
      )}
      <div className={className}>{children}</div>
    </div>
  );
}
