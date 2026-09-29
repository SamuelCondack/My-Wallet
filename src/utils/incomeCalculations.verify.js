/**
 * Lightweight verification for income/cash-flow calculation semantics.
 * Run: node src/utils/incomeCalculations.verify.js
 * (No test runner in this project — this script asserts the canonical scenarios.)
 */
/* eslint-env node */

import {
  filterIncomes,
  getCashReceived,
  getEarnedIncome,
  getNetEarnings,
  getPendingIncome,
  getReceivedIncomeForFinancialPeriod,
} from "./incomeCalculations.js";

function assertEqual(label, actual, expected) {
  if (actual !== expected) {
    console.error(`FAIL: ${label} — expected ${expected}, got ${actual}`);
    process.exitCode = 1;
    return;
  }
  console.log(`PASS: ${label}`);
}

const septemberConfirmed = {
  id: "1",
  amount: 3000,
  incomePeriod: "2026-09",
  expectedDate: "2026-09-30",
  receivedDate: "2026-09-30",
  status: "confirmed",
  categoryId: "income-salary",
};

const septemberPending = {
  id: "2",
  amount: 1500,
  incomePeriod: "2026-09",
  expectedDate: "2026-10-10",
  receivedDate: null,
  status: "pending",
  categoryId: "income-youtube",
};

const incomes = [septemberConfirmed, septemberPending];

// TEST 1
assertEqual("T1 earned", getEarnedIncome([septemberConfirmed], "2026-09"), 3000);
assertEqual(
  "T1 received",
  getReceivedIncomeForFinancialPeriod([septemberConfirmed], "2026-09"),
  3000
);
assertEqual("T1 pending", getPendingIncome([septemberConfirmed], "2026-09"), 0);

// TEST 2
assertEqual("T2 earned", getEarnedIncome([septemberPending], "2026-09"), 1500);
assertEqual(
  "T2 received",
  getReceivedIncomeForFinancialPeriod([septemberPending], "2026-09"),
  0
);
assertEqual("T2 pending", getPendingIncome([septemberPending], "2026-09"), 1500);

// TEST 3 — confirm in October, period stays September
const afterConfirm = {
  ...septemberPending,
  status: "confirmed",
  receivedDate: "2026-10-10",
};
assertEqual(
  "T3 sep earned after confirm",
  getEarnedIncome([afterConfirm], "2026-09"),
  1500
);
assertEqual(
  "T3 sep pending after confirm",
  getPendingIncome([afterConfirm], "2026-09"),
  0
);
assertEqual(
  "T3 oct earned must stay 0",
  getEarnedIncome([afterConfirm], "2026-10"),
  0
);
assertEqual(
  "T3 oct cash in",
  getCashReceived([afterConfirm], "2026-10"),
  1500
);

// TEST 4 + 5 — net earnings and no double-count of pending
assertEqual("T4/5 earned", getEarnedIncome(incomes, "2026-09"), 4500);
assertEqual(
  "T4/5 received",
  getReceivedIncomeForFinancialPeriod(incomes, "2026-09"),
  3000
);
assertEqual("T4/5 pending", getPendingIncome(incomes, "2026-09"), 1500);
assertEqual("T4/5 net", getNetEarnings(incomes, "2026-09", 2000), 2500);

// TEST 9/10 filters
assertEqual(
  "T10 pending filter",
  filterIncomes(incomes, {
    year: "2026",
    month: "09",
    status: "pending",
  }).length,
  1
);
assertEqual(
  "T10 confirmed filter",
  filterIncomes(incomes, {
    year: "2026",
    month: "09",
    status: "confirmed",
  }).length,
  1
);
assertEqual(
  "T9 category filter",
  filterIncomes(incomes, {
    year: "2026",
    month: "09",
    categoryId: "income-youtube",
  }).length,
  1
);

if (!process.exitCode) {
  console.log("All income calculation checks passed.");
}
