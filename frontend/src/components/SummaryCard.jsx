function SummaryCard({ title, value, description, variant = "" }) {
  return (
    <div className={`card ${variant}`}>
      <span>{title}</span>
      <strong>{value}</strong>
      <small>{description}</small>
    </div>
  );
}

export default SummaryCard;