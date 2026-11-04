"use client";

import React from "react";

export default function AdminErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div
      role="alert"
      className="rounded-2xl bg-white border border-red-200 p-8 max-w-xl mx-auto my-8 space-y-4"
    >
      <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-900">
        Operational Error
      </div>
      <h2 className="font-heading text-xl font-bold text-[#193C32]">
        Unable to load administrative view
      </h2>
      <p className="text-sm text-[#242923]/80">
        {error.message ||
          "An unexpected error occurred while loading data from MongoDB."}
      </p>
      <div className="pt-2">
        <button
          type="button"
          onClick={() => {
            try {
              reset();
            } catch {
              // fallback
            }
            window.location.reload();
          }}
          className="px-4 py-2 rounded-lg bg-[#193C32] text-white text-xs font-semibold hover:bg-[#122B24] cursor-pointer"
        >
          Retry Operation
        </button>
      </div>
    </div>
  );
}
