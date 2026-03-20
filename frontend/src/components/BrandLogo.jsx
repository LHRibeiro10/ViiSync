import brandLogo from "../assets/logo_ViiSync.png";

function BrandLogo({
  subtitle = "Painel do seller",
  compact = false,
  showText = true,
  large = false,
}) {
  return (
    <div
      className={`brand-logo ${compact ? "brand-logo-compact" : ""} ${
        !showText ? "brand-logo-textless" : ""
      } ${large ? "brand-logo-large" : ""}`}
    >
      <div className="brand-logo-mark">
        <img src={brandLogo} alt="ViiSync" className="brand-logo-image" />
      </div>

      {showText ? (
        <div className="brand-logo-copy">
          <strong>ViiSync</strong>
          {subtitle ? <span>{subtitle}</span> : null}
        </div>
      ) : null}
    </div>
  );
}

export default BrandLogo;
