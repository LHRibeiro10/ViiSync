const { startConversation, replyToConversation } = require("../src/modules/assistant/assistant.service");

const TEST_CASES = [
  {
    category: "geral",
    view: "/",
    question: "qual produto vendeu mais?",
    currentPeriod: "30d",
    expected: ["Cadeira Gamer GX", "faturamento"],
  },
  {
    category: "geral",
    view: "/",
    question: "qual produto me da mais lucro?",
    currentPeriod: "30d",
    expected: ["Cadeira Gamer GX", "lucro"],
  },
  {
    category: "margem",
    view: "/",
    question: "qual produto tem a melhor margem?",
    currentPeriod: "30d",
    expected: ["Mouse Gamer RGB", "margem"],
  },
  {
    category: "margem",
    view: "/",
    question: "qual produto tem a pior margem?",
    currentPeriod: "30d",
    expected: ["Cadeira Gamer GX", "margem"],
  },
  {
    category: "margem",
    view: "/",
    question: "como estao minhas margens?",
    currentPeriod: "30d",
    expected: ["margem media", "margem liquida"],
  },
  {
    category: "custos",
    view: "/",
    question: "onde estou gastando mais?",
    currentPeriod: "30d",
    expected: ["taxas", "frete"],
  },
  {
    category: "custos",
    view: "/",
    question: "quais despesas parecem fora do normal?",
    currentPeriod: "30d",
    expected: ["taxas", "frete"],
  },
  {
    category: "desempenho",
    view: "/",
    question: "resuma meu desempenho da semana",
    currentPeriod: "30d",
    expected: ["7 dias", "receita"],
  },
  {
    category: "desempenho",
    view: "/",
    question: "como esta meu desempenho?",
    currentPeriod: "7d",
    expected: ["7 dias", "receita"],
  },
  {
    category: "desempenho",
    view: "/",
    question: "como esta meu desempenho?",
    currentPeriod: "90d",
    expected: ["90 dias", "receita"],
  },
  {
    category: "desempenho",
    view: "/",
    question: "tive queda de lucro?",
    currentPeriod: "30d",
    expected: ["lucro", "comparativo"],
  },
  {
    category: "desempenho",
    view: "/",
    question: "tive queda de vendas?",
    currentPeriod: "30d",
    expected: ["receita", "pedidos"],
  },
  {
    category: "desempenho",
    view: "/",
    question: "qual a previsao para o proximo mes?",
    currentPeriod: "30d",
    expected: ["run rate", "proximo mes"],
  },
  {
    category: "alertas",
    view: "/",
    question: "quais alertas voce ve agora?",
    currentPeriod: "30d",
    expected: ["alertas", "pedido", "margem"],
  },
  {
    category: "alertas",
    view: "/",
    question: "me mostra os principais riscos do negocio",
    currentPeriod: "30d",
    expected: ["alertas", "margem", "sincronizacao"],
  },
  {
    category: "pedidos",
    view: "/pedidos",
    question: "quais pedidos estao pendentes?",
    currentPeriod: "30d",
    expected: ["pendente", "enviado"],
  },
  {
    category: "pedidos",
    view: "/pedidos",
    question: "quantos pedidos estao atrasados?",
    currentPeriod: "30d",
    expected: ["1 pedido", "atraso", "mouse gamer rgb"],
  },
  {
    category: "pedidos",
    view: "/pedidos",
    question: "qual meu pedido que mais gerou lucro?",
    currentPeriod: "30d",
    expected: ["nao tenho lucro por pedido", "cadeira gamer gx", "lucro por produto"],
  },
  {
    category: "pedidos",
    view: "/pedidos",
    question: "qual canal concentra mais pedidos?",
    currentPeriod: "30d",
    expected: ["Mercado Livre", "Shopee"],
  },
  {
    category: "produtos",
    view: "/produtos",
    question: "quais produtos estao pausados?",
    currentPeriod: "30d",
    expected: ["Mouse Gamer RGB", "pausado"],
  },
  {
    category: "produtos",
    view: "/produtos",
    question: "qual produto devo reativar?",
    currentPeriod: "30d",
    expected: ["Mouse Gamer RGB", "reativacao"],
  },
  {
    category: "produtos",
    view: "/produtos",
    question: "onde devo ajustar preco ou custo?",
    currentPeriod: "30d",
    expected: ["Cadeira Gamer GX", "preco", "custo"],
  },
  {
    category: "produtos",
    view: "/produtos",
    question: "que produto diferente faz sentido adicionar?",
    currentPeriod: "30d",
    expected: ["Webcam", "Mousepad", "Apoio Ergonomico"],
  },
  {
    category: "produtos",
    view: "/produtos",
    question: "qual produto eu deveria remover do catalogo?",
    currentPeriod: "30d",
    expected: ["Cadeira Gamer GX", "margem"],
  },
  {
    category: "canais",
    view: "/relatorios",
    question: "qual canal gera mais lucro?",
    currentPeriod: "30d",
    expected: ["Mercado Livre", "lucro"],
  },
  {
    category: "canais",
    view: "/relatorios",
    question: "qual canal esta pior?",
    currentPeriod: "30d",
    expected: ["Shopee", "canal"],
  },
  {
    category: "canais",
    view: "/relatorios",
    question: "me fale do mercado livre",
    currentPeriod: "30d",
    expected: ["Mercado Livre", "receita"],
  },
  {
    category: "contas",
    view: "/contas",
    question: "tem alguma conta com problema?",
    currentPeriod: "30d",
    expected: ["Loja Secundaria ML", "sincronizacao"],
  },
  {
    category: "contas",
    view: "/contas",
    question: "quais contas estao conectadas?",
    currentPeriod: "30d",
    expected: ["Loja Principal ML", "Loja Shopee 1"],
  },
  {
    category: "prioridades",
    view: "/",
    question: "o que precisa da minha atencao hoje?",
    currentPeriod: "30d",
    expected: ["pedido", "Cadeira Gamer GX", "Loja Secundaria ML"],
  },
];

async function runTestCase(testCase) {
  const { conversation } = await startConversation({
    currentView: testCase.view,
    period: testCase.currentPeriod || "30d",
  });
  const response = await replyToConversation(conversation.id, {
    message: testCase.question,
    currentView: testCase.view,
    period: testCase.currentPeriod || "30d",
  });
  const answer = response.assistantMessage.content || "";
  const normalizedAnswer = normalize(answer);
  const passed = testCase.expected.every((fragment) => normalizedAnswer.includes(normalize(fragment)));

  return {
    ...testCase,
    passed,
    answer,
    tone: response.assistantMessage.meta?.tone || "unknown",
  };
}

function normalize(value) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function printReport(results) {
  const passed = results.filter((result) => result.passed);
  const failed = results.filter((result) => !result.passed);

  console.log(`Assistant smoke test: ${passed.length}/${results.length} cenarios aprovados.`);

  for (const category of [...new Set(results.map((result) => result.category))]) {
    const scopedResults = results.filter((result) => result.category === category);
    const scopedPassed = scopedResults.filter((result) => result.passed).length;
    console.log(`- ${category}: ${scopedPassed}/${scopedResults.length}`);
  }

  if (!failed.length) {
    return;
  }

  console.log("\nCenarios para revisar:");

  for (const result of failed) {
    console.log(`\n[${result.category}] ${result.question}`);
    console.log(`Esperado: ${result.expected.join(" | ")}`);
    console.log(`Resposta: ${result.answer}`);
  }
}

async function main() {
  const results = [];

  for (const testCase of TEST_CASES) {
    results.push(await runTestCase(testCase));
  }

  if (process.argv.includes("--json")) {
    console.log(JSON.stringify(results, null, 2));
    return;
  }

  printReport(results);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
