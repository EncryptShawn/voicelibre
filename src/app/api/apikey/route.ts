/*
src/app/api/apikey/route.ts

Summary:
Handles API key management for authenticated users. Provides endpoints to check for an existing API key, set (encrypt and store) a new API key, and delete the stored API key. All operations require user authentication and interact with the user record in the database.

Imports to:
- Used by: Next.js API routing system for /api/apikey endpoint.

Exports:
- GET: Returns whether the authenticated user has an API key stored.
- POST: Accepts and stores an encrypted API key for the authenticated user.
- DELETE: Removes the stored API key for the authenticated user.

Exports used by:
- Invoked by client-side fetches from pages/components that manage API keys (e.g., /apikey page, chat page for key presence).

Nuances:
- API keys are encrypted using AES-256-CBC with a secret from environment variables before storage.
- All endpoints require a valid session with a user email.
- The POST endpoint expects a JSON body with an "apikey" string property.
- The encrypted API key is stored as a Buffer in the database.

*/

import { auth } from "../../../server/auth";
import { db } from "../../../server/db";
import { NextResponse } from "next/server";
import crypto from "crypto";

const secret = Buffer.from(process.env.APIKEY_SECRET!, "base64");

/**
 * encrypt
 * Encrypts a string using AES-256-CBC with a random IV and a secret key.
 * Returns a Buffer containing the IV and the encrypted data.
 */
function encrypt(text: string): Buffer {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-cbc", secret, iv);
  const encrypted = Buffer.concat([
    cipher.update(text, "utf8"),
    cipher.final(),
  ]);
  return Buffer.concat([iv, encrypted]);
}

/**
 * GET
 * Checks if the authenticated user has an API key stored.
 * Returns { hasKey: boolean } if the user is found, or an error response otherwise.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.email)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await db.user.findUnique({
    where: { email: session.user.email },
  });
  if (!user)
    return NextResponse.json({ error: "User not found" }, { status: 404 });

  return NextResponse.json({ hasKey: !!user.apipie_key });
}

/**
 * POST
 * Accepts a JSON body with an "apikey" string, encrypts it, and stores it for the authenticated user.
 * Returns { success: true } on success, or an error response on failure.
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.email)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body: unknown = await req.json();
  if (
    typeof body !== "object" ||
    body === null ||
    !("apikey" in body) ||
    typeof (body as { apikey: unknown }).apikey !== "string"
  ) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const apikey = (body as { apikey: string }).apikey;

  const user = await db.user.findUnique({
    where: { email: session.user.email },
  });
  if (!user)
    return NextResponse.json({ error: "User not found" }, { status: 404 });

  const encrypted = encrypt(apikey);
  await db.user.update({
    where: { email: session.user.email },
    data: { apipie_key: encrypted },
  });

  return NextResponse.json({ success: true });
}

/**
 * DELETE
 * Removes the stored API key for the authenticated user.
 * Returns { success: true } on success, or an error response if the user is not found.
 */
export async function DELETE() {
  const session = await auth();
  if (!session?.user?.email)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await db.user.findUnique({
    where: { email: session.user.email },
  });
  if (!user)
    return NextResponse.json({ error: "User not found" }, { status: 404 });

  await db.user.update({
    where: { email: session.user.email },
    data: { apipie_key: null },
  });

  return NextResponse.json({ success: true });
}
