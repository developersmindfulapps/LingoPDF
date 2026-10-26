import { NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "./session";

/**
 * Sets the secure httpOnly session cookie on a NextResponse.
 */
export function setSessionCookie(
  response: NextResponse,
  token: string,
  expiresAt: Date
): void {
  const isProduction = process.env.NODE_ENV === "production";

  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

/**
 * Clears the session cookie on a NextResponse.
 */
export function clearSessionCookie(response: NextResponse): void {
  const isProduction = process.env.NODE_ENV === "production";

  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
    expires: new Date(0),
  });
}
