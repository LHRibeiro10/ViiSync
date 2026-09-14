import { formatCurrency } from "../../utils/presentation";
import { formatMonthReference, formatCreatedAt, getValueTone } from "../../utils/reportsFormatting";

function AdditionalExpensesPanel({
  expenses,
  expenseForm,
  formError,
  originalProfit,
  totalAdditionalExpenses,
  adjustedProfit,
  onFieldChange,
  onSubmit,
  onRemove,
  onExportExpenses,
  exportingExpenses,
  savingExpense,
  removingExpenseId,
}) {
  return (
    <div className="panel expenses-panel">
      <div className="panel-header">
        <div>
          <h2>Gastos adicionais</h2>
          <p>
            Registre custos extras para manter leitura executiva do lucro ajustado e
            evitar distorcoes no fechamento.
          </p>
        </div>
      </div>

      <div className="expenses-layout">
        <div className="expenses-input-block">
          <form className="expenses-form" onSubmit={onSubmit}>
            <label className="expenses-field">
              <span>Descricao do gasto</span>
              <input
                type="text"
                name="description"
                value={expenseForm.description}
                onChange={onFieldChange}
                placeholder="Ex.: Frete extra, embalagem, taxa"
              />
            </label>

            <label className="expenses-field">
              <span>Valor do gasto</span>
              <input
                type="text"
                name="value"
                inputMode="decimal"
                value={expenseForm.value}
                onChange={onFieldChange}
                placeholder="0,00"
              />
            </label>

            <label className="expenses-field">
              <span>Mes de referencia</span>
              <input
                type="month"
                name="monthReference"
                value={expenseForm.monthReference}
                onChange={onFieldChange}
              />
            </label>

            <button type="submit" className="expenses-submit" disabled={savingExpense}>
              {savingExpense ? "Salvando..." : "Adicionar gasto"}
            </button>
          </form>

          {formError ? <p className="expenses-form-error">{formError}</p> : null}
        </div>

        <div className="expenses-impact-panel">
          <div className="expenses-impact-header">
            <h3>Impacto no resultado</h3>
            <p>
              Compare lucro original, custos extras e lucro ajustado para validar
              qualidade do resultado no periodo.
            </p>
          </div>

          <div className="expenses-summary">
            <div className="expenses-summary-card is-neutral">
              <span>Lucro original</span>
              <strong>{formatCurrency(originalProfit)}</strong>
              <p>Resultado enviado pelo relatorio base.</p>
            </div>

            <div className="expenses-summary-card is-warning">
              <span>Gastos adicionais</span>
              <strong>{formatCurrency(totalAdditionalExpenses)}</strong>
              <p>{expenses.length} lancamento(s) afetando o fechamento.</p>
            </div>

            <div className={`expenses-summary-card is-${getValueTone(adjustedProfit)}`}>
              <span>Lucro ajustado</span>
              <strong>{formatCurrency(adjustedProfit)}</strong>
              <p>Resultado final apos abatimento dos custos extras.</p>
            </div>
          </div>
        </div>

        <div className="expenses-list-header">
          <h3>Lancamentos registrados</h3>
          <p>
            Revise a lista antes de exportar para manter o relatorio financeiro
            consistente com a operacao.
          </p>
        </div>

        <div className="expenses-list">
          {expenses.length ? (
            expenses.map((expense, index) => (
              <div key={expense.id} className="row expense-row">
                <div className="expense-badge">{index + 1}</div>

                <div className="row-main">
                  <strong>{expense.description}</strong>
                  <p className="expense-meta">
                    {formatMonthReference(expense.monthReference)} | Criado em{" "}
                    {formatCreatedAt(expense.createdAt)}
                  </p>
                </div>

                <div className="expense-actions">
                  <span className="row-value">{formatCurrency(expense.value)}</span>

                  <button
                    type="button"
                    className="expense-remove-button"
                    onClick={() => onRemove(expense.id)}
                    disabled={removingExpenseId === expense.id}
                  >
                    {removingExpenseId === expense.id ? "Removendo..." : "Remover"}
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="expenses-empty">
              Nenhum gasto adicional no recorte atual. Cadastre custos extras para
              refletir o lucro real da operacao no periodo.
            </div>
          )}
        </div>

        <div className="expenses-footer">
          <button
            type="button"
            className="expenses-export-button"
            onClick={onExportExpenses}
            disabled={!expenses.length || exportingExpenses}
          >
            {exportingExpenses
              ? "Exportando planilha..."
              : "Exportar custos adicionais mensais"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default AdditionalExpensesPanel;
