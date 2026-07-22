// Part 2 finance engine — pure functions over already-fetched rows.
// No network calls here. Keeps the "compute balances from source records"
// convention used across the app (dashboard, profit, etc.).
//
// Simple business language only: "money in / money out", "outstanding",
// "cash in hand", "bank balance". No debit/credit accounting.

// --- Shared row shapes (loose; only the fields we read) ----------------------

export type CustomerPaymentRow = {
  amount: number | null;
  account?: string | null; // cash | bank
  payment_type?: string | null; // payment | advance | partial | credit
};

export type SupplierPaymentRow = {
  amount: number | null;
  account?: string | null; // cash | bank
};

export type ExpenseRow = {
  amount: number | null;
  account?: string | null; // cash | bank
  category?: string | null;
};

export type CashAdjustmentRow = {
  amount: number | null;
  direction: string | null; // in | out
};

// ============================================================
// CASH IN HAND
//   + customer payments (cash)
//   + cash adjustments (in)
//   − supplier payments (cash)
//   − expenses (cash)
//   − cash adjustments (out)
// Note: cash "sales" are captured via customer payments recorded to cash,
// so we do not double count delivery totals here.
// ============================================================
export type CashInput = {
  customerPayments: CustomerPaymentRow[];
  supplierPayments: SupplierPaymentRow[];
  expenses: ExpenseRow[];
  adjustments: CashAdjustmentRow[];
};

const isCash = (account?: string | null) => (account ?? "cash").toLowerCase() === "cash";
const isBank = (account?: string | null) => (account ?? "").toLowerCase() === "bank";

export function computeCashInHand(i: CashInput): {
  inflow: number;
  outflow: number;
  balance: number;
} {
  const custIn = i.customerPayments
    .filter((p) => isCash(p.account))
    .reduce((a, p) => a + Number(p.amount ?? 0), 0);
  const adjIn = i.adjustments
    .filter((a) => (a.direction ?? "out") === "in")
    .reduce((a, r) => a + Number(r.amount ?? 0), 0);

  const supOut = i.supplierPayments
    .filter((p) => isCash(p.account))
    .reduce((a, p) => a + Number(p.amount ?? 0), 0);
  const expOut = i.expenses
    .filter((e) => isCash(e.account))
    .reduce((a, e) => a + Number(e.amount ?? 0), 0);
  const adjOut = i.adjustments
    .filter((a) => (a.direction ?? "out") === "out")
    .reduce((a, r) => a + Number(r.amount ?? 0), 0);

  const inflow = custIn + adjIn;
  const outflow = supOut + expOut + adjOut;
  return { inflow, outflow, balance: inflow - outflow };
}

// ============================================================
// BANK BALANCE (per account or overall)
//   opening + bank customer payments − bank supplier payments − bank expenses
// Rows carry bank_account_id so we can split per account.
// ============================================================
export type BankRow = {
  amount: number | null;
  account?: string | null;
  bank_account_id?: string | null;
};

export type BankAccount = {
  id: string;
  bank_name: string;
  account_title?: string | null;
  account_number?: string | null;
  opening_balance: number | null;
};

export function computeBankBalance(
  account: BankAccount,
  customerPayments: BankRow[],
  supplierPayments: BankRow[],
  expenses: BankRow[],
): { inflow: number; outflow: number; balance: number } {
  const forAcct = (r: BankRow) =>
    isBank(r.account) && (r.bank_account_id == null || r.bank_account_id === account.id);
  const inflow = customerPayments.filter(forAcct).reduce((a, r) => a + Number(r.amount ?? 0), 0);
  const outflow =
    supplierPayments.filter(forAcct).reduce((a, r) => a + Number(r.amount ?? 0), 0) +
    expenses.filter(forAcct).reduce((a, r) => a + Number(r.amount ?? 0), 0);
  const opening = Number(account.opening_balance ?? 0);
  return { inflow, outflow, balance: opening + inflow - outflow };
}

// Overall bank balance across all accounts.
export function computeTotalBankBalance(
  accounts: BankAccount[],
  customerPayments: BankRow[],
  supplierPayments: BankRow[],
  expenses: BankRow[],
): number {
  // Opening balances of every account.
  const opening = accounts.reduce((a, acc) => a + Number(acc.opening_balance ?? 0), 0);
  const inflow = customerPayments
    .filter((r) => isBank(r.account))
    .reduce((a, r) => a + Number(r.amount ?? 0), 0);
  const outflow =
    supplierPayments
      .filter((r) => isBank(r.account))
      .reduce((a, r) => a + Number(r.amount ?? 0), 0) +
    expenses.filter((r) => isBank(r.account)).reduce((a, r) => a + Number(r.amount ?? 0), 0);
  return opening + inflow - outflow;
}

// ============================================================
// CUSTOMER LEDGER
//   Charges (money customer owes us): deliveries, local filling, rental.
//   Payments (money received): customer payments.
//   Running balance = opening + Σ(charge) − Σ(payment). Positive = customer owes us.
// ============================================================
export type LedgerEntry = {
  date: string; // yyyy-mm-dd
  ts?: string | null; // created_at for stable sort
  type: string; // Invoice | Delivery | Local Filling | Rental | Payment | Advance | Opening
  detail: string;
  charge: number; // increases what they owe us
  payment: number; // decreases what they owe us
  remarks?: string | null;
  running?: number; // filled by buildLedger
};

export function buildLedger(
  opening: number,
  entries: Omit<LedgerEntry, "running">[],
): {
  rows: LedgerEntry[];
  opening: number;
  closing: number;
  totalCharge: number;
  totalPayment: number;
} {
  const sorted = [...entries].sort((a, b) => {
    const ak = (a.ts ?? a.date) || "";
    const bk = (b.ts ?? b.date) || "";
    return ak.localeCompare(bk);
  });
  let running = opening;
  let totalCharge = 0;
  let totalPayment = 0;
  const rows: LedgerEntry[] = sorted.map((e) => {
    running += Number(e.charge ?? 0) - Number(e.payment ?? 0);
    totalCharge += Number(e.charge ?? 0);
    totalPayment += Number(e.payment ?? 0);
    return { ...e, running };
  });
  return { rows, opening, closing: running, totalCharge, totalPayment };
}

// ============================================================
// INCOME — total income by source over already-fetched rows.
//   Deliveries (billed total), Local filling, Rental, Other.
// ============================================================
export type IncomeInput = {
  deliveries: { total_amount: number | null }[];
  localFillings: { total_amount: number | null }[];
  rentalIncome?: number;
  otherIncome?: number;
};

export function computeIncome(i: IncomeInput) {
  const delivery = i.deliveries.reduce((a, d) => a + Number(d.total_amount ?? 0), 0);
  const localFilling = i.localFillings.reduce((a, d) => a + Number(d.total_amount ?? 0), 0);
  const rental = Number(i.rentalIncome ?? 0);
  const other = Number(i.otherIncome ?? 0);
  return { delivery, localFilling, rental, other, total: delivery + localFilling + rental + other };
}
