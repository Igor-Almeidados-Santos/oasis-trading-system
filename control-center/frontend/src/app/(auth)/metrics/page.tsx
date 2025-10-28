"use client";

import { MetricsSection } from "../../../components/dashboard/MetricsSection";

export default function MetricsPage() {
  return (
    <div className="min-h-screen bg-slate-100 px-6 py-10 dark:bg-slate-900">
      <div className="mx-auto max-w-6xl">
        <MetricsSection standalone />
      </div>
    </div>
  );
}
