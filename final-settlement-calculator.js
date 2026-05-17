function roundCurrency(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function roundDays(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function toNumberOrZero(value) {
  if (value === null || value === undefined || value === "") return 0;
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    throw new Error("O valor numérico introduzido é inválido");
  }
  return numericValue;
}

function validateNonNegative(name, value) {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${name} deve ser um número não negativo`);
  }
}

function parseDate(value, name) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`${name} deve ser uma data válida (YYYY-MM-DD)`);
  }

  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function getWorkedMonthsInYear({ admissionDate, terminationDate, year }) {
  const yearStart = new Date(year, 0, 1);
  const effectiveStart = admissionDate > yearStart ? admissionDate : yearStart;

  if (effectiveStart > terminationDate) return 0;

  const months =
    (terminationDate.getFullYear() - effectiveStart.getFullYear()) * 12 +
    (terminationDate.getMonth() - effectiveStart.getMonth()) +
    1;

  return Math.max(0, Math.min(12, months));
}

function buildLine({ description, value, days = null }) {
  const line = {
    description,
    value: roundCurrency(value),
  };

  if (days !== null) {
    line.days = roundDays(days);
  }

  return line;
}

export function calculateFinalSettlement(input = {}) {
  const baseSalary = toNumberOrZero(input.baseSalary);
  const vacationTakenFromVested = toNumberOrZero(input.vacationTakenFromVested);
  const vacationTakenFromProportional = toNumberOrZero(
    input.vacationTakenFromProportional,
  );
  const seniorityExtraVacationDays = toNumberOrZero(
    input.seniorityExtraVacationDays,
  );

  validateNonNegative("Salário base", baseSalary);
  validateNonNegative(
    "Dias de férias vencidas já gozados",
    vacationTakenFromVested,
  );
  validateNonNegative(
    "Dias de férias proporcionais já gozados",
    vacationTakenFromProportional,
  );
  validateNonNegative(
    "Dias extra de férias por antiguidade",
    seniorityExtraVacationDays,
  );

  const admissionDate = parseDate(input.admissionDate, "Data de admissão");
  const terminationDate = parseDate(input.terminationDate, "Data de cessação");

  if (terminationDate < admissionDate) {
    throw new Error(
      "A data de cessação deve ser igual ou posterior à data de admissão",
    );
  }

  const terminationYear = terminationDate.getFullYear();
  const workedMonthsInTerminationYear = getWorkedMonthsInYear({
    admissionDate,
    terminationDate,
    year: terminationYear,
  });

  const dailyBase = baseSalary / 30;
  const workedDaysInTerminationMonth = Math.min(30, terminationDate.getDate());

  const proportionalBaseSalary = dailyBase * workedDaysInTerminationMonth;
  const proportionalHolidaySubsidy =
    baseSalary * (workedMonthsInTerminationYear / 12);
  const proportionalChristmasSubsidy =
    baseSalary * (workedMonthsInTerminationYear / 12);

  const hasVestedBalance = admissionDate.getFullYear() < terminationYear;
  const vestedBaseDays = hasVestedBalance ? 22 : 0;
  const vestedExtraDays = hasVestedBalance ? seniorityExtraVacationDays : 0;
  const vestedTotalDays = vestedBaseDays + vestedExtraDays;

  if (vacationTakenFromVested > vestedTotalDays) {
    throw new Error(
      "Os dias de férias vencidas já gozados não podem exceder o saldo vencido",
    );
  }

  const vestedNotTakenDays = vestedTotalDays - vacationTakenFromVested;
  const vestedNotTakenAmount = dailyBase * vestedNotTakenDays;
  const holidaySubsidyForVestedNotTaken = dailyBase * vestedNotTakenDays;

  const proportionalBaseDaysRaw = 22 * (workedMonthsInTerminationYear / 12);
  const proportionalExtraDaysRaw =
    seniorityExtraVacationDays * (workedMonthsInTerminationYear / 12);

  const proportionalBaseDaysCapped = Math.min(22, proportionalBaseDaysRaw);
  const proportionalExtraDaysCapped = Math.min(
    seniorityExtraVacationDays,
    proportionalExtraDaysRaw,
  );
  const proportionalTotalDays =
    proportionalBaseDaysCapped + proportionalExtraDaysCapped;

  if (vacationTakenFromProportional > proportionalTotalDays) {
    throw new Error(
      "Os dias de férias proporcionais já gozados não podem exceder o saldo proporcional",
    );
  }

  const proportionalNotTakenDays =
    proportionalTotalDays - vacationTakenFromProportional;
  const proportionalVacationAmount = dailyBase * proportionalNotTakenDays;

  const lines = [
    buildLine({
      description: "Remuneração base proporcional até à data de cessação",
      value: proportionalBaseSalary,
    }),
    buildLine({
      description: "Subsídio de férias proporcional do ano de cessação",
      value: proportionalHolidaySubsidy,
    }),
    buildLine({
      description: "Subsídio de Natal proporcional do ano de cessação",
      value: proportionalChristmasSubsidy,
    }),
    buildLine({
      description: "Férias vencidas e não gozadas",
      days: vestedNotTakenDays,
      value: vestedNotTakenAmount,
    }),
    buildLine({
      description:
        "Subsídio de férias associado às férias vencidas e não gozadas",
      value: holidaySubsidyForVestedNotTaken,
    }),
    buildLine({
      description: "Férias proporcionais do ano de cessação",
      days: proportionalNotTakenDays,
      value: proportionalVacationAmount,
    }),
    buildLine({
      description: "Acréscimo por antiguidade considerado no saldo de férias",
      days: vestedExtraDays + proportionalExtraDaysCapped,
      value: dailyBase * (vestedExtraDays + proportionalExtraDaysCapped),
    }),
  ];

  const totalToReceive = lines.reduce((sum, line) => sum + line.value, 0);

  return {
    inputSummary: {
      admissionDate: input.admissionDate,
      terminationDate: input.terminationDate,
      baseSalary: roundCurrency(baseSalary),
      vacationTakenFromVested: roundDays(vacationTakenFromVested),
      vacationTakenFromProportional: roundDays(vacationTakenFromProportional),
      seniorityExtraVacationDays: roundDays(seniorityExtraVacationDays),
    },
    assumptions: [
      "Base diária = salário base mensal / 30.",
      "Férias proporcionais no ano de cessação = 22 x (meses trabalhados / 12), com limite anual.",
      "Sem deduções por aviso prévio não cumprido, salvo regra explícita externa.",
    ],
    context: {
      terminationYear,
      workedMonthsInTerminationYear,
      workedDaysInTerminationMonth,
      dailyBase: roundCurrency(dailyBase),
      hasVestedBalance,
    },
    detailDays: {
      vestedBaseDays: roundDays(vestedBaseDays),
      vestedExtraDays: roundDays(vestedExtraDays),
      vestedTotalDays: roundDays(vestedTotalDays),
      vestedNotTakenDays: roundDays(vestedNotTakenDays),
      proportionalBaseDays: roundDays(proportionalBaseDaysCapped),
      proportionalExtraDays: roundDays(proportionalExtraDaysCapped),
      proportionalTotalDays: roundDays(proportionalTotalDays),
      proportionalNotTakenDays: roundDays(proportionalNotTakenDays),
    },
    lines,
    totals: {
      totalToReceive: roundCurrency(totalToReceive),
    },
  };
}
