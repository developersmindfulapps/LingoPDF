import React from "react";

export default function AdminLoading() {
  return (
    <div
      className="space-y-6 animate-pulse"
      role="status"
      aria-label="Loading administrative data"
    >
      <div className="h-8 w-64 rounded-lg bg-[#E8E4D9]" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((idx) => (
          <div
            key={idx}
            className="h-28 rounded-xl bg-white border border-[#E8E4D9] p-4"
          />
        ))}
      </div>
      <div className="h-80 rounded-xl bg-white border border-[#E8E4D9] p-6" />
    </div>
  );
}
