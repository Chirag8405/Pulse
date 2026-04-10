"use client";

import { useMemo } from "react";
import { useTheme } from "next-themes";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface SpreadHistoryChartProps {
  scores: number[];
}

export function SpreadHistoryChart({ scores }: SpreadHistoryChartProps) {
  const { resolvedTheme } = useTheme();

  const chartData = useMemo(() => {
    const normalizedScores = scores.slice(-5);

    while (normalizedScores.length < 5) {
      normalizedScores.unshift(0);
    }

    return normalizedScores.map((score, index) => ({
      name: `C${index + 1}`,
      score,
    }));
  }, [scores]);

  const barColor = resolvedTheme === "dark" ? "#ffffff" : "#000000";

  return (
    <section className="nb-card bg-card p-4">
      <h3 className="mb-3 font-mono text-xs uppercase tracking-wider text-muted-foreground">
        Spread History
      </h3>

      <div className="h-56 border-2 border-border bg-background px-2 py-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="0" stroke="rgb(var(--border))" vertical={false} />
            <XAxis dataKey="name" tickLine={false} axisLine={false} />
            <YAxis tickLine={false} axisLine={false} domain={[0, 100]} />
            <Tooltip cursor={{ fill: "rgba(0,0,0,0.06)" }} />
            <Bar
              dataKey="score"
              fill={barColor}
              stroke={barColor}
              strokeWidth={1}
              radius={[0, 0, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
