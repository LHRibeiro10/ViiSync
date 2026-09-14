function buildInventoryReply(context) {
  const pausedProduct = context.products.pausedProducts[0];

  return [
    "No mock atual, eu nao tenho dados reais de estoque ou ruptura por SKU.",
    pausedProduct
      ? `${pausedProduct.name} esta pausado, mas isso nao prova estoque baixo. Pode ser decisao comercial, margem ou operacao.`
      : "Como nao existe telemetria de estoque neste dataset, eu evitaria concluir ruptura sem uma fonte dedicada.",
    "Se voce quiser, eu posso te orientar com base em margem e giro do mix, mas nao seria correto afirmar disponibilidade de estoque com os dados atuais.",
  ].join("\n\n");
}

function buildCampaignReply(context) {
  const topRevenueProduct = context.products.topRevenueProducts[0];
  const topProfitProduct = context.products.topProfitProducts[0];
  const strongestChannel = context.channels.strongestChannel;
  const worstMarginProduct = context.products.lowestMarginProducts[0];

  return [
    "Se a ideia for montar uma campanha comercial com os dados do mock atual, eu faria algo simples e orientado a margem.",
    topRevenueProduct && topProfitProduct
      ? `Usaria ${topRevenueProduct.name} como isca de volume e ${topProfitProduct.name} como referencia de rentabilidade para nao crescer faturamento devolvendo lucro.`
      : "Eu separaria o produto de volume do produto de margem antes de investir em promocao.",
    strongestChannel
      ? `Comecaria pelo canal ${strongestChannel.name}, que hoje concentra o melhor retorno.`
      : "Eu validaria primeiro qual canal esta devolvendo melhor lucro antes de escalar verba.",
    worstMarginProduct
      ? `Evitaria desconto agressivo em ${worstMarginProduct.name}, porque ele ja opera com margem pressionada.`
      : "Evitaria campanhas profundas em itens com margem curta.",
  ].join("\n\n");
}

function buildSecurityReply() {
  return [
    "Consigo te orientar de forma geral, mas o mock atual nao traz eventos reais de seguranca, acesso ou troca de senha.",
    "Como regra pratica, trocar senha, ativar 2FA e revisar acessos faz sentido sempre que houver compartilhamento de conta, senha antiga ou suspeita de acesso indevido.",
    "Se quiser, eu posso te passar um checklist curto de seguranca operacional para sellers dentro do ViiSync.",
  ].join("\n\n");
}

function buildOutOfScopeReply() {
  return [
    "Eu sou especializada no contexto do ViiSync: vendas, margem, pedidos, canais, despesas, produtos e operacao do seller.",
    "Essa pergunta foge do escopo dos dados mockados que estou usando agora.",
    "Se quiser, me pergunte algo como produto lider, margem, custo, risco operacional, contas conectadas ou sugestoes de mix.",
  ].join("\n\n");
}

module.exports = {
  buildInventoryReply,
  buildCampaignReply,
  buildSecurityReply,
  buildOutOfScopeReply,
};
