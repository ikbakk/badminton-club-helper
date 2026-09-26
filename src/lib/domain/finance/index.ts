export type Obligation = { amount: number };
export type Allocation = { amount: number };
export type Payment = { amount: number };
export type Expense = { amount: number };
export const debt = (obligations: Obligation[], allocations: Allocation[]) =>
	obligations.reduce((n, x) => n + x.amount, 0) - allocations.reduce((n, x) => n + x.amount, 0);
export const credit = (payments: Payment[], allocations: Allocation[]) =>
	payments.reduce((n, x) => n + x.amount, 0) - allocations.reduce((n, x) => n + x.amount, 0);
export const clubBalance = (payments: Payment[], expenses: Expense[]) =>
	payments.reduce((n, x) => n + x.amount, 0) - expenses.reduce((n, x) => n + x.amount, 0);
