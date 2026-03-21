const {
  completeAuthorizationCallback,
  disconnectIntegration,
  dismissAnsweredQuestions,
  dismissQuestion,
  getAuthorizationUrl,
  getIntegrationStatus,
  listMarketplaceItems,
  listMarketplaceOrders,
  MercadoLivreQuestionNotFoundError,
  MercadoLivreQuestionValidationError,
  refreshIntegrationToken,
  getQuestionById,
  listQuestions,
  receiveWebhook,
  refreshQuestions,
  replyQuestion,
  syncItems,
  syncMarketplaceData,
  syncOrders,
  syncQuestions,
} = require("./mercadolivreQuestions.service");

async function fetchQuestions(req, res) {
  try {
    const payload = await listQuestions(req.query, req);
    res.json(payload);
  } catch (error) {
    handleMercadoLivreError(error, res);
  }
}

async function fetchQuestionById(req, res) {
  try {
    const payload = await getQuestionById(req.params.questionId, req);
    res.json(payload);
  } catch (error) {
    handleMercadoLivreError(error, res);
  }
}

async function postQuestionReply(req, res) {
  try {
    const payload = await replyQuestion(req.params.questionId, req.body.text, req);
    res.status(201).json(payload);
  } catch (error) {
    handleMercadoLivreError(error, res);
  }
}

async function postDismissQuestion(req, res) {
  try {
    const payload = await dismissQuestion(req.params.questionId, req.body, req);
    res.json(payload);
  } catch (error) {
    handleMercadoLivreError(error, res);
  }
}

async function postDismissAnsweredQuestions(req, res) {
  try {
    const payload = await dismissAnsweredQuestions(req.body, req);
    res.json(payload);
  } catch (error) {
    handleMercadoLivreError(error, res);
  }
}

async function postRefreshQuestions(req, res) {
  try {
    const payload = await refreshQuestions(req.body, req);
    res.json(payload);
  } catch (error) {
    handleMercadoLivreError(error, res);
  }
}

async function postSyncQuestions(req, res) {
  try {
    const payload = await syncQuestions(req.body, req);
    res.json(payload);
  } catch (error) {
    handleMercadoLivreError(error, res);
  }
}

async function handleMercadoLivreWebhook(req, res) {
  try {
    const payload = await receiveWebhook(req.body);
    res.status(202).json(payload);
  } catch (error) {
    handleMercadoLivreError(error, res);
  }
}

async function fetchMercadoLivreIntegrationStatus(req, res) {
  try {
    const payload = await getIntegrationStatus(req);
    res.json(payload);
  } catch (error) {
    handleMercadoLivreError(error, res);
  }
}

async function fetchMercadoLivreAuthorizationUrl(req, res) {
  try {
    const payload = await getAuthorizationUrl(req.query, req);
    res.json(payload);
  } catch (error) {
    handleMercadoLivreError(error, res);
  }
}

async function startMercadoLivreAuthorization(req, res) {
  try {
    const payload = await getAuthorizationUrl(req.query, req);
    res.redirect(payload.authorizationUrl);
  } catch (error) {
    handleMercadoLivreError(error, res);
  }
}

async function handleMercadoLivreOAuthCallback(req, res) {
  try {
    const payload = await completeAuthorizationCallback(req.query, req);
    const acceptsHtml = String(req.headers.accept || "")
      .toLowerCase()
      .includes("text/html");

    if (!acceptsHtml) {
      res.json(payload);
      return;
    }

    const frontendBaseUrl = String(process.env.FRONTEND_BASE_URL || "http://localhost:5173")
      .trim()
      .replace(/\/$/, "");
    const redirectTarget = `${frontendBaseUrl}/usuario?tab=integracoes&ml=connected`;
    const safeRedirectTarget = JSON.stringify(redirectTarget);

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(`<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <title>Mercado Livre conectado</title>
  </head>
  <body>
    <p>Conta Mercado Livre conectada. Retornando para o ViiSync...</p>
    <script>
      (function () {
        var target = ${safeRedirectTarget};
        if (window.opener && !window.opener.closed) {
          try {
            window.opener.location.href = target;
            window.close();
            return;
          } catch (error) {
          }
        }

        window.location.href = target;
      })();
    </script>
  </body>
</html>`);
  } catch (error) {
    handleMercadoLivreError(error, res);
  }
}

async function postMercadoLivreTokenRefresh(req, res) {
  try {
    const payload = await refreshIntegrationToken(req);
    res.json(payload);
  } catch (error) {
    handleMercadoLivreError(error, res);
  }
}

async function postMercadoLivreDisconnect(req, res) {
  try {
    const payload = await disconnectIntegration(req);
    res.json(payload);
  } catch (error) {
    handleMercadoLivreError(error, res);
  }
}

async function postSyncOrders(req, res) {
  try {
    const payload = await syncOrders(req.body || {}, req);
    res.json(payload);
  } catch (error) {
    handleMercadoLivreError(error, res);
  }
}

async function postSyncItems(req, res) {
  try {
    const payload = await syncItems(req.body || {}, req);
    res.json(payload);
  } catch (error) {
    handleMercadoLivreError(error, res);
  }
}

async function postSyncMarketplaceData(req, res) {
  try {
    const payload = await syncMarketplaceData(req.body || {}, req);
    res.json(payload);
  } catch (error) {
    handleMercadoLivreError(error, res);
  }
}

async function fetchMercadoLivreOrders(req, res) {
  try {
    const payload = await listMarketplaceOrders(req.query, req);
    res.json(payload);
  } catch (error) {
    handleMercadoLivreError(error, res);
  }
}

async function fetchMercadoLivreItems(req, res) {
  try {
    const payload = await listMarketplaceItems(req.query, req);
    res.json(payload);
  } catch (error) {
    handleMercadoLivreError(error, res);
  }
}

function handleMercadoLivreError(error, res) {
  if (error instanceof MercadoLivreQuestionValidationError) {
    res.status(400).json({ error: error.message });
    return;
  }

  if (error instanceof MercadoLivreQuestionNotFoundError) {
    res.status(404).json({ error: error.message });
    return;
  }

  if (error && Number.isInteger(error.status) && error.status >= 400 && error.status < 500) {
    res.status(error.status).json({ error: error.message });
    return;
  }

  console.error("[mercadolivre-questions]", error);
  res.status(500).json({
    error: "Nao foi possivel processar as perguntas do Mercado Livre.",
  });
}

module.exports = {
  fetchQuestionById,
  fetchQuestions,
  fetchMercadoLivreAuthorizationUrl,
  fetchMercadoLivreItems,
  fetchMercadoLivreIntegrationStatus,
  fetchMercadoLivreOrders,
  handleMercadoLivreWebhook,
  handleMercadoLivreOAuthCallback,
  postMercadoLivreDisconnect,
  postMercadoLivreTokenRefresh,
  startMercadoLivreAuthorization,
  postDismissAnsweredQuestions,
  postDismissQuestion,
  postQuestionReply,
  postRefreshQuestions,
  postSyncItems,
  postSyncMarketplaceData,
  postSyncOrders,
  postSyncQuestions,
};
