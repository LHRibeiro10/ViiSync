import { useEffect, useState } from "react";
import {
  createAdditionalReportCost,
  getAdditionalReportCosts,
  getProfitReport,
  getReports,
  removeAdditionalReportCost,
} from "../services/api";
import PageHeader from "../components/PageHeader";
import SummaryCard from "../components/SummaryCard";
import Panel from "../components/Panel";
import { useAnalyticsPeriod } from "../contexts/useAnalyticsPeriod";
import { getPeriodLabel } from "../utils/period";
import "./Reports.css";

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const integerFormatter = new Intl.NumberFormat("pt-BR", {
  maximumFractionDigits: 0,
});

const percentFormatter = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const monthReferenceFormatter = new Intl.DateTimeFormat("pt-BR", {
  month: "long",
  year: "numeric",
});

const createdAtFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const SHOULD_AGGREGATE_UNIT_SALE_PRICE = false;

const PROFIT_REPORT_CSV_HEADER = [
  "Data",
  "Marketplace",
  "Produto",
  "Fornecedor",
  "QTD.",
  "Pre\u00e7o Venda",
  "Custo Produto",
  "Taxa Marketplace",
  "Frete Pago",
  "Receita Bruta",
  "Lucro L\u00edquido",
  "Margem Lucro %",
  "ROI",
];

const ADDITIONAL_EXPENSES_CSV_HEADER = [
  "Descricao",
  "Valor",
  "Mes de referencia",
  "Data de criacao",
];

const EXCEL_CURRENCY_FORMAT = '[$R$-416] #,##0.00';
const EXCEL_PERCENT_FORMAT = "0.00%";
const EXCEL_BORDER = {
  top: { style: "thin", color: { argb: "D8E1EE" } },
  left: { style: "thin", color: { argb: "D8E1EE" } },
  bottom: { style: "thin", color: { argb: "D8E1EE" } },
  right: { style: "thin", color: { argb: "D8E1EE" } },
};

function formatCurrency(value) {
  return currencyFormatter.format(Number.isFinite(value) ? value : 0);
}

function formatInteger(value) {
  const numericValue =
    typeof value === "number" ? value : parseCurrencyValue(value);

  return integerFormatter.format(Number.isFinite(numericValue) ? numericValue : 0);
}

function formatPercentage(value) {
  return `${percentFormatter.format(Number.isFinite(value) ? value : 0)}%`;
}

function getDefaultMonthReference() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");

  return `${year}-${month}`;
}

function formatMonthReference(value) {
  if (!value) {
    return "";
  }

  const [year, month] = value.split("-").map(Number);

  if (!year || !month) {
    return value;
  }

  return monthReferenceFormatter.format(new Date(year, month - 1, 1));
}

function formatCreatedAt(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return createdAtFormatter.format(date);
}

function parseCurrencyValue(value) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  const text = String(value ?? "").trim();

  if (!text) {
    return 0;
  }

  if (text.includes(",")) {
    const normalized = text
      .replace(/[^\d,.-]/g, "")
      .replace(/\./g, "")
      .replace(",", ".");

    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  const normalizedText = text.replace(/[^\d.-]/g, "");
  const dotGroups = normalizedText.split(".");

  if (dotGroups.length > 1 && dotGroups[dotGroups.length - 1].length === 3) {
    const parsedThousands = Number(normalizedText.replace(/\./g, ""));
    return Number.isFinite(parsedThousands) ? parsedThousands : 0;
  }

  const parsed = Number(normalizedText);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getValueTone(value) {
  if (value > 0) {
    return "positive";
  }

  if (value < 0) {
    return "negative";
  }

  return "neutral";
}

function calculateProfitReportSummary(rows) {
  const summary = rows.reduce(
    (accumulator, row) => {
      const profitMargin = parseCurrencyValue(row.profitMargin);
      const roi = parseCurrencyValue(row.roi);

      return {
        quantity: accumulator.quantity + parseCurrencyValue(row.quantity),
        salePrice: accumulator.salePrice + parseCurrencyValue(row.salePrice),
        productCost: accumulator.productCost + parseCurrencyValue(row.productCost),
        marketplaceFee:
          accumulator.marketplaceFee + parseCurrencyValue(row.marketplaceFee),
        shippingPaid:
          accumulator.shippingPaid + parseCurrencyValue(row.shippingPaid),
        grossRevenue:
          accumulator.grossRevenue + parseCurrencyValue(row.grossRevenue),
        netProfit: accumulator.netProfit + parseCurrencyValue(row.netProfit),
        profitMarginTotal: accumulator.profitMarginTotal + profitMargin,
        profitMarginCount:
          accumulator.profitMarginCount + (Number.isFinite(profitMargin) ? 1 : 0),
        roiTotal: accumulator.roiTotal + roi,
        roiCount: accumulator.roiCount + (Number.isFinite(roi) ? 1 : 0),
      };
    },
    {
      quantity: 0,
      salePrice: 0,
      productCost: 0,
      marketplaceFee: 0,
      shippingPaid: 0,
      grossRevenue: 0,
      netProfit: 0,
      profitMarginTotal: 0,
      profitMarginCount: 0,
      roiTotal: 0,
      roiCount: 0,
    }
  );

  return {
    ...summary,
    averageProfitMargin: summary.profitMarginCount
      ? summary.profitMarginTotal / summary.profitMarginCount
      : 0,
    averageRoi: summary.roiCount ? summary.roiTotal / summary.roiCount : 0,
  };
}

function groupExpensesByMonth(expenses) {
  const expensesByMonth = expenses.reduce((accumulator, expense) => {
    const monthReference = expense.monthReference || "";

    if (!accumulator.has(monthReference)) {
      accumulator.set(monthReference, []);
    }

    accumulator.get(monthReference).push(expense);

    return accumulator;
  }, new Map());

  return Array.from(expensesByMonth.entries())
    .sort(([firstMonth], [secondMonth]) => firstMonth.localeCompare(secondMonth))
    .map(([monthReference, monthExpenses]) => {
      const items = [...monthExpenses].sort((firstExpense, secondExpense) => {
        const firstTimestamp = new Date(firstExpense.createdAt).getTime();
        const secondTimestamp = new Date(secondExpense.createdAt).getTime();

        return (
          (Number.isFinite(firstTimestamp) ? firstTimestamp : 0) -
          (Number.isFinite(secondTimestamp) ? secondTimestamp : 0)
        );
      });

      return {
        monthReference,
        label: formatMonthReference(monthReference),
        items,
        total: items.reduce((total, expense) => total + expense.value, 0),
      };
    });
}

function buildMonthlyReportRows(rows) {
  return rows.map((row) => {
    const revenueValue = parseCurrencyValue(row.revenue);
    const profitValue = parseCurrencyValue(row.profit);
    const ordersValue = parseCurrencyValue(row.orders);
    const marginValue = revenueValue ? (profitValue / revenueValue) * 100 : 0;

    return {
      ...row,
      revenueValue,
      profitValue,
      ordersValue,
      marginValue,
    };
  });
}

function calculateMonthlyReportSummary(rows) {
  const totals = rows.reduce(
    (accumulator, row) => ({
      revenue: accumulator.revenue + row.revenueValue,
      profit: accumulator.profit + row.profitValue,
      orders: accumulator.orders + row.ordersValue,
    }),
    {
      revenue: 0,
      profit: 0,
      orders: 0,
    }
  );

  return {
    ...totals,
    marginValue: totals.revenue ? (totals.profit / totals.revenue) * 100 : 0,
  };
}

function formatPeriodLabel(period) {
  return getPeriodLabel(period);
}

function buildChannelPerformance(rows) {
  const channels = rows.reduce((accumulator, row) => {
    const key = row.marketplace;
    const currentChannel = accumulator.get(key) || {
      id: key.toLowerCase().replace(/\s+/g, "-"),
      name: key,
      revenueValue: 0,
      profitValue: 0,
    };

    currentChannel.revenueValue += parseCurrencyValue(row.grossRevenue);
    currentChannel.profitValue += parseCurrencyValue(row.netProfit);
    accumulator.set(key, currentChannel);

    return accumulator;
  }, new Map());

  return Array.from(channels.values())
    .sort((left, right) => right.revenueValue - left.revenueValue)
    .map((channel) => ({
      ...channel,
      revenue: formatCurrency(channel.revenueValue),
      profit: formatCurrency(channel.profitValue),
    }));
}

function buildTopProfitableProducts(rows, limit = 3) {
  const productsByProfit = rows.reduce((accumulator, row) => {
    const key = row.product;
    const currentProduct = accumulator.get(key) || {
      id: key.toLowerCase().replace(/\s+/g, "-"),
      name: key,
      profitValue: 0,
    };

    currentProduct.profitValue += parseCurrencyValue(row.netProfit);
    accumulator.set(key, currentProduct);

    return accumulator;
  }, new Map());

  return Array.from(productsByProfit.values())
    .sort((left, right) => right.profitValue - left.profitValue)
    .slice(0, limit)
    .map((product) => ({
      ...product,
      profit: formatCurrency(product.profitValue),
    }));
}

function triggerFileDownload(filename, blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

async function createWorkbook() {
  const excelModule = await import("exceljs");
  const ExcelLibrary = excelModule.default;
  const workbook = new ExcelLibrary.Workbook();

  workbook.creator = "ViiSync";
  workbook.lastModifiedBy = "ViiSync";
  workbook.created = new Date();
  workbook.modified = new Date();
  workbook.properties.date1904 = false;

  return workbook;
}

const EXCEL_DEFAULT_LINE_COLOR = { indexed: 64 };
const EXCEL_SOFT_LINE_COLOR = { argb: "FFD8E1EE" };
const EXCEL_TITLE_FILL = {
  type: "pattern",
  pattern: "solid",
  fgColor: { theme: 4, tint: 0.7999816888943144 },
};

function getExcelColumnLetter(columnNumber) {
  let dividend = columnNumber;
  let columnName = "";

  while (dividend > 0) {
    const modulo = (dividend - 1) % 26;
    columnName = String.fromCharCode(65 + modulo) + columnName;
    dividend = Math.floor((dividend - modulo) / 26);
  }

  return columnName;
}

function createBorderSide(style, color = EXCEL_DEFAULT_LINE_COLOR) {
  return style ? { style, color } : undefined;
}

function createCellBorder({
  topStyle,
  topColor = EXCEL_DEFAULT_LINE_COLOR,
  bottomStyle,
  bottomColor = EXCEL_DEFAULT_LINE_COLOR,
  leftStyle,
  leftColor = EXCEL_DEFAULT_LINE_COLOR,
  rightStyle,
  rightColor = EXCEL_DEFAULT_LINE_COLOR,
}) {
  return {
    top: createBorderSide(topStyle, topColor),
    bottom: createBorderSide(bottomStyle, bottomColor),
    left: createBorderSide(leftStyle, leftColor),
    right: createBorderSide(rightStyle, rightColor),
  };
}

function setCellStyle(cell, { font, fill, alignment, numFmt } = {}) {
  if (font) {
    cell.font = font;
  }

  if (fill) {
    cell.fill = fill;
  }

  if (alignment) {
    cell.alignment = alignment;
  }

  if (numFmt) {
    cell.numFmt = numFmt;
  }
}

function mergeAndStyleRange(
  worksheet,
  {
    startRow,
    endRow = startRow,
    startColumn,
    endColumn,
    value,
    font,
    fill,
    alignment,
    topStyle,
    topColor = EXCEL_DEFAULT_LINE_COLOR,
    bottomStyle,
    bottomColor = EXCEL_DEFAULT_LINE_COLOR,
    leftStyle,
    leftColor = EXCEL_DEFAULT_LINE_COLOR,
    rightStyle,
    rightColor = EXCEL_DEFAULT_LINE_COLOR,
  }
) {
  worksheet.mergeCells(
    `${getExcelColumnLetter(startColumn)}${startRow}:${getExcelColumnLetter(endColumn)}${endRow}`
  );

  worksheet.getCell(startRow, startColumn).value = value;

  for (let rowNumber = startRow; rowNumber <= endRow; rowNumber += 1) {
    for (let columnNumber = startColumn; columnNumber <= endColumn; columnNumber += 1) {
      const cell = worksheet.getCell(rowNumber, columnNumber);

      setCellStyle(cell, {
        font,
        fill,
        alignment,
      });

      cell.border = createCellBorder({
        topStyle: rowNumber === startRow ? topStyle : undefined,
        topColor,
        bottomStyle: rowNumber === endRow ? bottomStyle : undefined,
        bottomColor,
        leftStyle: columnNumber === startColumn ? leftStyle : undefined,
        leftColor,
        rightStyle: columnNumber === endColumn ? rightStyle : undefined,
        rightColor,
      });
    }
  }
}

function addSparseRow(worksheet, totalColumns, entries) {
  const rowValues = Array.from({ length: totalColumns }, () => null);

  entries.forEach(([columnNumber, value]) => {
    rowValues[columnNumber - 1] = value;
  });

  return worksheet.addRow(rowValues);
}

function addSheetTitle(worksheet, title, subtitle, { startColumn, endColumn }) {
  mergeAndStyleRange(worksheet, {
    startRow: 1,
    endRow: 1,
    startColumn,
    endColumn,
    value: title,
    font: {
      name: "Segoe UI",
      size: 18,
      bold: true,
      color: { argb: "FF0F172A" },
    },
    fill: EXCEL_TITLE_FILL,
    alignment: { vertical: "middle", horizontal: "center" },
    topStyle: "medium",
    bottomStyle: "medium",
    leftStyle: "medium",
    rightStyle: "medium",
  });

  mergeAndStyleRange(worksheet, {
    startRow: 2,
    endRow: 3,
    startColumn,
    endColumn,
    value: subtitle,
    font: {
      name: "Segoe UI",
      size: 10,
      color: { argb: "FF64748B" },
    },
    alignment: { vertical: "middle", horizontal: "left" },
    topStyle: "medium",
    leftStyle: "medium",
    rightStyle: "medium",
  });

  worksheet.getRow(1).height = 27;
  worksheet.getRow(2).height = 15;
  worksheet.getRow(3).height = 9;
}

function addSectionBanner(
  worksheet,
  rowNumber,
  title,
  {
    startColumn,
    endColumn,
    topStyle = "thin",
    topColor = EXCEL_SOFT_LINE_COLOR,
    bottomStyle,
    bottomColor = EXCEL_SOFT_LINE_COLOR,
  }
) {
  mergeAndStyleRange(worksheet, {
    startRow: rowNumber,
    endRow: rowNumber,
    startColumn,
    endColumn,
    value: title,
    font: {
      name: "Segoe UI",
      size: 11,
      bold: true,
      color: { argb: "FF1D4ED8" },
    },
    fill: {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFEFF6FF" },
    },
    alignment: { vertical: "middle", horizontal: "center" },
    topStyle,
    topColor,
    bottomStyle,
    bottomColor,
    leftStyle: "medium",
    rightStyle: "medium",
  });

  worksheet.getRow(rowNumber).height = 16.5;
}

function styleSummaryLabelCell(
  cell,
  {
    leftStyle = "thin",
    rightStyle = "thin",
    topStyle = "thin",
    bottomStyle = "thin",
    topColor = EXCEL_DEFAULT_LINE_COLOR,
    bottomColor = EXCEL_DEFAULT_LINE_COLOR,
  } = {}
) {
  setCellStyle(cell, {
    font: {
      name: "Segoe UI",
      size: 10,
      bold: true,
      color: { argb: "FF475569" },
    },
    fill: {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFF8FAFC" },
    },
    alignment: { vertical: "middle", horizontal: "left" },
  });

  cell.border = createCellBorder({
    topStyle,
    topColor,
    bottomStyle,
    bottomColor,
    leftStyle,
    rightStyle,
  });
}

function styleSummaryValueCell(
  cell,
  {
    leftStyle = "thin",
    rightStyle = "thin",
    topStyle = "thin",
    bottomStyle = "thin",
    topColor = EXCEL_DEFAULT_LINE_COLOR,
    bottomColor = EXCEL_DEFAULT_LINE_COLOR,
    fontColor = "FF0F172A",
    fillColor = "FFFFFFFF",
    alignment = "right",
  } = {}
) {
  setCellStyle(cell, {
    font: {
      name: "Segoe UI",
      size: 11,
      bold: true,
      color: { argb: fontColor },
    },
    fill: {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: fillColor },
    },
    alignment: { vertical: "middle", horizontal: alignment },
  });

  cell.border = createCellBorder({
    topStyle,
    topColor,
    bottomStyle,
    bottomColor,
    leftStyle,
    rightStyle,
  });
}

function styleTableHeaderRow(row, startColumn, endColumn) {
  row.height = 24;

  for (let columnNumber = startColumn; columnNumber <= endColumn; columnNumber += 1) {
    const cell = row.getCell(columnNumber);

    setCellStyle(cell, {
      font: {
        name: "Segoe UI",
        size: 10,
        bold: true,
        color: { argb: "FFFFFFFF" },
      },
      fill: {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF0F172A" },
      },
      alignment: {
        vertical: "middle",
        horizontal: "center",
        wrapText: true,
      },
    });

    cell.border = createCellBorder({
      topStyle: "thin",
      bottomStyle: "thin",
      leftStyle: columnNumber === startColumn ? "medium" : "thin",
      rightStyle: columnNumber === endColumn ? "medium" : "thin",
    });
  }
}

function styleDataRow(
  row,
  startColumn,
  endColumn,
  isStriped = false,
  { firstColumnBold = false } = {}
) {
  row.height = 22;

  for (let columnNumber = startColumn; columnNumber <= endColumn; columnNumber += 1) {
    const cell = row.getCell(columnNumber);

    setCellStyle(cell, {
      font: {
        name: "Segoe UI",
        size: 10,
        bold: firstColumnBold && columnNumber === startColumn,
        color: { argb: "FF0F172A" },
      },
      fill: {
        type: "pattern",
        pattern: "solid",
        fgColor: {
          argb: isStriped ? "FFF8FBFF" : "FFFFFFFF",
        },
      },
      alignment: { vertical: "middle", horizontal: "left" },
    });

    cell.border = createCellBorder({
      topStyle: "thin",
      bottomStyle: "thin",
      leftStyle: columnNumber === startColumn ? "medium" : "thin",
      rightStyle: columnNumber === endColumn ? "medium" : "thin",
    });
  }
}

function applyCurrencyFormat(cell) {
  cell.numFmt = EXCEL_CURRENCY_FORMAT;
  cell.alignment = { vertical: "middle", horizontal: "right" };
}

function applyPercentFormat(cell) {
  cell.numFmt = EXCEL_PERCENT_FORMAT;
  cell.alignment = { vertical: "middle", horizontal: "right" };
}

function applyIntegerFormat(cell) {
  cell.numFmt = "0";
  cell.alignment = { vertical: "middle", horizontal: "right" };
}

function styleTotalRow(
  row,
  startColumn,
  endColumn,
  tone = "neutral",
  {
    topStyle = "thin",
    topColor = EXCEL_SOFT_LINE_COLOR,
    bottomStyle = "thin",
    bottomColor = EXCEL_SOFT_LINE_COLOR,
  } = {}
) {
  const fillColors = {
    positive: "FFECFDF3",
    negative: "FFFFF1F2",
    neutral: "FFEEF4FF",
  };
  const fontColors = {
    positive: "FF15803D",
    negative: "FFBE123C",
    neutral: "FF1D4ED8",
  };

  row.height = 21.95;

  for (let columnNumber = startColumn; columnNumber <= endColumn; columnNumber += 1) {
    const cell = row.getCell(columnNumber);

    setCellStyle(cell, {
      font: {
        name: "Segoe UI",
        size: 10,
        bold: true,
        color: { argb: fontColors[tone] || fontColors.neutral },
      },
      fill: {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: fillColors[tone] || fillColors.neutral },
      },
      alignment: {
        vertical: "middle",
        horizontal: columnNumber === startColumn ? "left" : "right",
      },
    });

    cell.border = createCellBorder({
      topStyle,
      topColor,
      bottomStyle,
      bottomColor,
      leftStyle: columnNumber === startColumn ? "medium" : "thin",
      leftColor:
        columnNumber === startColumn ? EXCEL_DEFAULT_LINE_COLOR : EXCEL_SOFT_LINE_COLOR,
      rightStyle: columnNumber === endColumn ? "medium" : "thin",
      rightColor:
        columnNumber === endColumn ? EXCEL_DEFAULT_LINE_COLOR : EXCEL_SOFT_LINE_COLOR,
    });
  }
}

function finalizeWorksheetLayout(
  worksheet,
  { headerRowNumber, startColumn, endColumn, activeCellColumn = startColumn + 1 }
) {
  worksheet.views = [
    {
      state: "frozen",
      xSplit: 0,
      ySplit: headerRowNumber,
      topLeftCell: `A${headerRowNumber + 1}`,
      showRuler: true,
      showRowColHeaders: true,
      showGridLines: true,
      zoomScale: 100,
      zoomScaleNormal: 100,
      activeCell: `${getExcelColumnLetter(activeCellColumn)}${headerRowNumber}`,
    },
  ];
  worksheet.autoFilter = `${getExcelColumnLetter(startColumn)}${headerRowNumber}:${getExcelColumnLetter(endColumn)}${headerRowNumber}`;
}

async function buildProfitReportWorkbook(rows, summary, netProfitFinal = summary.netProfit) {
  const workbook = await createWorkbook();
  const worksheet = workbook.addWorksheet("Rentabilidade", {
    properties: { defaultRowHeight: 20 },
  });
  const startColumn = 2;
  const endColumn = 14;
  const totalColumns = endColumn;

  worksheet.columns = [
    { width: 8.28515625 },
    { width: 18 },
    { width: 16.28515625 },
    { width: 24.140625 },
    { width: 17.7109375 },
    { width: 15 },
    { width: 17.5703125 },
    { width: 18 },
    { width: 14 },
    { width: 16 },
    { width: 16 },
    { width: 14 },
    { width: 12 },
    { width: 11.5703125 },
  ];

  addSheetTitle(
    worksheet,
    "Relatorio de Rentabilidade ViiSync",
    `Gerado em ${formatCreatedAt(new Date().toISOString())}`,
    {
      startColumn,
      endColumn,
    }
  );

  addSectionBanner(worksheet, 4, "Resumo executivo", {
    startColumn,
    endColumn,
  });

  const summaryRowA = addSparseRow(worksheet, totalColumns, [
    [2, "Quantidade total"],
    [3, summary.quantity],
    [7, "Receita bruta total"],
    [8, summary.grossRevenue],
    [12, "Lucro liquido total"],
    [13, netProfitFinal],
  ]);
  summaryRowA.height = 16.5;
  styleSummaryLabelCell(summaryRowA.getCell(2), { leftStyle: "medium" });
  styleSummaryValueCell(summaryRowA.getCell(3));
  styleSummaryLabelCell(summaryRowA.getCell(7));
  styleSummaryValueCell(summaryRowA.getCell(8));
  styleSummaryLabelCell(summaryRowA.getCell(12));
  styleSummaryValueCell(summaryRowA.getCell(13), {
    fontColor: netProfitFinal >= 0 ? "FF15803D" : "FFBE123C",
  });
  summaryRowA.getCell(14).border = createCellBorder({
    topStyle: "thin",
    bottomStyle: "thin",
    rightStyle: "medium",
  });
  applyIntegerFormat(summaryRowA.getCell(3));
  applyCurrencyFormat(summaryRowA.getCell(8));
  applyCurrencyFormat(summaryRowA.getCell(13));

  const summaryRowB = addSparseRow(worksheet, totalColumns, [
    [2, "Custo produto total"],
    [3, summary.productCost],
    [7, "Taxa marketplace"],
    [8, summary.marketplaceFee],
    [12, "Frete pago"],
    [13, summary.shippingPaid],
  ]);
  summaryRowB.height = 16.5;
  styleSummaryLabelCell(summaryRowB.getCell(2), { leftStyle: "medium" });
  styleSummaryValueCell(summaryRowB.getCell(3));
  styleSummaryLabelCell(summaryRowB.getCell(7));
  styleSummaryValueCell(summaryRowB.getCell(8));
  styleSummaryLabelCell(summaryRowB.getCell(12));
  styleSummaryValueCell(summaryRowB.getCell(13));
  summaryRowB.getCell(14).border = createCellBorder({
    topStyle: "thin",
    bottomStyle: "thin",
    rightStyle: "medium",
  });
  applyCurrencyFormat(summaryRowB.getCell(3));
  applyCurrencyFormat(summaryRowB.getCell(8));
  applyCurrencyFormat(summaryRowB.getCell(13));

  const summaryRowC = addSparseRow(worksheet, totalColumns, [
    [2, "Margem media"],
    [3, summary.averageProfitMargin / 100],
    [7, "ROI medio"],
    [8, summary.averageRoi / 100],
    [12, "Registros"],
    [13, rows.length],
  ]);
  summaryRowC.height = 16.5;
  styleSummaryLabelCell(summaryRowC.getCell(2), { leftStyle: "medium" });
  styleSummaryValueCell(summaryRowC.getCell(3));
  styleSummaryLabelCell(summaryRowC.getCell(7));
  styleSummaryValueCell(summaryRowC.getCell(8));
  styleSummaryLabelCell(summaryRowC.getCell(12));
  styleSummaryValueCell(summaryRowC.getCell(13));
  summaryRowC.getCell(14).border = createCellBorder({
    topStyle: "thin",
    bottomStyle: "thin",
    rightStyle: "medium",
  });
  applyPercentFormat(summaryRowC.getCell(3));
  applyPercentFormat(summaryRowC.getCell(8));
  applyIntegerFormat(summaryRowC.getCell(13));

  worksheet.addRow([]);
  worksheet.getRow(8).height = 20.1;

  const headerRow = addSparseRow(
    worksheet,
    totalColumns,
    PROFIT_REPORT_CSV_HEADER.map((header, index) => [startColumn + index, header])
  );
  styleTableHeaderRow(headerRow, startColumn, endColumn);

  rows.forEach((row, index) => {
    const worksheetRow = addSparseRow(worksheet, totalColumns, [
      [2, row.date],
      [3, row.marketplace],
      [4, row.product],
      [5, row.supplier],
      [6, row.quantity],
      [7, row.salePrice],
      [8, row.productCost],
      [9, row.marketplaceFee],
      [10, row.shippingPaid],
      [11, row.grossRevenue],
      [12, row.netProfit],
      [13, row.profitMargin / 100],
      [14, row.roi / 100],
    ]);

    styleDataRow(worksheetRow, startColumn, endColumn, index % 2 === 1);
    applyIntegerFormat(worksheetRow.getCell(6));
    applyCurrencyFormat(worksheetRow.getCell(7));
    applyCurrencyFormat(worksheetRow.getCell(8));
    applyCurrencyFormat(worksheetRow.getCell(9));
    applyCurrencyFormat(worksheetRow.getCell(10));
    applyCurrencyFormat(worksheetRow.getCell(11));
    applyCurrencyFormat(worksheetRow.getCell(12));
    applyPercentFormat(worksheetRow.getCell(13));
    applyPercentFormat(worksheetRow.getCell(14));
  });

  worksheet.addRow([]);
  worksheet.getRow(worksheet.rowCount).height = 20.1;
  addSectionBanner(worksheet, worksheet.rowCount + 1, "Totais consolidados", {
    startColumn,
    endColumn,
    bottomStyle: "thin",
    bottomColor: EXCEL_SOFT_LINE_COLOR,
  });

  const totalRow = addSparseRow(worksheet, totalColumns, [
    [2, "Total geral"],
    [3, ""],
    [4, ""],
    [5, ""],
    [6, summary.quantity],
    [7, SHOULD_AGGREGATE_UNIT_SALE_PRICE ? summary.salePrice : null],
    [8, summary.productCost],
    [9, summary.marketplaceFee],
    [10, summary.shippingPaid],
    [11, summary.grossRevenue],
    [12, netProfitFinal],
    [13, null],
    [14, null],
  ]);
  styleTotalRow(totalRow, startColumn, endColumn, getValueTone(netProfitFinal));
  applyIntegerFormat(totalRow.getCell(6));
  if (SHOULD_AGGREGATE_UNIT_SALE_PRICE) {
    applyCurrencyFormat(totalRow.getCell(7));
  }
  applyCurrencyFormat(totalRow.getCell(8));
  applyCurrencyFormat(totalRow.getCell(9));
  applyCurrencyFormat(totalRow.getCell(10));
  applyCurrencyFormat(totalRow.getCell(11));
  applyCurrencyFormat(totalRow.getCell(12));

  const averageRow = addSparseRow(worksheet, totalColumns, [
    [2, "Medias"],
    [12, ""],
    [13, summary.averageProfitMargin / 100],
    [14, summary.averageRoi / 100],
  ]);
  styleTotalRow(averageRow, startColumn, endColumn, "neutral", {
    bottomStyle: "medium",
    bottomColor: EXCEL_DEFAULT_LINE_COLOR,
  });
  applyPercentFormat(averageRow.getCell(13));
  applyPercentFormat(averageRow.getCell(14));

  finalizeWorksheetLayout(worksheet, {
    headerRowNumber: headerRow.number,
    startColumn,
    endColumn,
    activeCellColumn: 7,
  });

  return workbook;
}

async function buildAdditionalExpensesWorkbook(
  expenseGroups,
  totalAdditionalExpenses,
  adjustedProfit
) {
  const workbook = await createWorkbook();
  const worksheet = workbook.addWorksheet("Custos adicionais", {
    properties: { defaultRowHeight: 20 },
  });
  const startColumn = 2;
  const endColumn = 5;
  const totalColumns = endColumn;

  worksheet.columns = [
    { width: 10.42578125 },
    { width: 33.28515625 },
    { width: 16.5703125 },
    { width: 21.28515625 },
    { width: 19.28515625 },
  ];

  addSheetTitle(
    worksheet,
    "Custos Adicionais Mensais ViiSync",
    `Gerado em ${formatCreatedAt(new Date().toISOString())}`,
    {
      startColumn,
      endColumn,
    }
  );

  addSectionBanner(worksheet, 4, "Resumo executivo", {
    startColumn,
    endColumn,
  });

  const summaryRowA = addSparseRow(worksheet, totalColumns, [
    [2, "Meses agrupados"],
    [3, expenseGroups.length],
    [4, "Total de custos"],
    [5, totalAdditionalExpenses],
  ]);
  summaryRowA.height = 16.5;
  styleSummaryLabelCell(summaryRowA.getCell(2), { leftStyle: "medium" });
  styleSummaryValueCell(summaryRowA.getCell(3));
  styleSummaryLabelCell(summaryRowA.getCell(4));
  styleSummaryValueCell(summaryRowA.getCell(5), {
    rightStyle: "medium",
    fontColor: totalAdditionalExpenses > 0 ? "FFFF0000" : "FF0F172A",
  });
  applyIntegerFormat(summaryRowA.getCell(3));
  applyCurrencyFormat(summaryRowA.getCell(5));

  const adjustedProfitTone = getValueTone(adjustedProfit);
  const adjustedProfitFill =
    adjustedProfitTone === "negative" ? "FFFFF1F2" : "FFECFDF3";
  const adjustedProfitFont =
    adjustedProfitTone === "negative" ? "FFBE123C" : "FF15803D";

  const summaryRowB = addSparseRow(worksheet, totalColumns, [
    [2, "Lucro ajustado"],
    [3, adjustedProfit],
    [4, "Status"],
    [5, adjustedProfit >= 0 ? "Saudavel" : "Atencao"],
  ]);
  summaryRowB.height = 17.25;
  styleSummaryLabelCell(summaryRowB.getCell(2), {
    leftStyle: "medium",
    bottomStyle: undefined,
  });
  styleSummaryValueCell(summaryRowB.getCell(3), {
    bottomStyle: undefined,
    fillColor: adjustedProfitFill,
    fontColor: adjustedProfitFont,
  });
  styleSummaryLabelCell(summaryRowB.getCell(4), {
    bottomStyle: undefined,
  });
  styleSummaryValueCell(summaryRowB.getCell(5), {
    rightStyle: "medium",
    bottomStyle: undefined,
    alignment: "center",
  });
  applyCurrencyFormat(summaryRowB.getCell(3));
  summaryRowB.getCell(5).alignment = { vertical: "middle", horizontal: "center" };

  worksheet.addRow([]);
  worksheet.getRow(7).height = 20.1;

  const headerRow = addSparseRow(
    worksheet,
    totalColumns,
    ADDITIONAL_EXPENSES_CSV_HEADER.map((header, index) => [startColumn + index, header])
  );
  styleTableHeaderRow(headerRow, startColumn, endColumn);

  expenseGroups.forEach((group) => {
    const sectionRowNumber = worksheet.rowCount + 1;
    addSectionBanner(
      worksheet,
      sectionRowNumber,
      `Mes de referencia: ${group.label}`,
      {
        startColumn,
        endColumn,
        bottomStyle: "thin",
        bottomColor: EXCEL_DEFAULT_LINE_COLOR,
      }
    );

    group.items.forEach((expense, index) => {
      const worksheetRow = addSparseRow(worksheet, totalColumns, [
        [2, expense.description],
        [3, expense.value],
        [4, formatMonthReference(expense.monthReference)],
        [5, formatCreatedAt(expense.createdAt)],
      ]);

      styleDataRow(worksheetRow, startColumn, endColumn, index % 2 === 1, {
        firstColumnBold: true,
      });
      applyCurrencyFormat(worksheetRow.getCell(3));
    });

    const subtotalRow = addSparseRow(worksheet, totalColumns, [
      [2, "Subtotal do mes"],
      [3, group.total],
      [4, group.label],
      [5, ""],
    ]);
    styleTotalRow(subtotalRow, startColumn, endColumn, "neutral", {
      topColor: EXCEL_DEFAULT_LINE_COLOR,
      bottomStyle: undefined,
      bottomColor: EXCEL_DEFAULT_LINE_COLOR,
    });
    applyCurrencyFormat(subtotalRow.getCell(3));

    worksheet.addRow([]);
    worksheet.getRow(worksheet.rowCount).height = 20.1;
  });

  addSectionBanner(worksheet, worksheet.rowCount + 1, "Fechamento", {
    startColumn,
    endColumn,
    topStyle: undefined,
    bottomStyle: "thin",
    bottomColor: EXCEL_DEFAULT_LINE_COLOR,
  });

  const totalRow = addSparseRow(worksheet, totalColumns, [
    [2, "Total geral"],
    [3, totalAdditionalExpenses],
    [4, ""],
    [5, ""],
  ]);
  styleTotalRow(totalRow, startColumn, endColumn, "negative", {
    topColor: EXCEL_DEFAULT_LINE_COLOR,
    bottomColor: EXCEL_DEFAULT_LINE_COLOR,
  });
  applyCurrencyFormat(totalRow.getCell(3));

  const adjustedProfitRow = addSparseRow(worksheet, totalColumns, [
    [2, "Lucro total menos custos adicionais"],
    [3, adjustedProfit],
    [4, ""],
    [5, ""],
  ]);
  styleTotalRow(adjustedProfitRow, startColumn, endColumn, getValueTone(adjustedProfit), {
    topColor: EXCEL_DEFAULT_LINE_COLOR,
    bottomStyle: "medium",
    bottomColor: EXCEL_DEFAULT_LINE_COLOR,
  });
  applyCurrencyFormat(adjustedProfitRow.getCell(3));

  finalizeWorksheetLayout(worksheet, {
    headerRowNumber: headerRow.number,
    startColumn,
    endColumn,
    activeCellColumn: 3,
  });

  return workbook;
}

async function downloadWorkbookFile(filename, workbook) {
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  triggerFileDownload(filename, blob);
}

function AdditionalExpensesPanel({
  expenses,
  expenseForm,
  formError,
  originalProfit,
  totalAdditionalExpenses,
  adjustedProfit,
  onFieldChange,
  onSubmit,
  onRemove,
  onExportExpenses,
  exportingExpenses,
  savingExpense,
  removingExpenseId,
}) {
  return (
    <div className="panel expenses-panel">
      <div className="panel-header">
        <div>
          <h2>Gastos adicionais</h2>
          <p>
            Registre custos extras para manter leitura executiva do lucro ajustado e
            evitar distorcoes no fechamento.
          </p>
        </div>
      </div>

      <div className="expenses-layout">
        <div className="expenses-input-block">
          <form className="expenses-form" onSubmit={onSubmit}>
            <label className="expenses-field">
              <span>Descricao do gasto</span>
              <input
                type="text"
                name="description"
                value={expenseForm.description}
                onChange={onFieldChange}
                placeholder="Ex.: Frete extra, embalagem, taxa"
              />
            </label>

            <label className="expenses-field">
              <span>Valor do gasto</span>
              <input
                type="text"
                name="value"
                inputMode="decimal"
                value={expenseForm.value}
                onChange={onFieldChange}
                placeholder="0,00"
              />
            </label>

            <label className="expenses-field">
              <span>Mes de referencia</span>
              <input
                type="month"
                name="monthReference"
                value={expenseForm.monthReference}
                onChange={onFieldChange}
              />
            </label>

            <button type="submit" className="expenses-submit" disabled={savingExpense}>
              {savingExpense ? "Salvando..." : "Adicionar gasto"}
            </button>
          </form>

          {formError ? <p className="expenses-form-error">{formError}</p> : null}
        </div>

        <div className="expenses-impact-panel">
          <div className="expenses-impact-header">
            <h3>Impacto no resultado</h3>
            <p>
              Compare lucro original, custos extras e lucro ajustado para validar
              qualidade do resultado no periodo.
            </p>
          </div>

          <div className="expenses-summary">
            <div className="expenses-summary-card is-neutral">
              <span>Lucro original</span>
              <strong>{formatCurrency(originalProfit)}</strong>
              <p>Resultado enviado pelo relatorio base.</p>
            </div>

            <div className="expenses-summary-card is-warning">
              <span>Gastos adicionais</span>
              <strong>{formatCurrency(totalAdditionalExpenses)}</strong>
              <p>{expenses.length} lancamento(s) afetando o fechamento.</p>
            </div>

            <div className={`expenses-summary-card is-${getValueTone(adjustedProfit)}`}>
              <span>Lucro ajustado</span>
              <strong>{formatCurrency(adjustedProfit)}</strong>
              <p>Resultado final apos abatimento dos custos extras.</p>
            </div>
          </div>
        </div>

        <div className="expenses-list-header">
          <h3>Lancamentos registrados</h3>
          <p>
            Revise a lista antes de exportar para manter o relatorio financeiro
            consistente com a operacao.
          </p>
        </div>

        <div className="expenses-list">
          {expenses.length ? (
            expenses.map((expense, index) => (
              <div key={expense.id} className="row expense-row">
                <div className="expense-badge">{index + 1}</div>

                <div className="row-main">
                  <strong>{expense.description}</strong>
                  <p className="expense-meta">
                    {formatMonthReference(expense.monthReference)} | Criado em{" "}
                    {formatCreatedAt(expense.createdAt)}
                  </p>
                </div>

                <div className="expense-actions">
                  <span className="row-value">{formatCurrency(expense.value)}</span>

                  <button
                    type="button"
                    className="expense-remove-button"
                    onClick={() => onRemove(expense.id)}
                    disabled={removingExpenseId === expense.id}
                  >
                    {removingExpenseId === expense.id ? "Removendo..." : "Remover"}
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="expenses-empty">
              Nenhum gasto adicional no recorte atual. Cadastre custos extras para
              refletir o lucro real da operacao no periodo.
            </div>
          )}
        </div>

        <div className="expenses-footer">
          <button
            type="button"
            className="expenses-export-button"
            onClick={onExportExpenses}
            disabled={!expenses.length || exportingExpenses}
          >
            {exportingExpenses
              ? "Exportando planilha..."
              : "Exportar custos adicionais mensais"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Reports() {
  const { selectedPeriod, setSelectedPeriod } = useAnalyticsPeriod();
  const [data, setData] = useState(null);
  const [profitReportRows, setProfitReportRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);
  const [exportingExpenses, setExportingExpenses] = useState(false);
  const [expenseForm, setExpenseForm] = useState({
    description: "",
    value: "",
    monthReference: getDefaultMonthReference(),
  });
  const [formError, setFormError] = useState("");
  const [additionalExpenses, setAdditionalExpenses] = useState([]);
  const [savingExpense, setSavingExpense] = useState(false);
  const [removingExpenseId, setRemovingExpenseId] = useState("");

  useEffect(() => {
    let isCancelled = false;

    async function loadReports() {
      try {
        setError("");
        setLoading(true);

        const [reportsResult, profitReportResult, additionalCostsResult] = await Promise.all([
          getReports(selectedPeriod),
          getProfitReport(selectedPeriod),
          getAdditionalReportCosts(selectedPeriod),
        ]);

        if (!isCancelled) {
          setData(reportsResult);
          setProfitReportRows(profitReportResult);
          setAdditionalExpenses(additionalCostsResult?.items || []);
        }
      } catch {
        if (!isCancelled) {
          setError("Nao foi possivel carregar os relatorios.");
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    }

    loadReports();

    return () => {
      isCancelled = true;
    };
  }, [selectedPeriod]);

  function handleExpenseFieldChange(event) {
    const { name, value } = event.target;

    setExpenseForm((currentForm) => ({
      ...currentForm,
      [name]: value,
    }));

    if (formError) {
      setFormError("");
    }
  }

  async function handleAddExpense(event) {
    event.preventDefault();

    const description = expenseForm.description.trim();
    const parsedValue = parseCurrencyValue(expenseForm.value);
    const monthReference = expenseForm.monthReference || getDefaultMonthReference();

    if (!description) {
      setFormError("Informe a descricao do gasto.");
      return;
    }

    if (parsedValue <= 0) {
      setFormError("Informe um valor valido maior que zero.");
      return;
    }

    try {
      setSavingExpense(true);
      setFormError("");

      const response = await createAdditionalReportCost(
        {
          description,
          value: parsedValue,
          monthReference,
        },
        selectedPeriod
      );

      setAdditionalExpenses(response.items || []);
      setExpenseForm({
        description: "",
        value: "",
        monthReference,
      });
    } catch (error) {
      setFormError(error.message || "Nao foi possivel salvar esse gasto adicional.");
    } finally {
      setSavingExpense(false);
    }
  }

  async function handleRemoveExpense(expenseId) {
    try {
      setRemovingExpenseId(expenseId);
      setFormError("");
      const response = await removeAdditionalReportCost(expenseId, selectedPeriod);
      setAdditionalExpenses(response.items || []);
    } catch (error) {
      setFormError(error.message || "Nao foi possivel remover esse gasto adicional.");
    } finally {
      setRemovingExpenseId("");
    }
  }

  if (loading) return <div className="screen-message">Carregando relatorios...</div>;
  if (error) return <div className="screen-message">{error}</div>;
  if (!data) return <div className="screen-message">Dados invalidos.</div>;

  const profitReportSummary = calculateProfitReportSummary(profitReportRows);
  const originalProfit = profitReportSummary.netProfit;
  const totalAdditionalExpenses = additionalExpenses.reduce(
    (total, expense) => total + expense.value,
    0
  );
  const adjustedProfit = originalProfit - totalAdditionalExpenses;
  const channelPerformance = buildChannelPerformance(profitReportRows);
  const topProductsByProfit = buildTopProfitableProducts(profitReportRows);
  const expenseGroups = groupExpensesByMonth(additionalExpenses);
  const monthlyReportRows = buildMonthlyReportRows(Array.isArray(data.rows) ? data.rows : []);
  const monthlyReportSummary = calculateMonthlyReportSummary(monthlyReportRows);
  const selectedPeriodLabel = formatPeriodLabel(selectedPeriod);
  const monthlyRowsByProfit = [...monthlyReportRows].sort(
    (left, right) => right.profitValue - left.profitValue
  );
  const bestPeriodRow = monthlyRowsByProfit[0] || null;
  const worstPeriodRow =
    monthlyRowsByProfit.length > 1
      ? monthlyRowsByProfit[monthlyRowsByProfit.length - 1]
      : null;
  const averageProfitPerPeriod = monthlyReportRows.length
    ? monthlyReportSummary.profit / monthlyReportRows.length
    : 0;

  async function handleExport() {
    if (!profitReportRows.length) {
      return;
    }

    try {
      setExporting(true);

      await downloadWorkbookFile(
        "relatorio_rentabilidade_viisync.xlsx",
        await buildProfitReportWorkbook(profitReportRows, profitReportSummary, adjustedProfit)
      );
    } finally {
      setExporting(false);
    }
  }

  async function handleExportAdditionalExpenses() {
    if (!additionalExpenses.length) {
      return;
    }

    try {
      setExportingExpenses(true);

      await downloadWorkbookFile(
        "custos_adicionais_mensais_viisync.xlsx",
        await buildAdditionalExpensesWorkbook(
          expenseGroups,
          totalAdditionalExpenses,
          adjustedProfit
        )
      );
    } finally {
      setExportingExpenses(false);
    }
  }

  return (
    <div className="reports-page">
      <PageHeader
        tag="Analises"
        title="Relatorios"
        description={`Leitura executiva de vendas, lucro e margem por canal. A exportacao considera o recorte de ${selectedPeriodLabel}.`}
      >
        <div className="reports-header-actions">
          <div className="reports-period-switcher">
            <button
              type="button"
              className={selectedPeriod === "7d" ? "is-active" : ""}
              onClick={() => setSelectedPeriod("7d")}
            >
              7 dias
            </button>
            <button
              type="button"
              className={selectedPeriod === "30d" ? "is-active" : ""}
              onClick={() => setSelectedPeriod("30d")}
            >
              30 dias
            </button>
            <button
              type="button"
              className={selectedPeriod === "90d" ? "is-active" : ""}
              onClick={() => setSelectedPeriod("90d")}
            >
              90 dias
            </button>
            <button
              type="button"
              className={selectedPeriod === "1y" ? "is-active" : ""}
              onClick={() => setSelectedPeriod("1y")}
            >
              1 ano
            </button>
          </div>

          <button
            type="button"
            className="reports-export-button"
            onClick={handleExport}
            disabled={exporting}
          >
            {exporting ? "Exportando planilha..." : "Exportar planilha"}
          </button>
        </div>
      </PageHeader>

      <div className="cards">
        <SummaryCard
          title="Faturamento total"
          value={formatCurrency(profitReportSummary.grossRevenue)}
          description={`Receita consolidada em ${selectedPeriodLabel}`}
          variant="card-revenue"
        />
        <SummaryCard
          title="Lucro total"
          value={formatCurrency(adjustedProfit)}
          description={`Lucro ajustado no recorte de ${selectedPeriodLabel}`}
          variant="card-profit"
        />
        <SummaryCard
          title="Registros"
          value={formatInteger(profitReportRows.length)}
          description="Linhas consideradas na exportacao"
          variant="card-sales"
        />
        <SummaryCard
          title="Margem media"
          value={formatPercentage(profitReportSummary.averageProfitMargin)}
          description={`Media do relatorio em ${selectedPeriodLabel}`}
          variant="card-ticket"
        />
      </div>

      <AdditionalExpensesPanel
        expenses={additionalExpenses}
        expenseForm={expenseForm}
        formError={formError}
        originalProfit={originalProfit}
        totalAdditionalExpenses={totalAdditionalExpenses}
        adjustedProfit={adjustedProfit}
        onFieldChange={handleExpenseFieldChange}
        onSubmit={handleAddExpense}
        onRemove={handleRemoveExpense}
        onExportExpenses={handleExportAdditionalExpenses}
        exportingExpenses={exportingExpenses}
        savingExpense={savingExpense}
        removingExpenseId={removingExpenseId}
      />

      <div className="panels">
        <div className="reports-focus-panel is-channel">
          <Panel
            title="Desempenho por canal"
            description={`Comparativo de receita e lucro por marketplace em ${selectedPeriodLabel.toLowerCase()}, com foco em decisao de alocacao.`}
          >
            {channelPerformance.length ? (
              channelPerformance.map((channel, index) => (
                <div key={channel.id} className="row reports-analytic-row">
                  <div className="row-main">
                    <strong>{channel.name}</strong>
                    <p>
                      {index === 0
                        ? "Canal lider de faturamento no recorte atual."
                        : "Canal ativo com contribuicao no resultado consolidado."}
                    </p>
                  </div>

                  <div className="report-values">
                    <span>Receita {channel.revenue}</span>
                    <strong>{channel.profit}</strong>
                  </div>
                </div>
              ))
            ) : (
              <div className="reports-panel-empty">
                Sem dados por canal para este recorte. Amplie o periodo ou sincronize os
                pedidos para liberar a leitura comparativa.
              </div>
            )}
          </Panel>
        </div>

        <div className="reports-focus-panel is-products">
          <Panel
            title="Produtos mais lucrativos"
            description={`Itens com maior contribuicao de lucro em ${selectedPeriodLabel.toLowerCase()}, priorizando a visao de rentabilidade.`}
          >
            {topProductsByProfit.length ? (
              topProductsByProfit.map((product, index) => (
                <div key={product.id} className="row reports-analytic-row">
                  <div className="rank">{index + 1}</div>

                  <div className="row-main">
                    <strong>{product.name}</strong>
                    <p>{index === 0 ? "Maior lucro do recorte analisado." : "Produto com resultado positivo relevante."}</p>
                  </div>

                  <span className="row-value">{product.profit}</span>
                </div>
              ))
            ) : (
              <div className="reports-panel-empty">
                Sem produtos lucrativos consolidados no periodo atual. Revise filtros ou
                aguarde nova sincronizacao para comparar itens.
              </div>
            )}
          </Panel>
        </div>
      </div>

      <div className="panel reports-table-panel">
        <div className="panel-header reports-table-panel-header">
          <div>
            <h2>Resumo por periodo</h2>
            <p>Leitura gerencial por periodo para identificar picos, quedas e tendencia de margem.</p>
          </div>

          <div className="reports-table-highlights">
            <span className="reports-highlight-chip">
              {formatInteger(monthlyReportRows.length)} periodo(s)
            </span>
            <span
              className={`reports-highlight-chip reports-highlight-chip-${getValueTone(
                monthlyReportSummary.marginValue
              )}`}
            >
              Margem consolidada {formatPercentage(monthlyReportSummary.marginValue)}
            </span>
          </div>
        </div>

        <div className="reports-managerial-grid">
          <article className="reports-managerial-card is-positive">
            <span>Melhor periodo</span>
            <strong>{bestPeriodRow ? bestPeriodRow.period : "--"}</strong>
            <p>
              {bestPeriodRow
                ? `Lucro ${bestPeriodRow.profit} com margem de ${formatPercentage(
                    bestPeriodRow.marginValue
                  )}.`
                : "Sem base de periodos para identificar melhor desempenho."}
            </p>
          </article>

          <article className="reports-managerial-card is-negative">
            <span>Pior periodo</span>
            <strong>{worstPeriodRow ? worstPeriodRow.period : "--"}</strong>
            <p>
              {worstPeriodRow
                ? `Lucro ${worstPeriodRow.profit} com margem de ${formatPercentage(
                    worstPeriodRow.marginValue
                  )}.`
                : monthlyReportRows.length === 1
                  ? "Aguardando mais de um periodo para comparar melhor e pior resultado."
                  : "Sem base de periodos para leitura de risco."}
            </p>
          </article>

          <article className="reports-managerial-card is-neutral">
            <span>Lucro medio</span>
            <strong>
              {monthlyReportRows.length ? formatCurrency(averageProfitPerPeriod) : "--"}
            </strong>
            <p>
              {monthlyReportRows.length
                ? `${formatInteger(monthlyReportRows.length)} periodo(s) analisado(s) no recorte.`
                : "Sem periodos consolidados para calcular media de lucro."}
            </p>
          </article>

          <article
            className={`reports-managerial-card is-${getValueTone(
              monthlyReportSummary.marginValue
            )}`}
          >
            <span>Margem consolidada</span>
            <strong>
              {monthlyReportRows.length
                ? formatPercentage(monthlyReportSummary.marginValue)
                : "--"}
            </strong>
            <p>
              {monthlyReportRows.length
                ? "Indicador geral de eficiencia do periodo consolidado."
                : "Sincronize dados para liberar leitura consolidada de margem."}
            </p>
          </article>
        </div>

        <div className="reports-table-shell">
          <div className="reports-table-overview">
            <div className="reports-overview-card">
              <span>Faturamento acumulado</span>
              <strong>{formatCurrency(monthlyReportSummary.revenue)}</strong>
            </div>

            <div className="reports-overview-card">
              <span>Lucro acumulado</span>
              <strong>{formatCurrency(monthlyReportSummary.profit)}</strong>
            </div>

            <div className="reports-overview-card">
              <span>Pedidos no resumo</span>
              <strong>{formatInteger(monthlyReportSummary.orders)}</strong>
            </div>
          </div>

          <div className="reports-table-wrapper">
            <table className="reports-table">
              <thead>
                <tr>
                  <th>Periodo</th>
                  <th className="reports-table-cell-number">Pedidos</th>
                  <th className="reports-table-cell-number">Faturamento</th>
                  <th className="reports-table-cell-number">Lucro</th>
                  <th className="reports-table-cell-number">Margem</th>
                </tr>
              </thead>
              <tbody>
                {monthlyReportRows.length ? (
                  <>
                    {monthlyReportRows.map((row) => {
                      const revenueShare = monthlyReportSummary.revenue
                        ? (row.revenueValue / monthlyReportSummary.revenue) * 100
                        : 0;
                      const profitTone = getValueTone(row.profitValue);
                      const marginTone = getValueTone(row.marginValue);
                      const averageTicket = row.ordersValue
                        ? row.revenueValue / row.ordersValue
                        : 0;

                      return (
                        <tr key={row.id}>
                          <td data-label="Periodo">
                            <div className="reports-period-cell">
                              <strong>{row.period}</strong>
                              <span>
                                {formatPercentage(revenueShare)} do faturamento consolidado
                              </span>
                            </div>
                          </td>
                          <td className="reports-table-cell-number" data-label="Pedidos">
                            <div className="reports-table-metric">
                              <strong>{formatInteger(row.ordersValue)}</strong>
                              <span>
                                {row.ordersValue === 1 ? "pedido" : "pedidos"}
                              </span>
                            </div>
                          </td>
                          <td className="reports-table-cell-number" data-label="Faturamento">
                            <div className="reports-table-metric">
                              <strong>{row.revenue}</strong>
                              <span>{formatCurrency(averageTicket)} ticket medio</span>
                            </div>
                          </td>
                          <td className="reports-table-cell-number" data-label="Lucro">
                            <div className="reports-table-metric">
                              <span className={`reports-table-pill ${profitTone}`}>
                                {row.profit}
                              </span>
                              <span>{formatPercentage(row.marginValue)} de margem</span>
                            </div>
                          </td>
                          <td className="reports-table-cell-number" data-label="Margem">
                            <span className={`reports-table-pill ${marginTone}`}>
                              {formatPercentage(row.marginValue)}
                            </span>
                          </td>
                        </tr>
                      );
                    })}

                    <tr className="reports-table-total-row">
                      <td data-label="Periodo">
                        <div className="reports-period-cell">
                          <strong>Total consolidado</strong>
                          <span>
                            {formatInteger(monthlyReportRows.length)} periodo(s) analisado(s)
                          </span>
                        </div>
                      </td>
                      <td className="reports-table-cell-number" data-label="Pedidos">
                        <div className="reports-table-metric">
                          <strong>{formatInteger(monthlyReportSummary.orders)}</strong>
                          <span>pedidos no periodo</span>
                        </div>
                      </td>
                      <td className="reports-table-cell-number" data-label="Faturamento">
                        <div className="reports-table-metric">
                          <strong>{formatCurrency(monthlyReportSummary.revenue)}</strong>
                          <span>
                            {formatCurrency(
                              monthlyReportSummary.orders
                                ? monthlyReportSummary.revenue /
                                    monthlyReportSummary.orders
                                : 0
                            )}{" "}
                            ticket medio
                          </span>
                        </div>
                      </td>
                      <td className="reports-table-cell-number" data-label="Lucro">
                        <div className="reports-table-metric">
                          <span
                            className={`reports-table-pill ${getValueTone(
                              monthlyReportSummary.profit
                            )}`}
                          >
                            {formatCurrency(monthlyReportSummary.profit)}
                          </span>
                          <span>
                            {formatPercentage(monthlyReportSummary.marginValue)} de margem
                            consolidada
                          </span>
                        </div>
                      </td>
                      <td className="reports-table-cell-number" data-label="Margem">
                        <span
                          className={`reports-table-pill ${getValueTone(
                            monthlyReportSummary.marginValue
                          )}`}
                        >
                          {formatPercentage(monthlyReportSummary.marginValue)}
                        </span>
                      </td>
                    </tr>
                  </>
                ) : (
                  <tr className="reports-table-empty-row">
                    <td colSpan={5}>
                      Nenhum periodo consolidado disponivel. Ajuste o recorte ou atualize os
                      dados para habilitar a leitura gerencial.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Reports;
