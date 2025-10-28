"use client";

import { OperationsSection } from "../../../components/dashboard/OperationsSection";

export default function OperationsPage() {
  return (
    <div className="min-h-screen bg-slate-100 px-6 py-10 dark:bg-slate-900">
      <div className="mx-auto max-w-6xl">
        <OperationsSection standalone />
      </div>
    </div>
  );
}
