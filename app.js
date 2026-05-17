import { calculateNetSalary, getTableByIndex } from "./salary-calculator.js";
import { calculateFinalSettlement } from "./final-settlement-calculator.js";

const FULL_TIME_MONTHLY_HOURS = 173.33;
const MEAL_THRESHOLD_CASH = 6;
const MEAL_THRESHOLD_TICKET = 9.6;
const IRS_JSON_BY_REGION = {
  continente: "./Tabelas_IRS/Tabelas_RF_Continente_2026.json",
  madeira: "./Tabelas_IRS/Tabelas_RF_2026_RAM.json",
  acores: "./Tabelas_IRS/Tabelas_RF_RA_Acores_2026.json",
};
const LEGACY_IRS_JSON_PATH = "./Tabelas_IRS/irs.normalized.json";

const HOUSEHOLD_TABLE_INDEX = {
  tableOne: 0,
  tableTwo: 1,
  tableThree: 2,
  tableFour: 3,
  tableFive: 4,
  tableSix: 5,
  tableSeven: 6,
};

const NON_DISABLED_OPTIONS = ["tableOne", "tableTwo", "tableThree"];
const DISABLED_OPTIONS = ["tableFour", "tableFive", "tableSix", "tableSeven"];

const form = document.querySelector("[data-calculator-form]");
const calculateButton = form.querySelector("button[type='submit']");
const status = document.querySelector("[data-status]");
const resultPanel = document.querySelector("[data-result]");
const finalSettlementPanel = document.querySelector("[data-final-settlement]");
const finalSettlementToggleInput = document.querySelector(
  "[data-enable-final-settlement]",
);
const finalSettlementFieldsBlock = document.querySelector(
  "[data-final-settlement-fields]",
);

const baseSalaryInput = document.querySelector("[data-base-salary]");
const irsRegionSelect = document.querySelector("[data-irs-region]");
const commissionsInput = document.querySelector("[data-commissions]");
const workedDaysInput = document.querySelector("[data-worked-days]");
const dependentsInput = document.querySelector("[data-dependents]");
const payPeriodsSelect = document.querySelector("[data-pay-periods]");
const weeklyHoursInput = document.querySelector("[data-weekly-hours]");
const admissionDateInput = document.querySelector("[data-admission-date]");
const terminationDateInput = document.querySelector("[data-termination-date]");
const vacationTakenFromVestedInput = document.querySelector(
  "[data-vacation-taken-vested]",
);
const vacationTakenFromProportionalInput = document.querySelector(
  "[data-vacation-taken-proportional]",
);
const seniorityExtraVacationDaysInput = document.querySelector(
  "[data-seniority-extra-vacation-days]",
);

const mealDailyInput = document.querySelector("[data-meal-daily]");

const overtime50Input = document.querySelector("[data-overtime-50]");
const overtime75Input = document.querySelector("[data-overtime-75]");
const overtime100Input = document.querySelector("[data-overtime-100]");

const nightHoursInput = document.querySelector("[data-night-hours]");
const nightRateInput = document.querySelector("[data-night-rate]");
const absenceHoursInput = document.querySelector("[data-absence-hours]");

const nonDisabledHouseholdBlock = document.querySelector(
  "[data-household-non-disabled]",
);
const disabledHouseholdBlock = document.querySelector(
  "[data-household-disabled]",
);
const weeklyHoursBlock = document.querySelector("[data-weekly-hours-block]");
const mealBlock = document.querySelector("[data-meal-block]");
const mealTypeBlock = document.querySelector("[data-meal-type-block]");
const overtimeBlock = document.querySelector("[data-overtime-block]");
const nightBlock = document.querySelector("[data-night-block]");
const subsidyPaidBlock = document.querySelector("[data-subsidy-paid-block]");

const outputFields = {
  grossIncome: document.querySelector('[data-output="grossIncome"]'),
  componentsTotal: document.querySelector('[data-output="componentsTotal"]'),
  absenceDeductions: document.querySelector(
    '[data-output="absenceDeductions"]',
  ),
  annualGrossIncome: document.querySelector(
    '[data-output="annualGrossIncome"]',
  ),
  socialSecurityAmount: document.querySelector(
    '[data-output="socialSecurityAmount"]',
  ),
  annualSocialSecurityAmount: document.querySelector(
    '[data-output="annualSocialSecurityAmount"]',
  ),
  irsAmount: document.querySelector('[data-output="irsAmount"]'),
  annualIrsAmount: document.querySelector('[data-output="annualIrsAmount"]'),
  netSalary: document.querySelector('[data-output="netSalary"]'),
  annualNetSalary: document.querySelector('[data-output="annualNetSalary"]'),
  table: document.querySelector('[data-output="table"]'),
  bracket: document.querySelector('[data-output="bracket"]'),
  formula: document.querySelector('[data-output="formula"]'),
  payPeriods: document.querySelector('[data-output="payPeriods"]'),
  context: document.querySelector('[data-output="context"]'),
  finalSettlementTotal: document.querySelector(
    '[data-output="finalSettlementTotal"]',
  ),
  finalSettlementContext: document.querySelector(
    '[data-output="finalSettlementContext"]',
  ),
  finalSettlementLines: document.querySelector(
    '[data-output="finalSettlementLines"]',
  ),
};

let irsData = null;
let activeIrsRegion = "continente";

const currencyFormatter = new Intl.NumberFormat("pt-PT", {
  style: "currency",
  currency: "EUR",
});

const percentFormatter = new Intl.NumberFormat("pt-PT", {
  style: "percent",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function getRadioValue(name) {
  const selected = form.querySelector(`input[name="${name}"]:checked`);
  return selected ? selected.id : null;
}

function readNumber(
  input,
  label,
  { min = 0, max = Number.POSITIVE_INFINITY } = {},
) {
  const value = Number(input.value || 0);
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new Error(`${label} deve estar entre ${min} e ${max}`);
  }
  return value;
}

function formatCurrency(value) {
  return currencyFormatter.format(value);
}

function formatDays(value) {
  return `${Number(value).toFixed(2)} dias`;
}

function mapContextLabel(type, value) {
  const labels = {
    contractType: {
      "full-time": "Tempo Inteiro",
      "part-time": "Tempo Parcial",
    },
    disabilityStatus: {
      "sem-deficiencia": "Sem Deficiência",
      deficiencia: "Com Deficiência",
    },
    mealEligibility: {
      "nao-recebe": "Sem Subsídio",
      recebe: "Recebe Subsídio",
    },
    duodecimosMode: {
      duodecimos: "Duodécimos",
      "nao-duodecimos": "Sem Duodécimos",
    },
    householdType: {
      tableOne: "Tabela I",
      tableTwo: "Tabela II",
      tableThree: "Tabela III",
      tableFour: "Tabela IV",
      tableFive: "Tabela V",
      tableSix: "Tabela VI",
      tableSeven: "Tabela VII",
    },
    overtimeStatus: {
      "nao-fez": "Não Fez",
      fez: "Fez",
    },
    shiftStatus: {
      "sem-turnos": "Sem Turnos",
      "por-turnos": "Por Turnos",
    },
    irsRegion: {
      continente: "Continente",
      madeira: "Madeira",
      acores: "Açores",
    },
  };

  return labels[type]?.[value] ?? value;
}

function formatBracketRange(range) {
  if (range.maxInclusive === null) {
    return `Superior a ${formatCurrency(range.minExclusive)}`;
  }

  if (range.minExclusive === null) {
    return `Até ${formatCurrency(range.maxInclusive)}`;
  }

  return `Mais de ${formatCurrency(range.minExclusive)} até ${formatCurrency(range.maxInclusive)}`;
}

function enforceHouseholdSelection(disabilityStatus) {
  const allowed =
    disabilityStatus === "deficiencia"
      ? DISABLED_OPTIONS
      : NON_DISABLED_OPTIONS;
  const selected = getRadioValue("agregado");

  if (!selected || !allowed.includes(selected)) {
    const firstAllowed = form.querySelector(`#${allowed[0]}`);
    if (firstAllowed) firstAllowed.checked = true;
  }
}

function updateVisibilityByContext() {
  const disabilityStatus = getRadioValue("deficiencia");
  const contractType = getRadioValue("time");
  const mealEligibility = getRadioValue("subsidio-alim");
  const overtimeStatus = getRadioValue("horas");
  const shiftStatus = getRadioValue("turnos");
  const duodecimosMode = getRadioValue("radio");

  nonDisabledHouseholdBlock.hidden = disabilityStatus === "deficiencia";
  disabledHouseholdBlock.hidden = disabilityStatus !== "deficiencia";
  weeklyHoursBlock.hidden = contractType !== "part-time";
  mealBlock.hidden = mealEligibility !== "recebe";
  mealTypeBlock.hidden = mealEligibility !== "recebe";
  overtimeBlock.hidden = overtimeStatus !== "fez";
  nightBlock.hidden = shiftStatus !== "por-turnos";
  subsidyPaidBlock.hidden = duodecimosMode === "duodecimos";

  enforceHouseholdSelection(disabilityStatus);
  updateFinalSettlementVisibility();
}

function isFinalSettlementEnabled() {
  return Boolean(finalSettlementToggleInput?.checked);
}

function updateFinalSettlementVisibility() {
  const isEnabled = isFinalSettlementEnabled();

  finalSettlementFieldsBlock.hidden = !isEnabled;
  if (!isEnabled) {
    finalSettlementPanel.hidden = true;
  }

  for (const field of finalSettlementFieldsBlock.querySelectorAll(
    "input, select, textarea",
  )) {
    field.disabled = !isEnabled;
  }
}

function buildContextAndComponents() {
  const irsRegion = irsRegionSelect?.value ?? "continente";
  const contractType = getRadioValue("time");
  const overtimeStatus = getRadioValue("horas");
  const shiftStatus = getRadioValue("turnos");
  const mealEligibility = getRadioValue("subsidio-alim");
  const mealPaymentType = getRadioValue("tipo-pagamento");
  const duodecimosMode = getRadioValue("radio");
  const holidayPaid = getRadioValue("checkboxF") === "pagoF";
  const christmasPaid = getRadioValue("checkboxN") === "pagoN";
  const disabilityStatus = getRadioValue("deficiencia");
  const householdType = getRadioValue("agregado");

  if (!householdType || !(householdType in HOUSEHOLD_TABLE_INDEX)) {
    throw new Error("Seleciona um perfil de agregado válido");
  }

  const baseSalary = readNumber(baseSalaryInput, "Salário base");
  const commissions = readNumber(commissionsInput, "Comissões");
  const workedDays = readNumber(workedDaysInput, "Dias trabalhados", {
    min: 0,
    max: 31,
  });
  const absenceHours = readNumber(absenceHoursInput, "Horas de falta", {
    min: 0,
    max: 300,
  });

  let weeklyHours = 40;
  if (contractType === "part-time") {
    weeklyHours = readNumber(weeklyHoursInput, "Horas semanais", {
      min: 1,
      max: 40,
    });
  }

  const workloadFactor = weeklyHours / 40;
  const monthlyHours = FULL_TIME_MONTHLY_HOURS * workloadFactor;
  const hourlyRate = baseSalary / monthlyHours;

  const overtime =
    overtimeStatus === "fez"
      ? readNumber(overtime50Input, "Horas extra 50%", { min: 0, max: 300 }) *
          hourlyRate *
          1.5 +
        readNumber(overtime75Input, "Horas extra 75%", { min: 0, max: 300 }) *
          hourlyRate *
          1.75 +
        readNumber(overtime100Input, "Horas extra 100%", { min: 0, max: 300 }) *
          hourlyRate *
          2
      : 0;

  const nightPremium =
    shiftStatus === "por-turnos"
      ? readNumber(nightHoursInput, "Horas noturnas", { min: 0, max: 300 }) *
        hourlyRate *
        readNumber(nightRateInput, "Taxa de acréscimo noturno", {
          min: 0,
          max: 2,
        })
      : 0;

  let mealAllowanceTaxablePortion = 0;
  if (mealEligibility === "recebe") {
    const mealDailyValue = readNumber(
      mealDailyInput,
      "Subsídio de alimentação diário",
    );
    const threshold =
      (mealPaymentType === "euroTicket"
        ? MEAL_THRESHOLD_TICKET
        : MEAL_THRESHOLD_CASH) * workloadFactor;
    mealAllowanceTaxablePortion =
      Math.max(0, mealDailyValue - threshold) * workedDays;
  }

  const duodecimos =
    duodecimosMode === "duodecimos" ? (baseSalary * 2) / 12 : 0;
  const subsidies =
    duodecimosMode === "duodecimos"
      ? 0
      : (holidayPaid ? baseSalary : 0) + (christmasPaid ? baseSalary : 0);

  const absenceDeductions = absenceHours * hourlyRate;

  return {
    tableIndex: HOUSEHOLD_TABLE_INDEX[householdType],
    components: {
      baseSalary,
      duodecimos,
      subsidies,
      overtime,
      nightPremium,
      commissions,
      mealAllowanceTaxablePortion,
      absenceDeductions,
    },
    context: {
      irsRegion,
      contractType,
      disabilityStatus,
      householdType,
      shiftStatus,
      overtimeStatus,
      mealEligibility,
      mealPaymentType,
      duodecimosMode,
      holidayPaid,
      christmasPaid,
    },
  };
}

function renderResult(result, resolvedContext) {
  outputFields.grossIncome.textContent = formatCurrency(result.grossIncome);
  outputFields.componentsTotal.textContent = formatCurrency(
    result.components?.positiveComponentsTotal ?? 0,
  );
  outputFields.absenceDeductions.textContent = formatCurrency(
    result.components?.absenceDeductions ?? 0,
  );
  outputFields.annualGrossIncome.textContent = formatCurrency(
    result.annualGrossIncome,
  );
  outputFields.socialSecurityAmount.textContent = formatCurrency(
    result.socialSecurityAmount,
  );
  outputFields.annualSocialSecurityAmount.textContent = formatCurrency(
    result.annualSocialSecurityAmount,
  );
  outputFields.irsAmount.textContent = formatCurrency(result.irsAmount);
  outputFields.annualIrsAmount.textContent = formatCurrency(
    result.annualIrsAmount,
  );
  outputFields.netSalary.textContent = formatCurrency(result.netSalary);
  outputFields.annualNetSalary.textContent = formatCurrency(
    result.annualNetSalary,
  );
  outputFields.table.textContent = `${result.table.presetLabel} | ${result.table.category}`;
  outputFields.bracket.textContent = `${formatBracketRange(result.bracket.range)} | taxa ${percentFormatter.format(result.bracket.taxaMarginalMaxima)}`;
  outputFields.formula.textContent = result.table.formula;
  outputFields.payPeriods.textContent = `${result.payPeriods} Pagamentos Salariais`;
  outputFields.context.textContent = `Região ${mapContextLabel("irsRegion", resolvedContext.irsRegion)}; Contrato ${mapContextLabel("contractType", resolvedContext.contractType)}; Deficiência ${mapContextLabel("disabilityStatus", resolvedContext.disabilityStatus)}; Agregado ${mapContextLabel("householdType", resolvedContext.householdType)}; Alimentação ${mapContextLabel("mealEligibility", resolvedContext.mealEligibility)}; Duodécimos ${mapContextLabel("duodecimosMode", resolvedContext.duodecimosMode)}; Horas Extra ${mapContextLabel("overtimeStatus", resolvedContext.overtimeStatus)}; Turnos ${mapContextLabel("shiftStatus", resolvedContext.shiftStatus)}`;
  resultPanel.hidden = false;
  status.textContent = "Salário líquido atualizado.";
}

function renderFinalSettlement(result) {
  outputFields.finalSettlementTotal.textContent = formatCurrency(
    result.totals.totalToReceive,
  );
  outputFields.finalSettlementContext.textContent = `Admissão ${result.inputSummary.admissionDate}; cessação ${result.inputSummary.terminationDate}; meses trabalhados ${result.context.workedMonthsInTerminationYear}; base diária ${formatCurrency(result.context.dailyBase)}`;

  outputFields.finalSettlementLines.innerHTML = "";
  for (const line of result.lines) {
    const row = document.createElement("p");
    row.className = "microcopy";
    const daysText =
      typeof line.days === "number" ? ` | ${formatDays(line.days)}` : "";
    row.textContent = `${line.description} | ${formatCurrency(line.value)}${daysText}`;
    outputFields.finalSettlementLines.appendChild(row);
  }

  finalSettlementPanel.hidden = false;
}

function calculateFromForm() {
  if (!irsData) return;

  try {
    updateVisibilityByContext();

    const dependents = Number(dependentsInput.value || 0);
    if (!Number.isInteger(dependents) || dependents < 0) {
      throw new Error("Os dependentes devem ser um inteiro não negativo");
    }

    const payPeriods = Number(payPeriodsSelect.value);
    const resolved = buildContextAndComponents();

    const result = calculateNetSalary({
      components: resolved.components,
      dependents,
      payPeriods,
      table: getTableByIndex(irsData, resolved.tableIndex),
    });

    renderResult(result, resolved.context);

    if (isFinalSettlementEnabled()) {
      const finalSettlement = calculateFinalSettlement({
        baseSalary: resolved.components.baseSalary,
        admissionDate: admissionDateInput.value,
        terminationDate: terminationDateInput.value,
        vacationTakenFromVested: vacationTakenFromVestedInput.value,
        vacationTakenFromProportional: vacationTakenFromProportionalInput.value,
        seniorityExtraVacationDays: seniorityExtraVacationDaysInput.value,
      });

      renderFinalSettlement(finalSettlement);
      status.textContent = "Salário líquido e acerto final atualizados.";
    } else {
      finalSettlementPanel.hidden = true;
      status.textContent = "Salário líquido atualizado.";
    }
  } catch (error) {
    status.textContent = error.message;
    resultPanel.hidden = true;
    finalSettlementPanel.hidden = true;
  }
}

async function loadIrsDataForRegion(region) {
  const normalizedRegion = IRS_JSON_BY_REGION[region] ? region : "continente";
  const regionPath = IRS_JSON_BY_REGION[normalizedRegion];
  let response = await fetch(regionPath);

  if (!response.ok) {
    response = await fetch(LEGACY_IRS_JSON_PATH);
  }

  if (!response.ok) {
    throw new Error("Ficheiro JSON de IRS não encontrado na pasta Tabelas_IRS");
  }

  irsData = await response.json();
  activeIrsRegion = normalizedRegion;
}

async function init() {
  status.textContent = "A carregar tabelas de IRS...";
  await loadIrsDataForRegion(irsRegionSelect?.value ?? "continente");
  updateVisibilityByContext();
  status.textContent =
    "Preenche o contexto do trabalhador, a remuneração e os dados de cessação.";
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  calculateFromForm();
});

calculateButton?.addEventListener("click", (event) => {
  event.preventDefault();
  calculateFromForm();
});

form.addEventListener("change", () => {
  updateVisibilityByContext();
});

irsRegionSelect?.addEventListener("change", async () => {
  try {
    status.textContent = "A carregar tabelas de IRS da região selecionada...";
    await loadIrsDataForRegion(irsRegionSelect.value);
    status.textContent = `Tabelas IRS da região ${mapContextLabel("irsRegion", activeIrsRegion)} carregadas.`;

    if (!resultPanel.hidden) {
      calculateFromForm();
    }
  } catch (error) {
    status.textContent = `Não foi possível carregar os dados de IRS: ${error.message}`;
  }
});

init().catch((error) => {
  status.textContent = `Não foi possível carregar os dados de IRS: ${error.message}`;
});
