function buildQuickQuestions(metrics, currentView) {
  const baseQuestions = [
    "Qual produto vendeu mais no periodo?",
    "Como estao minhas margens?",
    "Onde estou gastando mais?",
    "Resuma meu desempenho da semana.",
    "Quais pedidos precisam de atencao?",
    "Me de sugestoes para aumentar lucro.",
  ];

  if (currentView === "/pedidos") {
    return [
      "Quais pedidos estao pendentes?",
      "Qual canal concentra mais pedidos?",
      "Ha gargalo operacional nos pedidos?",
      ...baseQuestions,
    ].slice(0, 6);
  }

  if (currentView === "/produtos") {
    return [
      "Qual produto tem a pior margem?",
      "Quais produtos estao pausados?",
      "Onde devo ajustar preco ou custo?",
      "Que produto diferente faz sentido adicionar?",
      ...baseQuestions,
    ].slice(0, 6);
  }

  if (currentView === "/relatorios") {
    return [
      "Resuma meu desempenho recente.",
      "Qual canal gera mais lucro?",
      "Quais despesas parecem fora do normal?",
      ...baseQuestions,
    ].slice(0, 6);
  }

  return baseQuestions;
}

module.exports = {
  buildQuickQuestions,
};
