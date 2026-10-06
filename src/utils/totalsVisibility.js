/** Whether an income/expense row should count toward on-screen totals. */
export function countsInTotals(item) {
  return !item?.excludedFromTotals;
}
