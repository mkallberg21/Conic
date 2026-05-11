import type { ReactNode } from "react";

interface StatCardProps {
  label: string;
  value: ReactNode;
}

export const StatCard = ({ label, value }: StatCardProps) => {
  return (
    <article className="stat-card">
      <p>{label}</p>
      <h3>{value}</h3>
    </article>
  );
};
