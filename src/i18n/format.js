/** Month name (1-12) in the given BCP-47 locale. `style`: "long" | "short". */
export function formatMonthName(month, locale, style = "long") {
  return new Date(2000, Number(month) - 1, 1).toLocaleString(locale, {
    month: style,
  });
}
