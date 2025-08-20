//src/app/api/responders/route.ts
/*
//
// Summary:
// Handles listing and creation of responder configurations for authenticated users. The GET handler returns all responders owned by the user or the system. The POST handler creates a new responder for the authenticated user, enforcing unique names per user.
//
// Imports to:
// - Used by: Next.js API routing system for the /api/responders endpoint.
//
// Exports:
// - GET: Returns all responders for the current user (or system).
// - POST: Creates a new responder for the current user.
//
// Exports used by:
// - Invoked by client-side fetches from components such as EditResponderModal (src/components/bottomBar/modals/EditResponderModal.tsx) and chat page (src/app/chat/page.tsx).
//
// Nuances:
// - GET returns both user-owned and system responders if authenticated, otherwise only system responders.
// - POST enforces unique responder names per user and sets default values for memory fields if not provided.
// - Only authenticated users can create responders; unauthenticated requests are rejected.
// - Responders are associated with the user's id as owner.
*/

import { auth } from "../../../server/auth";
import { db } from "../../../server/db";
import { NextResponse } from "next/server";

interface ResponderRequest {
  name: string;
  model: string;
  prompt: string;
  voice: string;
  voice_model: string;
  max_tokens: number;
  short_mem?: number;
  long_mem?: number;
  mem_expire?: number;
}

/**
 * GET
 * Returns all responders available to the current user.
 * - If authenticated, returns both user-owned and system responders.
 * - If not authenticated, returns only system responders.
 */
export async function GET() {
  const session = await auth();

  const responders = await db.responders.findMany({
    where: session?.user
      ? {
          OR: [{ owner: session.user.id }, { owner: "system" }],
        }
      : {
          owner: "system",
        },
  });

  return NextResponse.json(responders);
}

/**
 * POST
 * Creates a new responder for the authenticated user.
 * - Requires all main responder fields in the request body.
 * - Enforces unique responder names per user.
 * - Sets default values for memory fields if not provided.
 * - Returns the created responder object.
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const json = (await req.json()) as Partial<ResponderRequest>;

  const {
    name,
    model,
    prompt,
    voice,
    voice_model,
    max_tokens,
    short_mem,
    long_mem,
    mem_expire,
  } = json;

  if (!name || !model || !prompt || !voice || !voice_model || !max_tokens) {
    return NextResponse.json(
      { error: "Missing required responder fields" },
      { status: 400 },
    );
  }

  const existing = await db.responders.findFirst({
    where: {
      name,
      owner: session.user.id,
    },
  });

  if (existing) {
    return NextResponse.json(
      { error: "Responder with this name already exists" },
      { status: 400 },
    );
  }

  const newResponder = await db.responders.create({
    data: {
      owner: session.user.id,
      name,
      model,
      prompt,
      voice,
      voice_model,
      max_tokens,
      short_mem: short_mem ?? 3,
      long_mem: long_mem ?? 2,
      mem_expire: mem_expire ?? 1440,
    },
  });

  return NextResponse.json(newResponder);
}
