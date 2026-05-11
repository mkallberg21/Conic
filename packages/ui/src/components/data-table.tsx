import * as React from "react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "./table";
import { cn } from "../lib/utils";

export interface ColumnDef<T> {
  key: keyof T | string;
  header: string;
  className?: string;
  cell?: (row: T) => React.ReactNode;
}

interface DataTableProps<T> {
  columns: ColumnDef<T>[];
  data: T[];
  emptyText?: string;
  className?: string;
  rowKey?: (row: T) => string;
}

export function DataTable<T extends Record<string, unknown>>({
  columns, data, emptyText = "No results.", className, rowKey,
}: DataTableProps<T>) {
  return (
    <div className={cn("rounded-md border", className)}>
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((col) => (
              <TableHead key={String(col.key)} className={col.className}>
                {col.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.length === 0 ? (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                {emptyText}
              </TableCell>
            </TableRow>
          ) : (
            data.map((row, i) => (
              <TableRow key={rowKey ? rowKey(row) : i}>
                {columns.map((col) => (
                  <TableCell key={String(col.key)} className={col.className}>
                    {col.cell ? col.cell(row) : String((row as Record<string, unknown>)[col.key as string] ?? "")}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
