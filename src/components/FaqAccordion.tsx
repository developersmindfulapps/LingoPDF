"use client";

import React, { useState } from "react";

export interface FaqItem {
  question: string;
  answer: string;
}

export interface FaqAccordionProps {
  items: FaqItem[];
  className?: string;
}

export function FaqAccordion({ items, className = "" }: FaqAccordionProps) {
  const [openIndices, setOpenIndices] = useState<number[]>([0]);

  const toggleItem = (index: number) => {
    setOpenIndices((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]
    );
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {items.map((item, index) => {
        const isOpen = openIndices.includes(index);
        const buttonId = `faq-btn-${index}`;
        const panelId = `faq-panel-${index}`;

        return (
          <div
            key={item.question}
            className="rounded-2xl border border-[var(--color-soft-sage)] bg-white overflow-hidden transition-all duration-200 shadow-xs"
          >
            <h3>
              <button
                id={buttonId}
                type="button"
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => toggleItem(index)}
                className="w-full flex items-center justify-between gap-4 p-5 sm:p-6 text-left font-heading text-base sm:text-lg font-bold text-[var(--color-forest-green)] hover:text-[#122B24] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-forest-green)] transition-colors"
              >
                <span>{item.question}</span>
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--color-warm-ivory)] border border-[var(--color-soft-sage)] text-[var(--color-forest-green)] transition-transform duration-200 ${
                    isOpen ? "rotate-180" : ""
                  }`}
                  aria-hidden="true"
                >
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth="2.5"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M19.5 8.25l-7.5 7.5-7.5-7.5"
                    />
                  </svg>
                </span>
              </button>
            </h3>
            <div
              id={panelId}
              role="region"
              aria-labelledby={buttonId}
              hidden={!isOpen}
              className={`px-5 sm:px-6 pb-5 sm:pb-6 pt-1 text-sm sm:text-base text-[var(--color-charcoal)]/80 leading-relaxed font-sans border-t border-[var(--color-soft-sage)]/40 ${
                !isOpen ? "hidden" : ""
              }`}
            >
              {item.answer}
            </div>
          </div>
        );
      })}
    </div>
  );
}
