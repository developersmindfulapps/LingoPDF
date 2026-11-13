/**
 * Centralized Paddle Sandbox Configuration & SDK Provider
 *
 * Enforces strict Sandbox boundary (Stage 2):
 * - Strictly targets Paddle Sandbox (https://sandbox-api.paddle.com)
 * - Rejects live keys or live environment mode
 * - Validates required environment variables
 * - Supplies cached/singleton Paddle SDK instance
 */

import { Environment, LogLevel, Paddle, type PaddleOptions } from "@paddle/paddle-node-sdk";

export const PADDLE_SANDBOX_PRODUCT_ID = "pro_01m78d25w601hs12gdyrbbbwhx";
export const PADDLE_SANDBOX_PRICE_ID = "pri_01m78d26fhwp2ggq8fy9w7srvp";

/**
 * Strips wrapping quotes from environment variable values.
 */
function cleanEnvValue(value?: string | null): string {
  if (!value) return "";
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

export function getPaddleEnvironment(): Environment {
  const env = cleanEnvValue(process.env.NEXT_PUBLIC_PADDLE_ENV).toLowerCase();
  if (env && env !== "sandbox") {
    throw new Error(
      `[Paddle Security Guard] Non-sandbox environment "${env}" rejected. Stage 2 must remain strictly in Paddle Sandbox.`
    );
  }
  return Environment.sandbox;
}

export function getPaddleApiKey(): string {
  const apiKey = cleanEnvValue(process.env.PADDLE_API_KEY);
  if (!apiKey) {
    throw new Error("[Paddle Config] PADDLE_API_KEY is not set.");
  }
  if (!apiKey.startsWith("pdl_sdbx_")) {
    throw new Error(
      "[Paddle Security Guard] PADDLE_API_KEY does not start with 'pdl_sdbx_'. Live API keys are strictly rejected in Stage 2."
    );
  }
  return apiKey;
}

export function getPaddleWebhookSecret(): string {
  const secret = cleanEnvValue(process.env.PADDLE_NOTIFICATION_WEBHOOK_SECRET);
  if (!secret) {
    throw new Error(
      "[Paddle Config] PADDLE_NOTIFICATION_WEBHOOK_SECRET is not configured."
    );
  }
  return secret;
}

export function getPaddleProductId(): string {
  const id = cleanEnvValue(process.env.NEXT_PUBLIC_PADDLE_PRODUCT_ID);
  return id || PADDLE_SANDBOX_PRODUCT_ID;
}

export function getPaddlePriceId(): string {
  const id = cleanEnvValue(process.env.NEXT_PUBLIC_PADDLE_PRICE_ID);
  return id || PADDLE_SANDBOX_PRICE_ID;
}

let cachedPaddleInstance: Paddle | null = null;

/**
 * Returns a cached, server-side Paddle Node SDK instance configured strictly for Sandbox.
 */
export function getPaddleInstance(): Paddle {
  if (cachedPaddleInstance) {
    return cachedPaddleInstance;
  }

  const apiKey = getPaddleApiKey();
  const environment = getPaddleEnvironment();

  const options: PaddleOptions = {
    environment,
    logLevel: process.env.NODE_ENV === "development" ? LogLevel.warn : LogLevel.error,
  };

  cachedPaddleInstance = new Paddle(apiKey, options);
  return cachedPaddleInstance;
}
