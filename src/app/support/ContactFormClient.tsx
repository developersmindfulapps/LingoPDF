"use client";

import React, { useState } from "react";

interface FormState {
  name: string;
  email: string;
  subject: string;
  browser: string;
  message: string;
  hp_website: string;
}

const INITIAL_FORM: FormState = {
  name: "",
  email: "",
  subject: "",
  browser: "",
  message: "",
  hp_website: "",
};

export function ContactFormClient() {
  const [formData, setFormData] = useState<FormState>(INITIAL_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [clientErrors, setClientErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.name.trim()) {
      errors.name = "Please enter your name.";
    } else if (formData.name.trim().length > 100) {
      errors.name = "Name cannot exceed 100 characters.";
    }

    if (!formData.email.trim()) {
      errors.email = "Please enter your email address.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      errors.email = "Please enter a valid email address.";
    } else if (formData.email.trim().length > 254) {
      errors.email = "Email cannot exceed 254 characters.";
    }

    if (!formData.subject.trim()) {
      errors.subject = "Please enter a subject.";
    } else if (formData.subject.trim().length > 150) {
      errors.subject = "Subject cannot exceed 150 characters.";
    }

    if (!formData.message.trim()) {
      errors.message = "Please enter your message.";
    } else if (formData.message.trim().length > 5000) {
      errors.message = "Message cannot exceed 5,000 characters.";
    }

    if (formData.browser && formData.browser.length > 50) {
      errors.browser = "Browser description cannot exceed 50 characters.";
    }

    setClientErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (clientErrors[name]) {
      setClientErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isSubmitting) return;

    setSuccessMessage(null);
    setErrorMessage(null);

    if (!validate()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setErrorMessage(
          data.error ||
            "Failed to send your message. Please try again or email support@lingopdf.in directly."
        );
        return;
      }

      setSuccessMessage(
        data.message ||
          "Thank you for contacting LingoPDF. Your message has been sent successfully. Our support team will get back to you."
      );
      // Reset form on success
      setFormData(INITIAL_FORM);
      setClientErrors({});
    } catch {
      setErrorMessage(
        "Network connection error. Please check your connection or contact support@lingopdf.in directly."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-[var(--color-soft-sage)] p-6 sm:p-8 lg:p-10 shadow-xs">
      <div className="mb-6">
        <h3 className="font-heading text-xl sm:text-2xl font-bold text-[var(--color-forest-green)] mb-2">
          Send Us a Message
        </h3>
        <p className="text-sm text-[var(--color-charcoal)]/75">
          Have an inquiry, feedback, or need help? Fill out the form below or write directly to{" "}
          <a
            href="mailto:support@lingopdf.in"
            className="font-medium text-[var(--color-forest-green)] underline hover:text-[var(--color-terracotta)]"
          >
            support@lingopdf.in
          </a>
          .
        </p>
      </div>

      {/* Success banner */}
      {successMessage && (
        <div
          role="status"
          aria-live="polite"
          className="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-start gap-3"
        >
          <svg
            className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          <div className="text-sm font-medium leading-relaxed">{successMessage}</div>
        </div>
      )}

      {/* Error banner */}
      {errorMessage && (
        <div
          role="alert"
          aria-live="assertive"
          className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 flex items-start gap-3"
        >
          <svg
            className="w-5 h-5 text-rose-600 mt-0.5 shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <div className="text-sm font-medium leading-relaxed">{errorMessage}</div>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        {/* Honeypot field (hidden from assistive technologies & view) */}
        <div style={{ display: "none" }} aria-hidden="true">
          <label htmlFor="hp_website">Leave this field blank</label>
          <input
            type="text"
            id="hp_website"
            name="hp_website"
            value={formData.hp_website}
            onChange={handleChange}
            tabIndex={-1}
            autoComplete="off"
          />
        </div>

        {/* Row: Name & Email */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label
              htmlFor="contact-name"
              className="block text-xs sm:text-sm font-semibold text-[var(--color-charcoal)] mb-1.5"
            >
              Name <span className="text-[var(--color-terracotta)]">*</span>
            </label>
            <input
              id="contact-name"
              name="name"
              type="text"
              required
              maxLength={100}
              autoComplete="name"
              placeholder="e.g. Johann Schmidt"
              value={formData.name}
              onChange={handleChange}
              disabled={isSubmitting}
              aria-invalid={Boolean(clientErrors.name)}
              aria-describedby={clientErrors.name ? "name-error" : undefined}
              className={`w-full px-4 py-2.5 rounded-xl border text-sm sm:text-base bg-white text-[var(--color-charcoal)] placeholder-[var(--color-charcoal)]/40 focus:outline-none focus:ring-2 focus:ring-[var(--color-forest-green)] transition-all ${
                clientErrors.name
                  ? "border-rose-400 bg-rose-50/20"
                  : "border-[var(--color-soft-sage)] hover:border-[var(--color-forest-green)]/40"
              }`}
            />
            {clientErrors.name && (
              <p id="name-error" className="mt-1 text-xs text-rose-600 font-medium">
                {clientErrors.name}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="contact-email"
              className="block text-xs sm:text-sm font-semibold text-[var(--color-charcoal)] mb-1.5"
            >
              Email address <span className="text-[var(--color-terracotta)]">*</span>
            </label>
            <input
              id="contact-email"
              name="email"
              type="email"
              required
              maxLength={254}
              autoComplete="email"
              placeholder="you@example.com"
              value={formData.email}
              onChange={handleChange}
              disabled={isSubmitting}
              aria-invalid={Boolean(clientErrors.email)}
              aria-describedby={clientErrors.email ? "email-error" : undefined}
              className={`w-full px-4 py-2.5 rounded-xl border text-sm sm:text-base bg-white text-[var(--color-charcoal)] placeholder-[var(--color-charcoal)]/40 focus:outline-none focus:ring-2 focus:ring-[var(--color-forest-green)] transition-all ${
                clientErrors.email
                  ? "border-rose-400 bg-rose-50/20"
                  : "border-[var(--color-soft-sage)] hover:border-[var(--color-forest-green)]/40"
              }`}
            />
            {clientErrors.email && (
              <p id="email-error" className="mt-1 text-xs text-rose-600 font-medium">
                {clientErrors.email}
              </p>
            )}
          </div>
        </div>

        {/* Row: Subject & Browser */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <div className="sm:col-span-2">
            <label
              htmlFor="contact-subject"
              className="block text-xs sm:text-sm font-semibold text-[var(--color-charcoal)] mb-1.5"
            >
              Subject <span className="text-[var(--color-terracotta)]">*</span>
            </label>
            <input
              id="contact-subject"
              name="subject"
              type="text"
              required
              maxLength={150}
              placeholder="How can we help?"
              value={formData.subject}
              onChange={handleChange}
              disabled={isSubmitting}
              aria-invalid={Boolean(clientErrors.subject)}
              aria-describedby={clientErrors.subject ? "subject-error" : undefined}
              className={`w-full px-4 py-2.5 rounded-xl border text-sm sm:text-base bg-white text-[var(--color-charcoal)] placeholder-[var(--color-charcoal)]/40 focus:outline-none focus:ring-2 focus:ring-[var(--color-forest-green)] transition-all ${
                clientErrors.subject
                  ? "border-rose-400 bg-rose-50/20"
                  : "border-[var(--color-soft-sage)] hover:border-[var(--color-forest-green)]/40"
              }`}
            />
            {clientErrors.subject && (
              <p id="subject-error" className="mt-1 text-xs text-rose-600 font-medium">
                {clientErrors.subject}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="contact-browser"
              className="block text-xs sm:text-sm font-semibold text-[var(--color-charcoal)] mb-1.5"
            >
              Browser <span className="text-xs font-normal text-[var(--color-charcoal)]/60">(Optional)</span>
            </label>
            <select
              id="contact-browser"
              name="browser"
              value={formData.browser}
              onChange={handleChange}
              disabled={isSubmitting}
              className="w-full px-4 py-2.5 rounded-xl border border-[var(--color-soft-sage)] text-sm sm:text-base bg-white text-[var(--color-charcoal)] focus:outline-none focus:ring-2 focus:ring-[var(--color-forest-green)] hover:border-[var(--color-forest-green)]/40 transition-all"
            >
              <option value="">Select browser...</option>
              <option value="Chrome">Chrome</option>
              <option value="Edge">Edge</option>
              <option value="Other">Other</option>
            </select>
          </div>
        </div>

        {/* Message */}
        <div>
          <label
            htmlFor="contact-message"
            className="block text-xs sm:text-sm font-semibold text-[var(--color-charcoal)] mb-1.5"
          >
            Message <span className="text-[var(--color-terracotta)]">*</span>
          </label>
          <textarea
            id="contact-message"
            name="message"
            rows={5}
            required
            maxLength={5000}
            placeholder="Please describe your question or issue in detail. If reporting an issue, include relevant steps to reproduce."
            value={formData.message}
            onChange={handleChange}
            disabled={isSubmitting}
            aria-invalid={Boolean(clientErrors.message)}
            aria-describedby={clientErrors.message ? "message-error" : undefined}
            className={`w-full px-4 py-2.5 rounded-xl border text-sm sm:text-base bg-white text-[var(--color-charcoal)] placeholder-[var(--color-charcoal)]/40 focus:outline-none focus:ring-2 focus:ring-[var(--color-forest-green)] transition-all resize-y ${
              clientErrors.message
                ? "border-rose-400 bg-rose-50/20"
                : "border-[var(--color-soft-sage)] hover:border-[var(--color-forest-green)]/40"
            }`}
          />
          <div className="flex items-center justify-between mt-1">
            {clientErrors.message ? (
              <p id="message-error" className="text-xs text-rose-600 font-medium">
                {clientErrors.message}
              </p>
            ) : (
              <span className="text-xs text-[var(--color-charcoal)]/50">
                Never send passwords or sensitive personal information.
              </span>
            )}
            <span className="text-xs text-[var(--color-charcoal)]/50">
              {formData.message.length}/5000
            </span>
          </div>
        </div>

        {/* Submit Button */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full sm:w-auto px-8 py-3.5 rounded-xl font-heading font-semibold text-white bg-[var(--color-forest-green)] hover:bg-[#122B24] active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-forest-green)] focus-visible:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <svg
                  className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                <span>Sending...</span>
              </>
            ) : (
              <span>Send Message</span>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
