import * as React from "react";
import { Badge } from "./badge";
import { cn } from "../lib/utils";

const STATUS_MAP: Record<string, { label: string; className: string }> = {
  // Contract statuses
  DRAFT:      { label: "Draft",      className: "bg-gray-100 text-gray-700 border-gray-200" },
  PENDING:    { label: "Pending",    className: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  ACTIVE:     { label: "Active",     className: "bg-blue-100 text-blue-700 border-blue-200" },
  COMPLETED:  { label: "Completed",  className: "bg-green-100 text-green-700 border-green-200" },
  CANCELLED:  { label: "Cancelled",  className: "bg-red-100 text-red-700 border-red-200" },
  DISPUTED:   { label: "Disputed",   className: "bg-orange-100 text-orange-700 border-orange-200" },
  // Payment statuses
  PROCESSING: { label: "Processing", className: "bg-blue-100 text-blue-700 border-blue-200" },
  PAID:       { label: "Paid",       className: "bg-green-100 text-green-700 border-green-200" },
  FAILED:     { label: "Failed",     className: "bg-red-100 text-red-700 border-red-200" },
  REFUNDED:   { label: "Refunded",   className: "bg-purple-100 text-purple-700 border-purple-200" },
  // Deliverable statuses
  SUBMITTED:  { label: "Submitted",  className: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  APPROVED:   { label: "Approved",   className: "bg-green-100 text-green-700 border-green-200" },
  REJECTED:   { label: "Rejected",   className: "bg-red-100 text-red-700 border-red-200" },
  REVISION:   { label: "Revision",   className: "bg-orange-100 text-orange-700 border-orange-200" },
};

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = STATUS_MAP[status?.toUpperCase()] ?? { label: status, className: "bg-gray-100 text-gray-700" };
  return (
    <Badge variant="outline" className={cn(config.className, "font-medium", className)}>
      {config.label}
    </Badge>
  );
}
