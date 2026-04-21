import { addMonths, addQuarters, addYears, differenceInCalendarDays } from "date-fns";

export function addFrequency(date: Date, frequency: "monthly" | "quarterly" | "yearly") {
  if (frequency === "quarterly") return addQuarters(date, 1);
  if (frequency === "yearly") return addYears(date, 1);
  return addMonths(date, 1);
}

export function computeProratedAmount(
  amount: number,
  dueDate: Date,
  frequency: "monthly" | "quarterly" | "yearly",
  prorationMode: "none" | "daily",
  endDate?: Date | null
) {
  if (prorationMode !== "daily" || !endDate) return amount;

  const periodEnd = addFrequency(dueDate, frequency);
  if (endDate >= periodEnd) return amount;
  if (endDate < dueDate) return 0;

  const totalDays = Math.max(differenceInCalendarDays(periodEnd, dueDate), 1);
  const activeDays = Math.max(differenceInCalendarDays(endDate, dueDate) + 1, 0);
  const prorated = (amount * activeDays) / totalDays;

  return Math.max(Number(prorated.toFixed(2)), 0);
}
