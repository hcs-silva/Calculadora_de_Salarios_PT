function roundCurrency(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function toNumberOrZero(value) {
  if (value === null || value === undefined || value === "") return 0;
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : NaN;
}

function validateNonNegative(name, value) {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${name} deve ser um número não negativo`);
  }
}

const TABLE_PRESETS = [
  {
    id: "single-no-dependents",
    label: "Solteiro ou casado dois titulares, sem dependentes",
    description: "Tabela I - Trabalho dependente",
  },
  {
    id: "single-with-dependents",
    label: "Solteiro com dependentes",
    description: "Tabela II - Trabalho dependente",
  },
  {
    id: "married-single-earner",
    label: "Casado, único titular",
    description: "Tabela III - Trabalho dependente",
  },
  {
    id: "disability-single-no-dependents",
    label: "Deficiência: solteiro ou dois titulares, sem dependentes",
    description: "Tabela IV - Trabalho dependente",
  },
  {
    id: "disability-single-with-dependents",
    label: "Deficiência: solteiro com dependentes",
    description: "Tabela V - Trabalho dependente",
  },
  {
    id: "disability-married-dual-income-with-dependents",
    label: "Deficiência: casado dois titulares com dependentes",
    description: "Tabela VI - Trabalho dependente",
  },
  {
    id: "disability-married-single-earner",
    label: "Deficiência: casado, único titular",
    description: "Tabela VII - Trabalho dependente",
  },
];

function getPresetForTable(index, table) {
  const fallbackLabel = `${table.name} - ${table.category}`;
  return (
    TABLE_PRESETS[index] ?? {
      id: `table-${index}`,
      label: fallbackLabel,
      description: table.name,
    }
  );
}

function matchesBracket(income, range) {
  const lowerBoundMatches =
    range.minExclusive === null || income > range.minExclusive;
  const upperBoundMatches =
    range.maxInclusive === null || income <= range.maxInclusive;
  return lowerBoundMatches && upperBoundMatches;
}

function resolveParcelaAAbater(parcelaAAbater, grossIncome) {
  if (!parcelaAAbater) return 0;

  if (parcelaAAbater.type === "formula") {
    return (
      parcelaAAbater.coefficient *
      parcelaAAbater.multiplier *
      (parcelaAAbater.referenceBase - grossIncome)
    );
  }

  return parcelaAAbater.amount ?? 0;
}

export function getAvailableTables(irsData) {
  return irsData.tables.map((table, index) => ({
    ...getPresetForTable(index, table),
    index,
    name: table.name,
    category: table.category,
  }));
}

export function getTableByIndex(irsData, tableIndex) {
  const table = irsData.tables[tableIndex];
  if (!table) {
    throw new Error(`Índice de tabela de IRS desconhecido: ${tableIndex}`);
  }

  return {
    ...table,
    preset: getPresetForTable(tableIndex, table),
    tableIndex,
  };
}

export function getTableByPresetId(irsData, presetId) {
  const availableTables = getAvailableTables(irsData);
  const match = availableTables.find((table) => table.id === presetId);

  if (!match) {
    throw new Error(`Predefinição de IRS desconhecida: ${presetId}`);
  }

  return getTableByIndex(irsData, match.index);
}

export function findBracket(table, grossIncome) {
  const bracket = table.rows.find((row) =>
    matchesBracket(grossIncome, row.range),
  );
  if (!bracket) {
    throw new Error(
      `Não foi encontrado escalão de IRS para o bruto ${grossIncome}`,
    );
  }
  return bracket;
}

export function composeGrossIncome(components = {}) {
  const salaryComponents = {
    baseSalary: toNumberOrZero(components.baseSalary),
    duodecimos: toNumberOrZero(components.duodecimos),
    subsidies: toNumberOrZero(components.subsidies),
    overtime: toNumberOrZero(components.overtime),
    nightPremium: toNumberOrZero(components.nightPremium),
    commissions: toNumberOrZero(components.commissions),
    mealAllowanceTaxablePortion: toNumberOrZero(
      components.mealAllowanceTaxablePortion,
    ),
    absenceDeductions: toNumberOrZero(components.absenceDeductions),
  };

  validateNonNegative("Salário base", salaryComponents.baseSalary);
  validateNonNegative("Duodécimos", salaryComponents.duodecimos);
  validateNonNegative("Subsídios", salaryComponents.subsidies);
  validateNonNegative("Horas extra", salaryComponents.overtime);
  validateNonNegative("Acréscimo noturno", salaryComponents.nightPremium);
  validateNonNegative("Comissões", salaryComponents.commissions);
  validateNonNegative(
    "Parcela tributável do subsídio de alimentação",
    salaryComponents.mealAllowanceTaxablePortion,
  );
  validateNonNegative(
    "Descontos por faltas",
    salaryComponents.absenceDeductions,
  );

  const positiveComponentsTotal =
    salaryComponents.baseSalary +
    salaryComponents.duodecimos +
    salaryComponents.subsidies +
    salaryComponents.overtime +
    salaryComponents.nightPremium +
    salaryComponents.commissions +
    salaryComponents.mealAllowanceTaxablePortion;

  const grossIncome =
    positiveComponentsTotal - salaryComponents.absenceDeductions;

  if (grossIncome < 0) {
    throw new Error(
      "Os descontos por faltas não podem exceder os componentes positivos",
    );
  }

  return {
    ...salaryComponents,
    positiveComponentsTotal: roundCurrency(positiveComponentsTotal),
    grossIncome: roundCurrency(grossIncome),
  };
}

export function calculateNetSalary({
  grossIncome,
  components,
  socialSecurityRate = 0.11,
  dependents = 0,
  table,
  payPeriods = 12,
}) {
  let resolvedGrossIncome = grossIncome;
  let resolvedComponents = null;

  if (components) {
    resolvedComponents = composeGrossIncome(components);
    resolvedGrossIncome = resolvedComponents.grossIncome;
  }

  if (!Number.isFinite(resolvedGrossIncome) || resolvedGrossIncome < 0) {
    throw new Error("O rendimento bruto deve ser um número não negativo");
  }

  if (!Number.isInteger(dependents) || dependents < 0) {
    throw new Error("Os dependentes devem ser um inteiro não negativo");
  }

  if (!table) {
    throw new Error(
      "É obrigatória uma tabela de IRS para calcular o salário líquido",
    );
  }

  if (payPeriods !== 12 && payPeriods !== 14) {
    throw new Error("Os pagamentos anuais devem ser 12 ou 14");
  }

  const bracket = findBracket(table, resolvedGrossIncome);
  const socialSecurityAmount = resolvedGrossIncome * socialSecurityRate;
  const parcelaAAbater = resolveParcelaAAbater(
    bracket.parcelaAAbater,
    resolvedGrossIncome,
  );
  const parcelaAdicionalDependente =
    (bracket.parcelaAdicionalDependente ?? 0) * dependents;
  const irsAmount = Math.max(
    0,
    resolvedGrossIncome * bracket.taxaMarginalMaxima -
      parcelaAAbater -
      parcelaAdicionalDependente,
  );
  const netSalary = resolvedGrossIncome - socialSecurityAmount - irsAmount;
  const annualGrossIncome = resolvedGrossIncome * payPeriods;
  const annualSocialSecurityAmount = socialSecurityAmount * payPeriods;
  const annualIrsAmount = irsAmount * payPeriods;
  const annualNetSalary = netSalary * payPeriods;

  return {
    grossIncome: roundCurrency(resolvedGrossIncome),
    payPeriods,
    socialSecurityRate,
    socialSecurityAmount: roundCurrency(socialSecurityAmount),
    irsAmount: roundCurrency(irsAmount),
    netSalary: roundCurrency(netSalary),
    annualGrossIncome: roundCurrency(annualGrossIncome),
    annualSocialSecurityAmount: roundCurrency(annualSocialSecurityAmount),
    annualIrsAmount: roundCurrency(annualIrsAmount),
    annualNetSalary: roundCurrency(annualNetSalary),
    dependents,
    components: resolvedComponents,
    table: {
      index: table.tableIndex,
      presetId: table.preset?.id ?? null,
      presetLabel: table.preset?.label ?? `${table.name} - ${table.category}`,
      presetDescription: table.preset?.description ?? table.name,
      name: table.name,
      category: table.category,
      formula: table.formula,
    },
    bracket: {
      rangeLabel: bracket.rangeLabel,
      range: bracket.range,
      taxaMarginalMaxima: bracket.taxaMarginalMaxima,
      parcelaAAbater: roundCurrency(parcelaAAbater),
      parcelaAdicionalDependente: roundCurrency(
        bracket.parcelaAdicionalDependente ?? 0,
      ),
      taxaEfetivaMensalLimiteEscalao: bracket.taxaEfetivaMensalLimiteEscalao,
    },
  };
}
