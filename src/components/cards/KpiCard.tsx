"use client";

import { cn } from "@/lib/utils";

type Format = "currency" | "percent" | "number" | "multiplier";

interface KpiCardProps {
  label: string;
  value: number | null;
  delta?: number | null;
  format?: Format;
  currency?: string;
  isPositiveWhenUp?: boolean; // false for CPL (lower = better)
  className?: string;
}

function formatValue(value: number | null, format: Format, currency = "USD"): string {
  if (value === null || value === undefined) return "—";
  switch (format) {
    case "currency":
      return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(value);
    case "percent":
      return `${value.toFixed(2)}%`;
    case "multiplier":
      return `${value.toFixed(2)}x`;
    default:
      return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
  }
}

export function KpiCard({
  label,
  value,
  delta,
  format = "number",
  currency = "USD",
  isPositiveWhenUp = true,
  className,
}: KpiCardProps) {
  const hasDelta = delta !== null && delta !== undefined;
  const isPositive = hasDelta && (isPositiveWhenUp ? delta > 0 : delta < 0);
  const isNegative = hasDelta && (isPositiveWhenUp ? delta < 0 : delta > 0);

  return (
    <div className={cn("bg-white rounded-xl border border-gray-200 p-5 shadow-sm", className)}>
      <p className="text-sm text-gray-500 font-medium">{label}</p>
      <p className="text-2xl font-bold text-gray-900 mt-1">
        {formatValue(value, format, currency)}
      </p>
      {hasDelta && (
        <p
          className={cn(
            "text-xs font-medium mt-1",
            isPositive && "text-green-600",
            isNegative && "text-red-600",
            !isPositive && !isNegative && "text-gray-500"
          )}
        >
          {delta > 0 ? "▲" : delta < 0 ? "▼" : "—"}{" "}
          {Math.abs(delta).toFixed(1)}% vs prev period
        </p>
      )}
    </div>
  );
}
