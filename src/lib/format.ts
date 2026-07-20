export const formatCurrency = (amount: number | null | undefined, currency = "Rs") => {
  const n = Number(amount ?? 0);
  return `${currency} ${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
};

export const formatDate = (d: string | Date | null | undefined) => {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};

export const formatDay = (d: string | Date | null | undefined) => {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
};

export const todayISO = () => new Date().toISOString().slice(0, 10);
