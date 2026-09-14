const { normalizeText } = require("./shared");

const PORTFOLIO_CANDIDATE_POOL = [
  {
    name: "Webcam Full HD Stream Pro",
    themes: ["gamer", "home-office"],
    reason: "complementa teclado, fone e cadeira em kits de setup completo.",
  },
  {
    name: "Mousepad Deskmat XL",
    themes: ["gamer", "perifericos"],
    reason: "e um acessorio de giro mais leve para subir ticket medio em bundles.",
  },
  {
    name: "Apoio Ergonomico para Punho",
    themes: ["ergonomia", "perifericos"],
    reason: "reforca ergonomia e conversa bem com teclado e mouse.",
  },
  {
    name: "Hub USB-C 7 em 1",
    themes: ["home-office", "produtividade"],
    reason: "abre uma linha adjacente de produtividade sem fugir do perfil atual.",
  },
  {
    name: "Suporte Vertical para Notebook",
    themes: ["ergonomia", "home-office"],
    reason: "amplia o mix de organizacao e setup de trabalho.",
  },
];

function inferCatalogThemes(productName) {
  const normalizedName = normalizeText(productName);
  const themes = new Set();

  if (
    normalizedName.includes("gamer") ||
    normalizedName.includes("teclado") ||
    normalizedName.includes("mouse") ||
    normalizedName.includes("fone")
  ) {
    themes.add("gamer");
  }

  if (
    normalizedName.includes("teclado") ||
    normalizedName.includes("mouse") ||
    normalizedName.includes("fone")
  ) {
    themes.add("perifericos");
  }

  if (
    normalizedName.includes("cadeira") ||
    normalizedName.includes("suporte") ||
    normalizedName.includes("monitor")
  ) {
    themes.add("ergonomia");
    themes.add("home-office");
  }

  if (normalizedName.includes("audio") || normalizedName.includes("fone")) {
    themes.add("audio");
  }

  return [...themes];
}

function buildPortfolioIdeas(productRows) {
  const catalogNames = new Set(productRows.map((product) => normalizeText(product.name)));
  const themeCounts = productRows.reduce((accumulator, product) => {
    for (const theme of inferCatalogThemes(product.name)) {
      accumulator[theme] = (accumulator[theme] || 0) + 1;
    }

    return accumulator;
  }, {});

  const additionCandidates = PORTFOLIO_CANDIDATE_POOL.filter((candidate) => {
    return !catalogNames.has(normalizeText(candidate.name));
  })
    .map((candidate) => {
      const themeScore = candidate.themes.reduce((score, theme) => {
        return score + (themeCounts[theme] || 0);
      }, 0);

      return {
        ...candidate,
        score: themeScore,
      };
    })
    .sort((left, right) => right.score - left.score)
    .slice(0, 4)
    .map(({ score, ...candidate }) => candidate);

  return {
    themes: Object.keys(themeCounts).sort((left, right) => {
      return (themeCounts[right] || 0) - (themeCounts[left] || 0);
    }),
    additionCandidates,
  };
}

module.exports = {
  buildPortfolioIdeas,
};
