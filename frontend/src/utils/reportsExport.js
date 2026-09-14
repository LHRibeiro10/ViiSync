import { formatCreatedAt, formatMonthReference, getValueTone } from "./reportsFormatting";
import { triggerFileDownload } from "./fileDownload";

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

export {
  buildProfitReportWorkbook,
  buildAdditionalExpensesWorkbook,
  downloadWorkbookFile,
};
