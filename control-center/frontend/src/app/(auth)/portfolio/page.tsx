"use client";

import { PortfolioSection } from "../../../components/dashboard/PortfolioSection";

export default function PortfolioPage() {
  return (
    <div className="min-h-screen bg-slate-100 px-6 py-10 dark:bg-slate-900">
      <div className="mx-auto max-w-6xl">
        <PortfolioSection standalone />
      </div>
    </div>
  );
}
