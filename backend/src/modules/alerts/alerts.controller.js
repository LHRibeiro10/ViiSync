const { getAlerts } = require("./alerts.service");

async function fetchAlerts(req, res) {
  try {
    res.json(await getAlerts(req.query.period, req));
  } catch (error) {
    console.error("[alerts]", error);
    res.status(500).json({
      error: "Nao foi possivel carregar a central de alertas.",
    });
  }
}

module.exports = {
  fetchAlerts,
};
