import fs from "fs";
import path from "path";
import xlsx from "xlsx";

const TABLES_DIR = path.resolve("./Tabelas_IRS");
const EXPECTED_EXCEL_FILES = 3;

function getExcelFiles(dir) {
  const files = fs.readdirSync(dir);
  const excelFiles = files.filter(
    (fileName) => fileName.endsWith(".xlsx") || fileName.endsWith(".xls"),
  );

  if (excelFiles.length !== EXPECTED_EXCEL_FILES) {
    throw new Error(
      `Expected ${EXPECTED_EXCEL_FILES} Excel files in Tabelas_IRS, found ${excelFiles.length}`,
    );
  }

  return excelFiles.map((fileName) => path.join(dir, fileName));
}

function cleanText(value) {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return value;
  const txt = cleanText(value)
    .replace(/\s/g, "")
    .replace("R", "")
    .replace("%", "")
    .replace(",", ".");
  if (!txt || txt === "n.a." || txt === "na") return null;
  const num = Number(txt);
  return Number.isFinite(num) ? num : null;
}

function getSheetRows(filePath) {
  const workbook = xlsx.readFile(filePath, { cellDates: true });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  return xlsx.utils.sheet_to_json(sheet, {
    header: 1,
    defval: null,
    blankrows: false,
  });
}

function isTableTitle(row) {
  return row.some((cell) => /^Tabela\s+[IVXLC]+/i.test(cleanText(cell)));
}

function extractTableName(row) {
  const match = row
    .map(cleanText)
    .find((cell) => /^Tabela\s+[IVXLC]+/i.test(cell));
  return match || null;
}

function extractCategory(row) {
  const text = row.map(cleanText).filter(Boolean).join(" ");
  if (!text) return null;
  if (/^Tabela\s+[IVXLC]+/i.test(text)) return null;
  if (/^Remunera/i.test(text)) return null;
  if (/^F[óo]rmula/i.test(text)) return null;
  if (/^R\s*=\s*Remunera/i.test(text)) return null;
  if (text.length < 4) return null;
  return text;
}

function isHeaderRow(row) {
  const text = row.map(cleanText).filter(Boolean).join(" ").trim();
  return /Remunera/i.test(text) && /Taxa/i.test(text);
}

function isFormulaRow(row) {
  const text = row.map(cleanText).filter(Boolean).join(" ").trim();
  return /^F[óo]rmula/i.test(text);
}

function isLegendRow(row) {
  const text = row.map(cleanText).filter(Boolean).join(" ").trim();
  return /^R\s*=\s*Remunera/i.test(text);
}

function parseParcelaAAbater(row) {
  const coefficient = toNumber(row[5]);
  const multiplier = toNumber(row[7]);
  const referenceBase = toNumber(row[9]);
  const hasFormula =
    cleanText(row[6]) === "x" || cleanText(row[8]).startsWith("x");

  if (
    hasFormula &&
    coefficient !== null &&
    multiplier !== null &&
    referenceBase !== null
  ) {
    return {
      type: "formula",
      coefficient,
      multiplier,
      referenceBase,
      expression: `${coefficient} x ${multiplier} x (${referenceBase} - R)`,
    };
  }

  return coefficient === null
    ? null
    : {
        type: "fixed",
        amount: coefficient,
      };
}

function parseBracketRow(row, previousUpperBound) {
  const rangeLabel = cleanText(row[1]);
  if (rangeLabel !== "Até" && !/^Superior a$/i.test(rangeLabel)) return null;

  const threshold = toNumber(row[2]);
  if (threshold === null) return null;

  const isOpenEnded = /^Superior a$/i.test(rangeLabel);

  return {
    rangeLabel,
    range: {
      minExclusive: isOpenEnded ? threshold : previousUpperBound,
      maxInclusive: isOpenEnded ? null : threshold,
    },
    taxaMarginalMaxima: toNumber(row[3]),
    parcelaAAbater: parseParcelaAAbater(row),
    parcelaAdicionalDependente: toNumber(row[11]),
    taxaEfetivaMensalLimiteEscalao: toNumber(row[14]),
  };
}

function extractMetadataFromFileName(filePath) {
  const baseName = path.basename(filePath, path.extname(filePath));
  const normalized = cleanText(baseName).toLowerCase();

  const yearMatch = normalized.match(/(20\d{2})/);
  const year = yearMatch ? Number(yearMatch[1]) : null;

  let region = "unknown";
  if (normalized.includes("continente")) {
    region = "continente";
  } else if (
    normalized.includes("madeira") ||
    /(^|[_\s-])ram([_\s-]|$)/.test(normalized)
  ) {
    region = "madeira";
  } else if (
    normalized.includes("acores") ||
    normalized.includes("açores") ||
    /(^|[_\s-])ra([_\s-]|$)/.test(normalized)
  ) {
    region = "acores";
  }

  return {
    sourceFile: path.basename(filePath),
    outputBaseName: baseName,
    year,
    region,
  };
}

function normalizeIrs(rows, metadata) {
  const result = {
    year: metadata.year,
    region: metadata.region,
    sourceFile: metadata.sourceFile,
    tables: [],
  };

  let currentTable = null;
  let currentCategory = null;
  let currentFormula = null;
  let inHeader = false;
  let previousUpperBound = null;

  for (const row of rows) {
    const text = row.map(cleanText).filter(Boolean).join(" ").trim();
    if (!text) continue;

    if (isTableTitle(row)) {
      currentTable = {
        name: extractTableName(row),
        category: null,
        rows: [],
        formula: null,
        legend: null,
      };
      result.tables.push(currentTable);
      currentCategory = null;
      currentFormula = null;
      inHeader = false;
      previousUpperBound = null;
      continue;
    }

    if (!currentTable) continue;

    if (
      !currentCategory &&
      !isHeaderRow(row) &&
      !isFormulaRow(row) &&
      !isLegendRow(row)
    ) {
      const cat = extractCategory(row);
      if (cat && !/^Tabela\s+[IVXLC]+/i.test(cat)) {
        currentCategory = cat;
        currentTable.category = cat;
        continue;
      }
    }

    if (isFormulaRow(row)) {
      currentFormula = text;
      currentTable.formula = text
        .replace(/^F[óo]rmula(?::| a aplicar:?)?\s*/i, "")
        .trim();
      inHeader = false;
      continue;
    }

    if (isLegendRow(row)) {
      currentTable.legend = text;
      continue;
    }

    if (isHeaderRow(row)) {
      inHeader = true;
      continue;
    }

    if (inHeader) {
      const bracket = parseBracketRow(row, previousUpperBound);
      if (bracket) {
        currentTable.rows.push(bracket);
        if (bracket.range.maxInclusive !== null) {
          previousUpperBound = bracket.range.maxInclusive;
        }
      }
    }
  }

  return result;
}

function writeNormalizedJson(dir, metadata, normalizedData) {
  const outputPath = path.join(dir, `${metadata.outputBaseName}.json`);
  fs.writeFileSync(outputPath, JSON.stringify(normalizedData, null, 2), "utf8");
  return outputPath;
}

function main() {
  const excelFiles = getExcelFiles(TABLES_DIR);
  const outputs = [];

  for (const filePath of excelFiles) {
    const rows = getSheetRows(filePath);
    const metadata = extractMetadataFromFileName(filePath);
    const normalized = normalizeIrs(rows, metadata);
    const outputPath = writeNormalizedJson(TABLES_DIR, metadata, normalized);

    outputs.push({
      filePath,
      output: outputPath,
      tables: normalized.tables.length,
      year: normalized.year,
      region: normalized.region,
    });
  }

  console.log(outputs);
}

main();
