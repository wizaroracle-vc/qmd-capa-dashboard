"use client";

import { FileText, Printer } from "lucide-react";
import { Btn } from "@/components/ui";

export function PrintButtons() {
  return (
    <div style={{ display: "flex", gap: 8 }}>
      <Btn variant="outline" onClick={() => window.print()}>
        <Printer size={15} /> Print Report
      </Btn>
      <Btn onClick={() => window.print()}>
        <FileText size={15} /> Export PDF
      </Btn>
    </div>
  );
}
