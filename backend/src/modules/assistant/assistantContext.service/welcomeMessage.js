const { getPeriodLabel } = require("../../../lib/period");
const { formatCurrency, formatPercent } = require("./shared");

function createWelcomeMessage(context) {
  const alertMessage = context.alerts[0]
    ? ` Ja identifiquei um ponto de atencao: ${context.alerts[0].title.toLowerCase()}.`
    : "";

  return `Sou a assistente do ViiSync. No recorte atual de ${getPeriodLabel(
    context.period
  )}, seu negocio soma ${formatCurrency(
    context.summary.revenue
  )} de receita, ${formatCurrency(
    context.summary.profit
  )} de lucro e margem media de ${formatPercent(
    context.summary.averageMargin
  )}.${alertMessage} Posso responder perguntas sobre vendas, margem, despesas, produtos, canais e operacao.`;
}

module.exports = {
  createWelcomeMessage,
};
