import * as React from "react";
import { cn } from "../lib/utils";
import { Card, CardContent } from "./card";

interface StatCardProps {
  label: string;
  value: string | number;
  delta?: string;
  deltaPositive?: boolean;
  icon?: React.ReactNode;
  className?: string;
}

export function StatCard({ label, value, delta, deltaPositive, icon, className }: StatCardProps) {
  return (
    <Card className={cn("", className)}>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">{label}</p>
          {icon && <span className="text-muted-foreground">{icon}</span>}
        </div>
        <p className="mt-2 text-2xl font-bold tracking-tight">{value}</p>
        {delta && (
          <p className={cn("mt-1 text-xs", deltaPositive ? "text-green-600" : "text-red-500")}>
            {deltaPositive ? "▲" : "▼"} {delta}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
