import React from "react";

export default function ReferralLoading() {
  return (
    <div className="space-y-8 animate-pulse">
      <div className="bg-white rounded-2xl border border-[var(--color-soft-sage)] p-6 sm:p-8 space-y-4">
        <div className="h-6 w-48 bg-stone-200 rounded"></div>
        <div className="h-4 w-96 bg-stone-100 rounded"></div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4">
          <div className="h-20 bg-stone-100 rounded-xl"></div>
          <div className="h-20 bg-stone-100 rounded-xl"></div>
          <div className="h-20 bg-stone-100 rounded-xl"></div>
        </div>
      </div>
      <div className="bg-white rounded-2xl border border-[var(--color-soft-sage)] p-6 sm:p-8 space-y-4">
        <div className="h-6 w-60 bg-stone-200 rounded"></div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
          <div className="h-32 bg-stone-100 rounded-xl"></div>
          <div className="h-32 bg-stone-100 rounded-xl"></div>
          <div className="h-32 bg-stone-100 rounded-xl"></div>
        </div>
      </div>
    </div>
  );
}
