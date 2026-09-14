const { formatPercent, normalizeText } = require("../../assistantContext.service");
const { hasAny } = require("../shared");

function buildChannelReply(analysis, context) {
  const requestedChannel = analysis.requestedChannel;
  const targetChannel = requestedChannel
    ? context.channels.rows.find((channel) => normalizeText(channel.name) === requestedChannel)
    : null;
  const wantsWeakest = hasAny(analysis.normalizedMessage, [
    "pior",
    "mais fraco",
    "fraco",
    "menor lucro",
    "menos lucro",
  ]);
  const wantsStrongest = hasAny(analysis.normalizedMessage, [
    "mais lucro",
    "mais rentavel",
    "melhor canal",
    "canal lider",
    "gera mais lucro",
  ]);

  if (targetChannel) {
    return [
      `${targetChannel.name} aparece com ${targetChannel.revenue} de receita e ${targetChannel.profit} de lucro no consolidado atual.`,
      `A margem estimada desse canal esta em ${formatPercent(
        targetChannel.marginPercent
      )}.`,
      "Minha leitura: vale comparar esse retorno com o canal lider antes de aumentar investimento, porque receita isolada nao garante eficiencia.",
    ].join("\n\n");
  }

  if (wantsWeakest && context.channels.weakestChannel) {
    return [
      `${context.channels.weakestChannel.name} e o canal mais fraco em retorno relativo neste mock, com ${context.channels.weakestChannel.profit} de lucro.`,
      context.channels.strongestChannel
        ? `O contraste fica mais claro quando comparado com ${context.channels.strongestChannel.name}, que lidera com ${context.channels.strongestChannel.profit}.`
        : "Nao encontrei comparativo forte com o canal lider.",
      "Minha prioridade aqui seria revisar custo comercial e frete desse canal antes de aumentar volume nele.",
    ].join("\n\n");
  }

  if (wantsStrongest && context.channels.strongestChannel) {
    return [
      `${context.channels.strongestChannel.name} e hoje o canal mais rentavel, com ${context.channels.strongestChannel.profit} de lucro consolidado.`,
      context.channels.weakestChannel
        ? `${context.channels.weakestChannel.name} fica atras em retorno relativo, entao o diferencial provavelmente esta em taxa, frete ou mix.`
        : "Nao identifiquei um canal claramente abaixo dos demais.",
      "Minha leitura: preservar o canal lider faz mais sentido do que redistribuir verba sem revisar a eficiencia dos outros canais.",
    ].join("\n\n");
  }

  return [
    context.channels.strongestChannel
      ? `${context.channels.strongestChannel.name} e hoje o canal mais rentavel, com ${context.channels.strongestChannel.profit} de lucro consolidado.`
      : "Nao encontrei canal dominante no recorte atual.",
    context.channels.weakestChannel
      ? `${context.channels.weakestChannel.name} e o canal mais fraco em retorno relativo neste mock.`
      : "Nao encontrei contraste forte entre canais.",
    `Voce tem ${context.accounts.connectedCount} conta(s) conectada(s) e ${context.accounts.pendingCount} pendente(s) de sincronizacao.`,
    "Minha prioridade seria preservar o canal lider, revisar custos do canal mais fraco e resolver sincronizacoes pendentes para nao operar com leitura incompleta.",
  ].join("\n\n");
}

function buildConnectedAccountsReply(context) {
  const connectedAccounts = context.accounts.connectedAccounts || [];

  if (!connectedAccounts.length) {
    return [
      "No mock atual, nao existe conta conectada disponivel para detalhamento.",
      "Antes de analisar desempenho por canal, eu priorizaria restabelecer as integracoes.",
    ].join("\n\n");
  }

  return [
    `Hoje voce tem ${connectedAccounts.length} conta(s) conectada(s): ${connectedAccounts
      .map((account) => `${account.name} em ${account.marketplace}`)
      .join(", ")}.`,
    context.accounts.pendingCount > 0
      ? `Ainda existe ${context.accounts.pendingCount} conta(s) com pendencia de sincronizacao, entao sua leitura por canal ainda merece cautela.`
      : "No mock atual, nao existe pendencia relevante de sincronizacao.",
    "Minha recomendacao: manter as contas lideres saudaveis e tratar qualquer pendencia antes de confiar plenamente nos comparativos por marketplace.",
  ].join("\n\n");
}

function buildAccountReply(context) {
  const pendingAccounts = context.accounts.pendingAccounts || [];

  if (!pendingAccounts.length) {
    return [
      `Todas as ${context.accounts.connectedCount} conta(s) do mock aparecem sincronizadas sem pendencia relevante.`,
      "Nesse cenario, sua prioridade pode sair de integracao e migrar para operacao, margem e mix.",
    ].join("\n\n");
  }

  return [
    `Hoje existe ${pendingAccounts.length} conta(s) com pendencia de sincronizacao.`,
    `A principal conta em aberto e ${pendingAccounts[0].name}, ligada ao canal ${pendingAccounts[0].marketplace}.`,
    `No consolidado, ${context.accounts.connectedCount} conta(s) ja estao conectada(s) e ${context.accounts.pendingCount} ainda exigem atencao.`,
    "Minha recomendacao: resolver a sincronizacao pendente antes de tomar decisao comercial mais agressiva, porque ela pode distorcer a leitura de pedidos e desempenho por canal.",
  ].join("\n\n");
}

module.exports = {
  buildChannelReply,
  buildConnectedAccountsReply,
  buildAccountReply,
};
