import fs from "fs";
import path from "path";
import {
  calculateNetSalary,
  getAvailableTables,
  getTableByIndex,
  getTableByPresetId,
} from "./salary-calculator.js";
import { calculateFinalSettlement } from "./final-settlement-calculator.js";

const IRS_JSON_BY_REGION = {
  continente: path.resolve("./Tabelas_IRS/Tabelas_RF_Continente_2026.json"),
  madeira: path.resolve("./Tabelas_IRS/Tabelas_RF_2026_RAM.json"),
  acores: path.resolve("./Tabelas_IRS/Tabelas_RF_RA_Acores_2026.json"),
};
const DEFAULT_REGION = "continente";
const LEGACY_IRS_JSON_PATH = path.resolve("./Tabelas_IRS/irs.normalized.json");

function normalizeRegion(regionArg) {
  if (typeof regionArg !== "string") return DEFAULT_REGION;
  const normalized = regionArg.trim().toLowerCase();
  return IRS_JSON_BY_REGION[normalized] ? normalized : DEFAULT_REGION;
}

function parseArgs(argv) {
  return argv.reduce((accumulator, arg) => {
    if (arg.startsWith("--") && !arg.includes("=")) {
      accumulator[arg.replace(/^--/, "")] = true;
      return accumulator;
    }

    const [key, value] = arg.split("=");
    if (key && value !== undefined) {
      accumulator[key.replace(/^--/, "")] = value;
    }

    return accumulator;
  }, {});
}

function readIrsData(regionArg) {
  const region = normalizeRegion(regionArg);
  const regionPath = IRS_JSON_BY_REGION[region];

  if (fs.existsSync(regionPath)) {
    return {
      irsData: JSON.parse(fs.readFileSync(regionPath, "utf8")),
      resolvedRegion: region,
      sourcePath: regionPath,
    };
  }

  if (fs.existsSync(LEGACY_IRS_JSON_PATH)) {
    return {
      irsData: JSON.parse(fs.readFileSync(LEGACY_IRS_JSON_PATH, "utf8")),
      resolvedRegion: region,
      sourcePath: LEGACY_IRS_JSON_PATH,
    };
  }

  throw new Error("Não foi encontrado JSON de IRS em Tabelas_IRS");
}

function printUsage(availableTables) {
  console.log(
    "Utilização: node net-salary.js --base=1500 --duodecimos=0 --subsidies=0 --table=0 --dependents=0 --months=14",
  );
  console.log(
    "      ou: node net-salary.js --final-settlement --base=1500 --admission=2021-01-10 --termination=2026-05-17 --taken-vested=5 --taken-proportional=2 --seniority-extra=1",
  );
  console.log("");
  console.log("Opções:");
  console.log("  --final-settlement Ativa O Modo De Cálculo De Acerto Final");
  console.log("  --gross        Valor Bruto Mensal Direto Em EUR (Opcional)");
  console.log("  --base         Componente De Salário Base");
  console.log("  --duodecimos   Componente De Duodécimos De Férias E Natal");
  console.log("  --subsidies    Componente De Subsídios");
  console.log("  --overtime     Componente De Horas Extra");
  console.log("  --night        Componente De Acréscimo Noturno");
  console.log("  --commissions  Componente De Comissões");
  console.log(
    "  --meal-taxable Componente Tributável Do Subsídio De Alimentação",
  );
  console.log("  --absence      Componente De Desconto Por Faltas");
  console.log("  --table        Índice Da Tabela De IRS Da Lista Abaixo");
  console.log("  --preset       ID Da Predefinição De IRS Da Lista Abaixo");
  console.log("  --region       Região: continente, madeira ou acores");
  console.log("  --dependents   Número De Dependentes (Por Omissão: 0)");
  console.log("  --months       Pagamentos Anuais: 12 Ou 14 (Por Omissão: 12)");
  console.log(
    "  --admission    Data De Admissão (YYYY-MM-DD), Modo Acerto Final",
  );
  console.log(
    "  --termination  Data De Cessação (YYYY-MM-DD), Modo Acerto Final",
  );
  console.log("  --taken-vested Dias De Férias Vencidas Já Gozados");
  console.log("  --taken-proportional Dias De Férias Proporcionais Já Gozados");
  console.log("  --seniority-extra Dias Extra De Férias Por Antiguidade");
  console.log("  --list         Mostra As Tabelas De IRS Disponíveis");
  console.log("");
  console.log("Tabelas De IRS Disponíveis:");

  for (const table of availableTables) {
    console.log(`  [${table.index}] ${table.label} (${table.id})`);
    console.log(`      ${table.category}`);
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const { irsData, resolvedRegion, sourcePath } = readIrsData(args.region);
  const availableTables = getAvailableTables(irsData);
  const isFinalSettlementMode = args["final-settlement"] !== undefined;

  if (isFinalSettlementMode) {
    const result = calculateFinalSettlement({
      baseSalary: args.base,
      admissionDate: args.admission,
      terminationDate: args.termination,
      vacationTakenFromVested: args["taken-vested"],
      vacationTakenFromProportional: args["taken-proportional"],
      seniorityExtraVacationDays: args["seniority-extra"],
    });

    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (
    args.list ||
    (args.gross === undefined && args.base === undefined) ||
    (args.table === undefined && args.preset === undefined)
  ) {
    console.log(`Região ativa: ${resolvedRegion}`);
    console.log(`Fonte IRS: ${sourcePath}`);
    console.log("");
    printUsage(availableTables);
    return;
  }

  const grossIncome = args.gross === undefined ? undefined : Number(args.gross);
  const dependents =
    args.dependents === undefined ? 0 : Number(args.dependents);
  const payPeriods = args.months === undefined ? 12 : Number(args.months);
  const components = {
    baseSalary: args.base,
    duodecimos: args.duodecimos,
    subsidies: args.subsidies,
    overtime: args.overtime,
    nightPremium: args.night,
    commissions: args.commissions,
    mealAllowanceTaxablePortion: args["meal-taxable"],
    absenceDeductions: args.absence,
  };

  const hasComponentInput = Object.values(components).some(
    (value) => value !== undefined,
  );

  const table =
    args.preset !== undefined
      ? getTableByPresetId(irsData, args.preset)
      : getTableByIndex(irsData, Number(args.table));

  const result = calculateNetSalary({
    grossIncome,
    components: hasComponentInput ? components : undefined,
    dependents,
    payPeriods,
    table,
  });

  console.log(JSON.stringify(result, null, 2));
}

main();
