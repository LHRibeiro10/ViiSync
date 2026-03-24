const { getProfitReport } = require("../../services/analyticsDb.service");
const { resolveSessionContextFromRequest } = require("../auth/auth.service");
const { resolvePeriod, resolvePeriodRange } = require("../../lib/period");

const invoiceStateByUserId = new Map();

function cloneData(value) {
  return JSON.parse(JSON.stringify(value));
}

function createHttpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

async function resolveViewerUserId(request = {}) {
  const sessionContext = await resolveSessionContextFromRequest(request);

  if (!sessionContext?.user?.id) {
    throw createHttpError(401, "Sessao invalida ou expirada.");
  }

  return sessionContext.user.id;
}

function getInvoiceState(userId) {
  if (!invoiceStateByUserId.has(userId)) {
    invoiceStateByUserId.set(userId, {
      items: [],
      initialized: false,
      initializingPromise: null,
      lastPullAt: null,
    });
  }

  return invoiceStateByUserId.get(userId);
}

function parseReportDate(dateText) {
  const [day, month, year] = String(dateText || "")
    .split("/")
    .map(Number);

  if (!day || !month || !year) {
    return new Date(0);
  }

  return new Date(Date.UTC(year, month - 1, day, 14, 0, 0));
}

function padNumber(value, size) {
  return String(value).padStart(size, "0");
}

function buildInvoiceKey(index, issuedDate) {
  const month = padNumber(issuedDate.getUTCMonth() + 1, 2);
  const day = padNumber(issuedDate.getUTCDate(), 2);
  return `3526${month}${day}${padNumber(index + 1, 9)}5501000000001${padNumber(index + 1, 8)}`;
}

function buildStoragePath(row) {
  return `mercadolivre/nfes/${row.id}`;
}

function buildDocumentUrlFromPath(storagePath, extension) {
  return `/storage/${storagePath}.${extension}`;
}

function buildDocumentUrl(row, extension) {
  return buildDocumentUrlFromPath(buildStoragePath(row), extension);
}

function escapeXml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function escapePdfText(value) {
  return String(value ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function buildInvoiceDownloadBaseName(invoice) {
  return `ml-nfe-${invoice.invoiceNumber}-${invoice.externalId}`.toLowerCase();
}

function buildInvoiceXmlContent(invoice) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<mercadoLivreInvoice>
  <invoiceId>${escapeXml(invoice.id)}</invoiceId>
  <externalId>${escapeXml(invoice.externalId)}</externalId>
  <orderId>${escapeXml(invoice.orderId)}</orderId>
  <marketplace>${escapeXml(invoice.marketplace)}</marketplace>
  <itemTitle>${escapeXml(invoice.itemTitle)}</itemTitle>
  <invoiceNumber>${escapeXml(invoice.invoiceNumber)}</invoiceNumber>
  <series>${escapeXml(invoice.series)}</series>
  <amount>${escapeXml(invoice.amount)}</amount>
  <issuedAt>${escapeXml(invoice.issuedAt)}</issuedAt>
  <accessKey>${escapeXml(invoice.accessKey)}</accessKey>
  <storagePath>${escapeXml(invoice.storagePath)}</storagePath>
</mercadoLivreInvoice>
`;
}

function buildPdfBuffer(lines) {
  const contentLines = ["BT", "/F1 12 Tf", "50 760 Td"];

  lines.forEach((line, index) => {
    const command = `(${escapePdfText(line)}) Tj`;

    if (index === 0) {
      contentLines.push(command);
      return;
    }

    contentLines.push(`0 -18 Td ${command}`);
  });

  contentLines.push("ET");

  const stream = contentLines.join("\n");
  const objects = [
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj",
    "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj",
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj",
    `4 0 obj\n<< /Length ${Buffer.byteLength(stream, "utf8")} >>\nstream\n${stream}\nendstream\nendobj`,
    "5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj",
  ];

  let pdf = "%PDF-1.4\n";
  const offsets = [0];

  objects.forEach((objectText) => {
    offsets.push(Buffer.byteLength(pdf, "utf8"));
    pdf += `${objectText}\n`;
  });

  const xrefStart = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";

  for (let index = 1; index < offsets.length; index += 1) {
    pdf += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }

  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

  return Buffer.from(pdf, "utf8");
}

function buildInvoicePdfContent(invoice) {
  return buildPdfBuffer([
    "ViiSync - DANFE Mercado Livre",
    `NFe ${invoice.invoiceNumber} / serie ${invoice.series}`,
    `Pedido ${invoice.orderId}`,
    `Produto: ${invoice.itemTitle}`,
    `Valor: R$ ${Number(invoice.amount || 0).toFixed(2)}`,
    `Emitida em: ${invoice.issuedAt}`,
    `Chave: ${invoice.accessKey}`,
    `Storage: ${invoice.storagePath}`,
  ]);
}

async function createInvoiceSeed(request = {}) {
  const rows = await getProfitReport("90d", request);

  return rows
    .filter((row) => String(row.marketplace || "").toLowerCase().includes("mercado livre"))
    .sort((left, right) => parseReportDate(left.date) - parseReportDate(right.date))
    .map((row, index) => {
      const issuedAt = parseReportDate(row.date).toISOString();
      const isDownloaded = index === 0;
      const storagePath = buildStoragePath(row);

      return {
        id: `ml-nfe-${row.id}`,
        externalId: row.id,
        marketplace: "Mercado Livre",
        orderId: `MLB-${row.id.toUpperCase()}`,
        itemTitle: row.product,
        invoiceNumber: padNumber(4100 + index + 1, 6),
        series: "1",
        amount: row.grossRevenue,
        issuedAt,
        status: isDownloaded ? "downloaded" : "pending",
        downloadedAt: isDownloaded ? issuedAt : null,
        fileName: isDownloaded ? `${row.id}-nfe.xml` : null,
        accessKey: buildInvoiceKey(index, parseReportDate(row.date)),
        xmlUrl: isDownloaded ? buildDocumentUrl(row, "xml") : null,
        pdfUrl: isDownloaded ? buildDocumentUrl(row, "pdf") : null,
        downloadedXmlAt: isDownloaded ? issuedAt : null,
        downloadedPdfAt: isDownloaded ? issuedAt : null,
        storagePath,
        dismissedAt: null,
      };
    });
}

async function ensureInvoiceStore(request = {}) {
  const userId = await resolveViewerUserId(request);
  const state = getInvoiceState(userId);

  if (state.initialized) {
    return { userId, state };
  }

  if (!state.initializingPromise) {
    state.initializingPromise = createInvoiceSeed(request)
      .then((seed) => {
        state.items = seed;
        state.initialized = true;
      })
      .finally(() => {
        state.initializingPromise = null;
      });
  }

  await state.initializingPromise;
  return { userId, state };
}

function mapInvoiceItem(invoice) {
  const xmlDownloaded = Boolean(invoice.downloadedXmlAt && invoice.xmlUrl);
  const pdfDownloaded = Boolean(invoice.downloadedPdfAt && invoice.pdfUrl);

  return {
    ...cloneData(invoice),
    isDownloaded: invoice.status === "downloaded",
    statusLabel: invoice.status === "downloaded" ? "Baixada" : "Nao baixada",
    statusTone: invoice.status === "downloaded" ? "success" : "warning",
    canPull: invoice.status !== "downloaded",
    canDismiss: invoice.status === "downloaded",
    xmlDownloaded,
    pdfDownloaded,
    xmlStatusLabel: xmlDownloaded ? "XML disponivel" : "XML pendente",
    pdfStatusLabel: pdfDownloaded ? "PDF disponivel" : "PDF pendente",
  };
}

async function buildInvoicePayload(period = "30d", request = {}) {
  const { state } = await ensureInvoiceStore(request);
  const resolvedPeriod = resolvePeriod(period);
  const periodRange = resolvePeriodRange(resolvedPeriod, { fallbackPeriod: "30d" });
  const periodStart = periodRange.startDate;
  const periodEnd = periodRange.endDate;
  const items = state.items
    .filter((invoice) => !invoice.dismissedAt)
    .filter((invoice) => {
      const issuedTimestamp = new Date(invoice.issuedAt).getTime();
      return (
        issuedTimestamp >= periodStart.getTime() &&
        issuedTimestamp <= periodEnd.getTime()
      );
    })
    .sort((left, right) => new Date(right.issuedAt) - new Date(left.issuedAt))
    .map(mapInvoiceItem);

  return {
    period: periodRange.period,
    provider: "mercado-livre-invoices",
    integrationReady: true,
    meta: {
      total: items.length,
      pendingCount: items.filter((item) => !item.isDownloaded).length,
      downloadedCount: items.filter((item) => item.isDownloaded).length,
      xmlDownloadedCount: items.filter((item) => item.xmlDownloaded).length,
      pdfDownloadedCount: items.filter((item) => item.pdfDownloaded).length,
      lastPullAt: state.lastPullAt,
    },
    items,
  };
}

async function pullPendingInvoices(period = "30d", request = {}) {
  const { state } = await ensureInvoiceStore(request);
  const payload = await buildInvoicePayload(period, request);
  const pendingIds = new Set(
    payload.items.filter((item) => item.canPull).map((item) => item.id)
  );

  if (!pendingIds.size) {
    return {
      ...payload,
      message: "Nao ha NFes pendentes para baixar nesse periodo.",
      pulledCount: 0,
    };
  }

  const now = new Date().toISOString();

  state.items = state.items.map((invoice) => {
    if (!pendingIds.has(invoice.id)) {
      return invoice;
    }

    return {
      ...invoice,
      status: "downloaded",
      downloadedAt: now,
      fileName: `${invoice.id}.xml`,
      xmlUrl: invoice.xmlUrl || buildDocumentUrlFromPath(invoice.storagePath, "xml"),
      pdfUrl: invoice.pdfUrl || buildDocumentUrlFromPath(invoice.storagePath, "pdf"),
      downloadedXmlAt: now,
      downloadedPdfAt: now,
    };
  });

  state.lastPullAt = now;

  return {
    ...(await buildInvoicePayload(period, request)),
    message: `${pendingIds.size} NFe(s) marcada(s) como baixadas.`,
    pulledCount: pendingIds.size,
  };
}

async function pullInvoiceById(invoiceId, request = {}) {
  const { state } = await ensureInvoiceStore(request);
  const invoiceIndex = state.items.findIndex((invoice) => invoice.id === invoiceId);

  if (invoiceIndex === -1) {
    throw createHttpError(404, "NFe nao encontrada.");
  }

  const currentInvoice = state.items[invoiceIndex];

  if (currentInvoice.status === "downloaded") {
    return {
      message: "Essa NFe ja estava marcada como baixada.",
      invoice: mapInvoiceItem(currentInvoice),
    };
  }

  const now = new Date().toISOString();

  state.items[invoiceIndex] = {
    ...currentInvoice,
    status: "downloaded",
    downloadedAt: now,
    fileName: `${currentInvoice.id}.xml`,
    xmlUrl:
      currentInvoice.xmlUrl ||
      buildDocumentUrlFromPath(currentInvoice.storagePath, "xml"),
    pdfUrl:
      currentInvoice.pdfUrl ||
      buildDocumentUrlFromPath(currentInvoice.storagePath, "pdf"),
    downloadedXmlAt: now,
    downloadedPdfAt: now,
  };

  state.lastPullAt = now;

  return {
    message: "NFe marcada como baixada.",
    invoice: mapInvoiceItem(state.items[invoiceIndex]),
  };
}

async function dismissInvoiceById(invoiceId, period = "30d", request = {}) {
  const { state } = await ensureInvoiceStore(request);
  const invoiceIndex = state.items.findIndex((invoice) => invoice.id === invoiceId);

  if (invoiceIndex === -1) {
    throw createHttpError(404, "NFe nao encontrada.");
  }

  const currentInvoice = state.items[invoiceIndex];

  if (currentInvoice.dismissedAt) {
    return {
      ...(await buildInvoicePayload(period, request)),
      message: "Essa NFe ja foi removida da lista.",
    };
  }

  if (currentInvoice.status !== "downloaded") {
    throw createHttpError(409, "So e possivel excluir da lista NFes ja baixadas.");
  }

  state.items[invoiceIndex] = {
    ...currentInvoice,
    dismissedAt: new Date().toISOString(),
  };

  return {
    ...(await buildInvoicePayload(period, request)),
    message: "NFe removida da lista visivel.",
  };
}

async function downloadInvoiceDocument(invoiceId, format = "xml", request = {}) {
  const { state } = await ensureInvoiceStore(request);
  const resolvedFormat = format === "pdf" ? "pdf" : "xml";
  const invoice = state.items.find((item) => item.id === invoiceId);

  if (!invoice) {
    throw createHttpError(404, "NFe nao encontrada.");
  }

  if (resolvedFormat === "xml" && (!invoice.downloadedXmlAt || !invoice.xmlUrl)) {
    throw createHttpError(409, "XML ainda nao esta disponivel para download.");
  }

  if (resolvedFormat === "pdf" && (!invoice.downloadedPdfAt || !invoice.pdfUrl)) {
    throw createHttpError(409, "PDF ainda nao esta disponivel para download.");
  }

  return {
    buffer:
      resolvedFormat === "xml"
        ? Buffer.from(buildInvoiceXmlContent(invoice), "utf8")
        : buildInvoicePdfContent(invoice),
    contentType:
      resolvedFormat === "xml"
        ? "application/xml; charset=utf-8"
        : "application/pdf",
    fileName: `${buildInvoiceDownloadBaseName(invoice)}.${resolvedFormat}`,
  };
}

module.exports = {
  buildInvoicePayload,
  dismissInvoiceById,
  downloadInvoiceDocument,
  pullInvoiceById,
  pullPendingInvoices,
};
