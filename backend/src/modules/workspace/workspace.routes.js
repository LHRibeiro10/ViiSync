const express = require("express");

const {
  downloadMercadoLivreInvoiceDocument,
  fetchAutomations,
  fetchFinanceCenter,
  fetchIntegrationHub,
  fetchMercadoLivreInvoices,
  fetchOperationalCalendar,
  fetchProductDetail,
  deleteRecurringExpense,
  postDismissMercadoLivreInvoice,
  postRecurringExpense,
  postPullMercadoLivreInvoice,
  postPullPendingMercadoLivreInvoices,
  postAutomationToggle,
} = require("./workspace.controller");

const router = express.Router();

router.get("/products/:productId", fetchProductDetail);
router.get("/finance", fetchFinanceCenter);
router.post("/finance/recurring-expenses", postRecurringExpense);
router.delete("/finance/recurring-expenses/:expenseId", deleteRecurringExpense);
router.get("/finance/mercadolivre-invoices", fetchMercadoLivreInvoices);
router.get(
  "/finance/mercadolivre-invoices/:invoiceId/download/:format",
  downloadMercadoLivreInvoiceDocument
);
router.post("/finance/mercadolivre-invoices/pull-pending", postPullPendingMercadoLivreInvoices);
router.post(
  "/finance/mercadolivre-invoices/:invoiceId/dismiss",
  postDismissMercadoLivreInvoice
);
router.post("/finance/mercadolivre-invoices/:invoiceId/pull", postPullMercadoLivreInvoice);
router.get("/calendar", fetchOperationalCalendar);
router.get("/automations", fetchAutomations);
router.post("/automations/:ruleId/toggle", postAutomationToggle);
router.get("/integrations", fetchIntegrationHub);

module.exports = router;
