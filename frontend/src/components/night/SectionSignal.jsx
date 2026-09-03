export default function SectionSignal({ index, eyebrow, title, description, align = "start", id }) {
  return (
    <header className={`nr-signal nr-signal--${align}`}>
      <div className="nr-signal__rail" aria-hidden="true">
        {index && <span>{index}</span>}
        <i />
      </div>
      {eyebrow && <p className="nr-signal__eyebrow">{eyebrow}</p>}
      {title && <h2 id={id} className="nr-signal__title">{title}</h2>}
      {description && <p className="nr-signal__description">{description}</p>}
    </header>
  );
}
