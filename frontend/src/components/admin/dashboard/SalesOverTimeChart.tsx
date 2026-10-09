"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatOrderMoney } from "@/lib/utils/adminOrderFormat";

interface SalesOverTimeChartProps {
  data: { day: string; revenue: number }[];
  currencyCode: string;
}

/** One market's own revenue over time, in its own currency — never combined with another market's. */
export function SalesOverTimeChart({ data, currencyCode }: SalesOverTimeChartProps) {
  if (data.every((point) => point.revenue === 0)) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-text-secondary">
        No sales recorded in this period yet.
      </div>
    );
  }

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
          <defs>
            <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--color-border)" />
          <XAxis
            dataKey="day"
            tickFormatter={(value: string) => new Date(value).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
            tick={{ fontSize: 11, fill: "var(--color-text-secondary)" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tickFormatter={(value: number) => formatOrderMoney(value, currencyCode)}
            tick={{ fontSize: 11, fill: "var(--color-text-secondary)" }}
            axisLine={false}
            tickLine={false}
            width={80}
          />
          <Tooltip
            formatter={(value) => formatOrderMoney(Number(value ?? 0), currencyCode)}
            labelFormatter={(value) => (value ? new Date(String(value)).toLocaleDateString("en-GB", { dateStyle: "medium" }) : "")}
            contentStyle={{ borderRadius: 8, borderColor: "var(--color-border)", fontSize: 12 }}
          />
          <Area
            type="monotone"
            dataKey="revenue"
            stroke="var(--color-primary)"
            strokeWidth={2}
            fill="url(#salesFill)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
