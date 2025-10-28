"use client";

import { SettingsSection } from "../../../components/dashboard/SettingsSection";

export default function SettingsPage() {
  return (
    <div className="min-h-screen bg-slate-100 px-6 py-10 dark:bg-slate-900">
      <div className="mx-auto max-w-4xl">
        <SettingsSection standalone />
      </div>
    </div>
  );
}
