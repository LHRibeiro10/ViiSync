function createTimestamp({ hoursAgo = 0, minutesAgo = 0 }) {
  const offsetInMs = hoursAgo * 60 * 60 * 1000 + minutesAgo * 60 * 1000;

  return new Date(Date.now() - offsetInMs).toISOString();
}

const mercadolivreQuestionsSeed = [
  {
    id: "MLQ-882104",
    itemId: "MLB4871204410",
    itemTitle: "Fone Bluetooth X200 com Cancelamento de Ruido",
    questionText: "Esse fone acompanha cabo USB-C e nota fiscal?",
    answerText: null,
    status: "unanswered",
    createdAt: createTimestamp({ hoursAgo: 2, minutesAgo: 15 }),
    answeredAt: null,
    buyerNickname: "ana_compras_sp",
    thumbnail:
      "https://http2.mlstatic.com/D_Q_NP_2X_812345-MLB76543210123_052024-R.webp",
    sku: "FX200-USBC-BLK",
  },
  {
    id: "MLQ-882089",
    itemId: "MLB4871204410",
    itemTitle: "Fone Bluetooth X200 com Cancelamento de Ruido",
    questionText: "Ele conecta em dois aparelhos ao mesmo tempo?",
    answerText:
      "Sim. O modelo permite conexao multiponto com ate dois dispositivos compativeis.",
    status: "answered",
    createdAt: createTimestamp({ hoursAgo: 28 }),
    answeredAt: createTimestamp({ hoursAgo: 26, minutesAgo: 40 }),
    buyerNickname: "rafi_eletronicos",
    thumbnail:
      "https://http2.mlstatic.com/D_Q_NP_2X_812345-MLB76543210123_052024-R.webp",
    sku: "FX200-USBC-BLK",
  },
  {
    id: "MLQ-881944",
    itemId: "MLB4923001788",
    itemTitle: "Teclado Mecanico K500 RGB Switch Azul",
    questionText: "As teclas sao ABNT2? Serve para home office tambem?",
    answerText:
      "Sim. Esse lote e ABNT2 e atende bem tanto para digitacao quanto para uso gamer.",
    status: "answered",
    createdAt: createTimestamp({ hoursAgo: 49 }),
    answeredAt: createTimestamp({ hoursAgo: 45, minutesAgo: 10 }),
    buyerNickname: "lu_souza90",
    thumbnail:
      "https://http2.mlstatic.com/D_Q_NP_2X_734455-MLB71234509876_082023-R.webp",
    sku: "TK500-RGB-BLUE",
  },
  {
    id: "MLQ-881901",
    itemId: "MLB4984421781",
    itemTitle: "Mouse Gamer RGB 12400 DPI com 7 botoes",
    questionText: "Tem software para configurar macro e DPI?",
    answerText: null,
    status: "unanswered",
    createdAt: createTimestamp({ hoursAgo: 19, minutesAgo: 35 }),
    answeredAt: null,
    buyerNickname: "game_store_rj",
    thumbnail:
      "https://http2.mlstatic.com/D_Q_NP_2X_923455-MLB77889900112_022024-R.webp",
    sku: "MGRGB-12400-BLK",
  },
  {
    id: "MLQ-881877",
    itemId: "MLB5039107782",
    itemTitle: "Cadeira Gamer GX Reclinavel com Apoio Lombar",
    questionText: "Qual o peso maximo suportado? Vem desmontada?",
    answerText:
      "Suporta ate 120 kg e vai parcialmente desmontada com manual e kit de montagem.",
    status: "answered",
    createdAt: createTimestamp({ hoursAgo: 60 }),
    answeredAt: createTimestamp({ hoursAgo: 56, minutesAgo: 20 }),
    buyerNickname: "setup_prime",
    thumbnail:
      "https://http2.mlstatic.com/D_Q_NP_2X_887766-MLB79990011223_012024-R.webp",
    sku: "CGGX-BLK-120",
  },
  {
    id: "MLQ-881850",
    itemId: "MLB5102843391",
    itemTitle: "Webcam Full HD 1080p com Microfone Duplo",
    questionText: "Funciona bem no Teams e no Meet? Precisa instalar driver?",
    answerText:
      "Funciona em Teams, Meet e Zoom no modo plug and play, sem driver adicional na maioria dos casos.",
    status: "answered",
    createdAt: createTimestamp({ hoursAgo: 11, minutesAgo: 50 }),
    answeredAt: createTimestamp({ hoursAgo: 10, minutesAgo: 30 }),
    buyerNickname: "fernando.ofertas",
    thumbnail:
      "https://http2.mlstatic.com/D_Q_NP_2X_665544-MLB70001122334_032024-R.webp",
    sku: "WC1080-MIC-DUAL",
  },
  {
    id: "MLQ-881804",
    itemId: "MLB4923001788",
    itemTitle: "Teclado Mecanico K500 RGB Switch Azul",
    questionText: "Voces tem esse modelo com switch vermelho ou outra cor?",
    answerText: null,
    status: "unanswered",
    createdAt: createTimestamp({ hoursAgo: 37, minutesAgo: 25 }),
    answeredAt: null,
    buyerNickname: "setup_do_vini",
    thumbnail:
      "https://http2.mlstatic.com/D_Q_NP_2X_734455-MLB71234509876_082023-R.webp",
    sku: "TK500-RGB-BLUE",
  },
  {
    id: "MLQ-881721",
    itemId: "MLB5204431177",
    itemTitle: "Suporte Articulado para Monitor 17 a 32 polegadas",
    questionText: "Esse suporte aguenta monitor ultrawide de 29 polegadas?",
    answerText:
      "Sim, desde que o monitor esteja dentro do limite de peso indicado no anuncio e siga o padrao VESA compativel.",
    status: "answered",
    createdAt: createTimestamp({ hoursAgo: 84 }),
    answeredAt: createTimestamp({ hoursAgo: 80, minutesAgo: 15 }),
    buyerNickname: "loja.homeoffice",
    thumbnail:
      "https://http2.mlstatic.com/D_Q_NP_2X_112233-MLB74445566778_102023-R.webp",
    sku: "SUP-ART-32-VESA",
  },
  {
    id: "MLQ-881690",
    itemId: "MLB5257110080",
    itemTitle: "Hub USB-C 7 em 1 HDMI 4K",
    questionText: "Passa energia pelo USB-C enquanto uso HDMI e leitor de cartao?",
    answerText: null,
    status: "unanswered",
    createdAt: createTimestamp({ hoursAgo: 5, minutesAgo: 40 }),
    answeredAt: null,
    buyerNickname: "carla.tech",
    thumbnail:
      "https://http2.mlstatic.com/D_Q_NP_2X_998877-MLB78889900123_012024-R.webp",
    sku: "HUB7EM1-4K-SL",
  },
  {
    id: "MLQ-881644",
    itemId: "MLB4984421781",
    itemTitle: "Mouse Gamer RGB 12400 DPI com 7 botoes",
    questionText: "Ele e compativel com Mac ou so Windows?",
    answerText:
      "Ele funciona em Mac para uso basico. O software avancado de macro e personalizacao foi pensado para Windows.",
    status: "answered",
    createdAt: createTimestamp({ hoursAgo: 16, minutesAgo: 10 }),
    answeredAt: createTimestamp({ hoursAgo: 13, minutesAgo: 40 }),
    buyerNickname: "marcos.dev",
    thumbnail:
      "https://http2.mlstatic.com/D_Q_NP_2X_923455-MLB77889900112_022024-R.webp",
    sku: "MGRGB-12400-BLK",
  },
  {
    id: "MLQ-881612",
    itemId: "MLB5319902455",
    itemTitle: "Kit Iluminacao LED para Setup com Controle",
    questionText: "A fita pode ser cortada? Tem memoria da ultima cor usada?",
    answerText: null,
    status: "unanswered",
    createdAt: createTimestamp({ hoursAgo: 51, minutesAgo: 5 }),
    answeredAt: null,
    buyerNickname: "bruna.setup",
    thumbnail:
      "https://http2.mlstatic.com/D_Q_NP_2X_556677-MLB73334455667_112023-R.webp",
    sku: "LEDKIT-RGB-5M",
  },
  {
    id: "MLQ-881540",
    itemId: "MLB5102843391",
    itemTitle: "Webcam Full HD 1080p com Microfone Duplo",
    questionText: "A imagem fica boa em ambiente com pouca luz?",
    answerText:
      "Ela tem correcao automatica de baixa luz e atende bem em escritorio interno, mas rende melhor com iluminacao frontal moderada.",
    status: "answered",
    createdAt: createTimestamp({ hoursAgo: 92 }),
    answeredAt: createTimestamp({ hoursAgo: 88, minutesAgo: 50 }),
    buyerNickname: "edu.sales",
    thumbnail:
      "https://http2.mlstatic.com/D_Q_NP_2X_665544-MLB70001122334_032024-R.webp",
    sku: "WC1080-MIC-DUAL",
  },
];

module.exports = {
  mercadolivreQuestionsSeed,
};
