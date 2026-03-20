const express = require("express");
const cors = require("cors");
require("dotenv").config();

const {
  getAccounts,
  getChartData,
  getDashboard,
  getOrders,
  getProducts,
  getProfitReport,
  getProfitTable,
  getReports,
  getSettings,
} = require("./src/services/analyticsDb.service");
const assistantRoutes = require("./src/modules/assistant/assistant.routes");
const adminConsoleRoutes = require("./src/modules/adminConsole/adminConsole.routes");
const alertsRoutes = require("./src/modules/alerts/alerts.routes");
const authRoutes = require("./src/modules/auth/auth.routes");
const feedbackRoutes = require("./src/modules/feedback/feedback.routes");
const mercadolivreQuestionsRoutes = require("./src/modules/mercadolivreQuestions/mercadolivreQuestions.routes");
const workspaceRoutes = require("./src/modules/workspace/workspace.routes");
const {
  fetchMercadoLivreAuthorizationUrl,
  fetchMercadoLivreIntegrationStatus,
  handleMercadoLivreWebhook,
  handleMercadoLivreOAuthCallback,
} = require("./src/modules/mercadolivreQuestions/mercadolivreQuestions.controller");

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

function handleUnexpectedError(scope, error, res) {
  console.error(`[${scope}]`, error);
  res.status(500).json({
    error: "Nao foi possivel processar a solicitacao.",
  });
}

app.get("/", (req, res) => {
  res.json({ message: "API do ViiSync esta rodando." });
});

app.get("/dashboard", async (req, res) => {
  try {
    res.json(await getDashboard(req.query.period, req));
  } catch (error) {
    handleUnexpectedError("dashboard", error, res);
  }
});

app.get("/profit-table", async (req, res) => {
  try {
    res.json(await getProfitTable(req.query.period, req));
  } catch (error) {
    handleUnexpectedError("profit-table", error, res);
  }
});

app.get("/profit-report", async (req, res) => {
  try {
    res.json(await getProfitReport(req.query.period, req));
  } catch (error) {
    handleUnexpectedError("profit-report", error, res);
  }
});

app.get("/orders", async (req, res) => {
  try {
    res.json(await getOrders(req));
  } catch (error) {
    handleUnexpectedError("orders", error, res);
  }
});

app.get("/products", async (req, res) => {
  try {
    res.json(await getProducts(req));
  } catch (error) {
    handleUnexpectedError("products", error, res);
  }
});

app.get("/accounts", async (req, res) => {
  try {
    res.json(await getAccounts(req));
  } catch (error) {
    handleUnexpectedError("accounts", error, res);
  }
});

app.get("/reports", async (req, res) => {
  try {
    res.json(await getReports(req.query.period, req));
  } catch (error) {
    handleUnexpectedError("reports", error, res);
  }
});

app.get("/settings", async (req, res) => {
  try {
    res.json(await getSettings(req));
  } catch (error) {
    handleUnexpectedError("settings", error, res);
  }
});

app.get("/chart-data", async (req, res) => {
  try {
    res.json(await getChartData(req.query.period, req));
  } catch (error) {
    handleUnexpectedError("chart-data", error, res);
  }
});

app.use("/auth", authRoutes);
app.use("/alerts", alertsRoutes);
app.use("/", feedbackRoutes);
app.use("/workspace", workspaceRoutes);
app.use("/admin-console", adminConsoleRoutes);
app.use("/assistant", assistantRoutes);
app.get("/integrations/mercadolivre/status", fetchMercadoLivreIntegrationStatus);
app.get("/integrations/mercadolivre/auth/url", fetchMercadoLivreAuthorizationUrl);
app.get(
  "/integrations/mercadolivre/oauth/callback",
  handleMercadoLivreOAuthCallback
);
app.use("/integrations/mercadolivre", mercadolivreQuestionsRoutes);
app.post("/webhooks/mercadolivre", handleMercadoLivreWebhook);

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
