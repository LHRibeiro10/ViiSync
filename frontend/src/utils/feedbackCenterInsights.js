const FEEDBACK_TYPE_UI = {
  complaint: {
    tone: "danger",
    subtitle: "Reclamacao",
    spotlightTitle: "Relato de reclamacao",
    spotlightDescription:
      "Descreva impacto operacional, recorrencia e o que precisa ser corrigido primeiro.",
  },
  bug: {
    tone: "warning",
    subtitle: "Falha tecnica",
    spotlightTitle: "Relato de bug",
    spotlightDescription:
      "Informe passo a passo do erro para acelerar reproducao e correcoes do time.",
  },
  feature: {
    tone: "accent",
    subtitle: "Sugestao de melhoria",
    spotlightTitle: "Sugestao de funcionalidade",
    spotlightDescription:
      "Explique o ganho esperado para sua operacao e como essa melhoria ajuda no dia a dia.",
  },
  feedback: {
    tone: "neutral",
    subtitle: "Percepcao geral",
    spotlightTitle: "Feedback de experiencia",
    spotlightDescription:
      "Compartilhe percepcao de uso para orientar ajustes de experiencia e clareza do produto.",
  },
};

function getFeedbackTypeUi(type) {
  return FEEDBACK_TYPE_UI[type] || FEEDBACK_TYPE_UI.feedback;
}

function getHistoryFollowUpCopy(item) {
  if (item.statusTone === "success") {
    return "Item resolvido. Use este historico como referencia para novos envios.";
  }

  if (item.statusTone === "warning") {
    return "Em analise pelo time. Aguarde retorno oficial neste mesmo painel.";
  }

  if (item.statusTone === "danger") {
    return "Recebido e aguardando triagem inicial. Manteremos atualizacao por aqui.";
  }

  return "Envio registrado. Acompanhe o status para novas orientacoes operacionais.";
}

export { getFeedbackTypeUi, getHistoryFollowUpCopy };
