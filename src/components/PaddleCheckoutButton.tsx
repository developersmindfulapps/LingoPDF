"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { initializePaddle, type Paddle } from "@paddle/paddle-js";
import { Button } from "./Button";

export interface PaddleCheckoutButtonProps {
  label?: string;
  size?: "sm" | "md" | "lg";
  variant?: "primary" | "secondary";
  className?: string;
  fullWidth?: boolean;
  referralCode?: string;
  region?: string;
}

// Module-level singleton for Paddle.js initialization
let paddleInitPromise: Promise<Paddle | undefined> | null = null;
let currentEventCallback: ((event: { name: string; [key: string]: unknown }) => void) | null = null;

function getPaddleSingleton(
  token: string,
  environment: "sandbox" | "production"
): Promise<Paddle | undefined> {
  if (!paddleInitPromise) {
    paddleInitPromise = initializePaddle({
      token,
      environment,
      eventCallback: (event) => {
        currentEventCallback?.(event as { name: string; [key: string]: unknown });
      },
    });
  }
  return paddleInitPromise;
}

export function PaddleCheckoutButton({
  label = "Buy Now — Lifetime Licence",
  size = "lg",
  variant = "primary",
  className = "",
  fullWidth = true,
  referralCode,
  region,
}: PaddleCheckoutButtonProps) {
  const router = useRouter();
  const [paddle, setPaddle] = useState<Paddle | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pollStatus, setPollStatus] = useState<string | null>(null);
  const activePurchaseIdRef = useRef<string | null>(null);

  const clientToken = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN;
  const paddleEnv =
    (process.env.NEXT_PUBLIC_PADDLE_ENV as "sandbox" | "production") ||
    "sandbox";

  // Polling declared prior to useEffect to avoid hoisting issues
  const pollPurchaseStatus = useCallback(
    async (purchaseId: string) => {
      let attempts = 0;
      const maxAttempts = 20; // 40 seconds max polling

      const interval = setInterval(async () => {
        attempts++;
        try {
          const res = await fetch(
            `/api/checkout/status?purchaseId=${encodeURIComponent(purchaseId)}`,
            { cache: "no-store" }
          );
          if (res.ok) {
            const data = await res.json();
            if (data.isCaptured && data.hasEntitlement) {
              clearInterval(interval);
              setPollStatus("Licence activated! Redirecting to devices...");
              router.push("/account/devices?checkout=success");
              return;
            }
          }
        } catch {
          // Continue polling
        }

        if (attempts >= maxAttempts) {
          clearInterval(interval);
          setPollStatus(
            "Payment processing. Your licence will appear in your account shortly."
          );
          setTimeout(() => {
            router.push("/account/devices");
          }, 3000);
        }
      }, 2000);
    },
    [router]
  );

  // Initialize Paddle.js using the singleton loader
  useEffect(() => {
    let isMounted = true;
    if (!clientToken) return;

    const handlePaddleEvent = (event: { name: string; [key: string]: unknown }) => {
      if (event.name === "checkout.completed") {
        setPollStatus("Payment received. Confirming licence...");
        const purchaseId = activePurchaseIdRef.current;
        if (purchaseId) {
          pollPurchaseStatus(purchaseId);
        }
      } else if (event.name === "checkout.error") {
        loggerClient("Paddle checkout error:", event);
        setErrorMessage("Checkout error occurred. Please try again.");
        setIsLoading(false);
      }
    };

    currentEventCallback = handlePaddleEvent;

    getPaddleSingleton(clientToken, paddleEnv).then((p) => {
      if (isMounted && p) {
        setPaddle(p);
      }
    });

    return () => {
      isMounted = false;
      if (currentEventCallback === handlePaddleEvent) {
        currentEventCallback = null;
      }
    };
  }, [clientToken, paddleEnv, pollPurchaseStatus]);

  async function handleCheckout() {
    setIsLoading(true);
    setErrorMessage(null);
    setPollStatus(null);

    try {
      const res = await fetch("/api/checkout/session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          referralCode: referralCode || undefined,
          region: region || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.code === "UNAUTHORIZED") {
          const returnPath =
            typeof window !== "undefined"
              ? window.location.pathname + window.location.hash
              : "/";
          router.push(`/login?redirect=${encodeURIComponent(returnPath)}`);
          return;
        }

        if (data.code === "ALREADY_ENTITLED") {
          setErrorMessage(
            "Your account already has an active German → English licence."
          );
          setTimeout(() => {
            router.push("/account/devices");
          }, 2500);
          setIsLoading(false);
          return;
        }

        if (data.code === "DEFAULT_CHECKOUT_URL_NOT_SET") {
          setErrorMessage(
            "Paddle Sandbox checkout requires a Default payment link set in the Paddle Sandbox dashboard."
          );
          setIsLoading(false);
          return;
        }

        setErrorMessage(data.error || "Unable to start checkout session.");
        setIsLoading(false);
        return;
      }

      if (!data.transactionId) {
        setErrorMessage("Invalid checkout session returned from server.");
        setIsLoading(false);
        return;
      }

      activePurchaseIdRef.current = data.purchaseId;

      if (!paddle) {
        // Fallback to hosted checkout URL if client token is pending
        if (data.checkoutUrl) {
          window.location.assign(data.checkoutUrl);
          return;
        }
        setErrorMessage(
          "Paddle client token is pending configuration. Set NEXT_PUBLIC_PADDLE_CLIENT_TOKEN."
        );
        setIsLoading(false);
        return;
      }

      paddle.Checkout.open({
        transactionId: data.transactionId,
        settings: {
          displayMode: "overlay",
          theme: "light",
          showAddDiscounts: false,
          allowLogout: false,
          successUrl: `${window.location.origin}/account/devices?checkout=success`,
        },
      });
      setIsLoading(false);
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to open checkout."
      );
      setIsLoading(false);
    }
  }

  const widthClass = fullWidth ? "w-full" : "";

  return (
    <div className={`flex flex-col items-center ${widthClass}`}>
      <Button
        variant={variant}
        size={size}
        onClick={handleCheckout}
        disabled={isLoading}
        className={`${widthClass} ${className}`}
      >
        {isLoading ? "Starting Secure Checkout..." : label}
      </Button>

      {pollStatus && (
        <p className="mt-2 text-xs font-semibold text-[var(--color-forest-green)] animate-pulse">
          {pollStatus}
        </p>
      )}

      {errorMessage && (
        <p className="mt-2 text-xs text-red-600 font-medium max-w-sm text-center">
          {errorMessage}
        </p>
      )}
    </div>
  );
}

function loggerClient(...args: unknown[]) {
  if (process.env.NODE_ENV === "development") {
    console.warn(...args);
  }
}
