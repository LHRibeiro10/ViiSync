const {
  getAutomations,
  getFinanceCenter,
  getIntegrationHub,
  getOperationalCalendar,
  getProductDetail,
  toggleAutomationRule,
} = require("./workspace.service");
const {
  buildInvoicePayload,
  dismissInvoiceById,
  downloadInvoiceDocument,
  pullInvoiceById,
  pullPendingInvoices,
} = require("./mercadoLivreInvoices.service");

function sendError(res, error, fallbackMessage) {
  if (error.status) {
    return res.status(error.status).json({ error: error.message });
  }

  console.error("[workspace]", error);
  return res.status(500).json({ error: fallbackMessage });
}

function fetchProductDetail(req, res) {
  try {
    res.json(getProductDetail(req.params.productId, req.query.period));
  } catch (error) {
    sendError(res, error, "Nao foi possivel carregar o detalhe do produto.");
  }
}

async function fetchFinanceCenter(req, res) {
  try {
    res.json(await getFinanceCenter(req.query.period, req));
  } catch (error) {
    sendError(res, error, "Nao foi possivel carregar o centro financeiro.");
  }
}

function fetchOperationalCalendar(req, res) {
  try {
    res.json(getOperationalCalendar(req.query));
  } catch (error) {
    sendError(res, error, "Nao foi possivel carregar o calendario operacional.");
  }
}

function fetchAutomations(req, res) {
  try {
    res.json(getAutomations());
  } catch (error) {
    sendError(res, error, "Nao foi possivel carregar as automacoes.");
  }
}

function postAutomationToggle(req, res) {
  try {
    res.json(toggleAutomationRule(req.params.ruleId, req.body.enabled));
  } catch (error) {
    sendError(res, error, "Nao foi possivel atualizar a regra de automacao.");
  }
}

function fetchIntegrationHub(req, res) {
  try {
    res.json(getIntegrationHub());
  } catch (error) {
    sendError(res, error, "Nao foi possivel carregar o hub de integracoes.");
  }
}

async function fetchMercadoLivreInvoices(req, res) {
  try {
    res.json(await buildInvoicePayload(req.query.period, req));
  } catch (error) {
    sendError(res, error, "Nao foi possivel carregar as NFes do Mercado Livre.");
  }
}

async function postPullPendingMercadoLivreInvoices(req, res) {
  try {
    res.json(await pullPendingInvoices(req.body?.period || req.query.period, req));
  } catch (error) {
    sendError(res, error, "Nao foi possivel puxar as NFes pendentes.");
  }
}

async function postPullMercadoLivreInvoice(req, res) {
  try {
    res.json(await pullInvoiceById(req.params.invoiceId, req));
  } catch (error) {
    sendError(res, error, "Nao foi possivel puxar essa NFe.");
  }
}

async function postDismissMercadoLivreInvoice(req, res) {
  try {
    res.json(
      await dismissInvoiceById(
        req.params.invoiceId,
        req.body?.period || req.query.period,
        req
      )
    );
  } catch (error) {
    sendError(res, error, "Nao foi possivel excluir essa NFe da lista.");
  }
}

async function downloadMercadoLivreInvoiceDocument(req, res) {
  try {
    const documentPayload = await downloadInvoiceDocument(
      req.params.invoiceId,
      req.params.format,
      req
    );

    res.setHeader("Content-Type", documentPayload.contentType);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${documentPayload.fileName}"`
    );
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Content-Length", documentPayload.buffer.length);
    res.send(documentPayload.buffer);
  } catch (error) {
    sendError(res, error, "Nao foi possivel baixar esse documento.");
  }
}

module.exports = {
  downloadMercadoLivreInvoiceDocument,
  fetchAutomations,
  fetchFinanceCenter,
  fetchIntegrationHub,
  fetchMercadoLivreInvoices,
  fetchOperationalCalendar,
  fetchProductDetail,
  postDismissMercadoLivreInvoice,
  postPullMercadoLivreInvoice,
  postPullPendingMercadoLivreInvoices,
  postAutomationToggle,
};
