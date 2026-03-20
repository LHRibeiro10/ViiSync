import { useEffect } from "react";
import { createPortal } from "react-dom";

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M18.3 5.71 12 12l6.3 6.29-1.41 1.41L10.59 13.4 4.29 19.7 2.88 18.29 9.17 12 2.88 5.71 4.29 4.29l6.3 6.3 6.29-6.3 1.42 1.42Z"
        fill="currentColor"
      />
    </svg>
  );
}

function TaxCalculatorModal({
  item,
  form,
  formError,
  formatCurrency,
  onFieldChange,
  onClose,
  onSave,
}) {
  useEffect(() => {
    if (!item) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [item, onClose]);

  if (!item) {
    return null;
  }

  const modalContent = (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="tax-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tax-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="tax-modal-header">
          <div>
            <span className="tax-modal-tag">Custos operacionais</span>
            <h2 id="tax-modal-title">Custos &amp; Impostos</h2>
            <p>Atualize o custo pago e a taxa de imposto para recalcular o lucro.</p>
          </div>

          <button
            type="button"
            className="tax-modal-close"
            onClick={onClose}
            aria-label="Fechar modal"
          >
            <CloseIcon />
          </button>
        </div>

        <div className="tax-modal-body">
          <div className="tax-modal-product">
            <div className="tax-modal-product-top">
              <img src={item.photo} alt={item.title} className="tax-modal-photo" />

              <div>
                <span className="tax-modal-account">{item.account}</span>
                <strong>{item.title}</strong>
                <p>SKU {item.sku}</p>
              </div>
            </div>

            <div className="tax-modal-product-meta">
              <div>
                <span>Valor da venda</span>
                <strong>{formatCurrency(item.value)}</strong>
              </div>
              <div>
                <span>Lucro atual</span>
                <strong>{formatCurrency(item.profit)}</strong>
              </div>
            </div>
          </div>

          <form className="tax-modal-form" onSubmit={onSave}>
            <label className="tax-modal-field">
              <span>Nome do produto</span>
              <input type="text" value={item.title} readOnly />
            </label>

            <label className="tax-modal-field">
              <span>SKU</span>
              <input type="text" value={item.sku} readOnly />
            </label>

            <label className="tax-modal-field">
              <span>Custo atual</span>
              <div className="tax-modal-input-shell">
                <small>R$</small>
                <input
                  type="number"
                  name="productCost"
                  value={form.productCost}
                  min="0"
                  step="0.01"
                  onChange={onFieldChange}
                  placeholder="0,00"
                />
              </div>
            </label>

            <label className="tax-modal-field">
              <span>Imposto atual</span>
              <div className="tax-modal-input-shell">
                <input
                  type="number"
                  name="taxPercent"
                  value={form.taxPercent}
                  min="0"
                  step="0.01"
                  onChange={onFieldChange}
                  placeholder="0,00"
                />
                <small>%</small>
              </div>
            </label>

            {formError ? <p className="tax-modal-error">{formError}</p> : null}

            <div className="tax-modal-actions">
              <button type="button" className="tax-modal-secondary" onClick={onClose}>
                Fechar
              </button>
              <button type="submit" className="tax-modal-primary">
                Salvar
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );

  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(modalContent, document.body);
}

export default TaxCalculatorModal;
