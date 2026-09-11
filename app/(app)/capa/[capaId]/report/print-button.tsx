"use client";

import { FileText, Printer, Sparkles } from "lucide-react";
import { Btn } from "@/components/ui";

function printClean() {
  const root = document.documentElement;
  root.classList.add("clean-export");
  const cleanup = () => {
    root.classList.remove("clean-export");
    window.removeEventListener("afterprint", cleanup);
  };
  window.addEventListener("afterprint", cleanup);
  window.print();
}

export function PrintButtons() {
  return (
    <div style={{ display: "flex", gap: 8 }}>
      <Btn variant="outline" onClick={() => window.print()}>
        <Printer size={15} /> Print Report
      </Btn>
      <Btn variant="outline" onClick={printClean}>
        <Sparkles size={15} /> Clean Export
      </Btn>
      <Btn onClick={() => window.print()}>
        <FileText size={15} /> Export PDF
      </Btn>
    </div>
  );
}
