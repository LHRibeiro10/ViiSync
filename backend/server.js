const express = require("express");
const cors = require("cors");
require("dotenv").config();

const {
  createAdditionalCost,
  getAccounts,
  getChartData,
  getDashboard,
  listAdditionalCosts,
  getOrders,
  getProducts,
  getProfitReport,
  getProfitTable,
  getReports,
  getSettings,
  removeAdditionalCost,
  updateAdditionalCost,
} = require("./src/services/analyticsDb.service");
const assistantRoutes = require("./src/modules/assistant/assistant.routes");
const adminConsoleRoutes = require("./src/modules/adminConsole/adminConsole.routes");
const alertsRoutes = require("./src/modules/alerts/alerts.routes");
const authRoutes = require("./src/modules/auth/auth.routes");
const { requireAdmin, requireAuth } = require("./src/modules/auth/auth.middleware");
const feedbackRoutes = require("./src/modules/feedback/feedback.routes");
const mercadolivreQuestionsRoutes = require("./src/modules/mercadolivreQuestions/mercadolivreQuestions.routes");
const workspaceRoutes = require("./src/modules/workspace/workspace.routes");
const {
  handleMercadoLivreWebhook,
  handleMercadoLivreOAuthCallback,
} = require("./src/modules/mercadolivreQuestions/mercadolivreQuestions.controller");

const app = express();
const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || "0.0.0.0";

function buildCorsOptions() {
  const nodeEnv = String(process.env.NODE_ENV || "development").toLowerCase();
  const configuredOrigins = String(process.env.CORS_ALLOWED_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  const defaultDevelopmentOrigins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:4173",
    "http://127.0.0.1:4173",
  ];

  const allowedOrigins = new Set(
    nodeEnv === "production"
      ? configuredOrigins
      : [...defaultDevelopmentOrigins, ...configuredOrigins]
  );

  return {
    credentials: true,
    optionsSuccessStatus: 204,
    origin(origin, callback) {
      if (!origin) {
        callback(null, true);
        return;
      }

      if (allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error("Origin nao permitida pelo CORS."));
    },
  };
}

app.use(cors(buildCorsOptions()));
app.use(express.json());

function handleUnexpectedError(scope, error, res) {
  if (error && Number.isInteger(error.status) && error.status >= 400 && error.status < 500) {
    res.status(error.status).json({
      error: error.message,
    });
    return;
  }

  console.error(`[${scope}]`, error);
  res.status(500).json({
    error: "Nao foi possivel processar a solicitacao.",
  });
}

app.get("/", (req, res) => {
  res.json({ message: "API do ViiSync esta rodando." });
});

app.get("/dashboard", requireAuth, async (req, res) => {
  try {
    res.json(await getDashboard(req.query.period, req));
  } catch (error) {
    handleUnexpectedError("dashboard", error, res);
  }
});

app.get("/profit-table", requireAuth, async (req, res) => {
  try {
    res.json(await getProfitTable(req.query.period, req));
  } catch (error) {
    handleUnexpectedError("profit-table", error, res);
  }
});

app.get("/profit-report", requireAuth, async (req, res) => {
  try {
    res.json(await getProfitReport(req.query.period, req));
  } catch (error) {
    handleUnexpectedError("profit-report", error, res);
  }
});

app.get("/orders", requireAuth, async (req, res) => {
  try {
    res.json(await getOrders(req));
  } catch (error) {
    handleUnexpectedError("orders", error, res);
  }
});

app.get("/products", requireAuth, async (req, res) => {
  try {
    res.json(await getProducts(req));
  } catch (error) {
    handleUnexpectedError("products", error, res);
  }
});

app.get("/accounts", requireAuth, async (req, res) => {
  try {
    res.json(await getAccounts(req));
  } catch (error) {
    handleUnexpectedError("accounts", error, res);
  }
});

app.get("/reports", requireAuth, async (req, res) => {
  try {
    res.json(await getReports(req.query.period, req));
  } catch (error) {
    handleUnexpectedError("reports", error, res);
  }
});

app.get("/reports/additional-costs", requireAuth, async (req, res) => {
  try {
    res.json(await listAdditionalCosts(req.query.period, req));
  } catch (error) {
    handleUnexpectedError("additional-costs:list", error, res);
  }
});

app.post("/reports/additional-costs", requireAuth, async (req, res) => {
  try {
    res.status(201).json(
      await createAdditionalCost(req.body, req.body?.period || req.query.period, req)
    );
  } catch (error) {
    handleUnexpectedError("additional-costs:create", error, res);
  }
});

app.patch("/reports/additional-costs/:costId", requireAuth, async (req, res) => {
  try {
    res.json(
      await updateAdditionalCost(
        req.params.costId,
        req.body,
        req.body?.period || req.query.period,
        req
      )
    );
  } catch (error) {
    handleUnexpectedError("additional-costs:update", error, res);
  }
});

app.delete("/reports/additional-costs/:costId", requireAuth, async (req, res) => {
  try {
    res.json(
      await removeAdditionalCost(
        req.params.costId,
        req.body?.period || req.query.period,
        req
      )
    );
  } catch (error) {
    handleUnexpectedError("additional-costs:delete", error, res);
  }
});

app.get("/settings", requireAuth, async (req, res) => {
  try {
    res.json(await getSettings(req));
  } catch (error) {
    handleUnexpectedError("settings", error, res);
  }
});

app.get("/chart-data", requireAuth, async (req, res) => {
  try {
    res.json(await getChartData(req.query.period, req));
  } catch (error) {
    handleUnexpectedError("chart-data", error, res);
  }
});

app.use("/auth", authRoutes);
app.use("/alerts", requireAuth, alertsRoutes);
app.use("/", feedbackRoutes);
app.use("/workspace", requireAuth, workspaceRoutes);
app.use("/admin-console", requireAuth, requireAdmin, adminConsoleRoutes);
app.use("/assistant", requireAuth, assistantRoutes);
app.get(
  "/integrations/mercadolivre/callback",
  handleMercadoLivreOAuthCallback
);
app.get(
  "/integrations/mercadolivre/oauth/callback",
  handleMercadoLivreOAuthCallback
);
app.use("/integrations/mercadolivre", requireAuth, mercadolivreQuestionsRoutes);
app.post("/webhooks/mercadolivre", handleMercadoLivreWebhook);

const server = app.listen(PORT, HOST, () => {
  console.log(`Servidor rodando em http://${HOST}:${PORT}`);
});

server.on("error", (error) => {
  console.error("[server.listen:error]", error);
  process.exit(1);
});
