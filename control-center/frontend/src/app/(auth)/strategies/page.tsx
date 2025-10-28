"use client";

import { StrategiesSection } from "../../../components/dashboard/StrategiesSection";

export default function StrategiesPage() {
  return (
    <div className="min-h-screen bg-slate-100 px-6 py-10 dark:bg-slate-900">
      <div className="mx-auto max-w-6xl">
        <StrategiesSection standalone />
      </div>
    </div>
  );
}
