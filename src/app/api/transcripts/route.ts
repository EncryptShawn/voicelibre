/*
src/app/api/transcripts/route.ts

Summary:
API route for managing transcript records. Provides endpoints to fetch a paginated list of transcripts and to delete a transcript by id. Used by the client to display, search, and remove saved transcripts.

Imports to:
- Not directly imported; accessed via HTTP by client-side hooks.

Exports:
- export async function DELETE(req: Request)
- export async function GET(req: Request)

Exports used by:
- src/components/transcripts/hooks/useTranscripts.ts (calls these endpoints via fetch)

Nuances:
- The GET handler parses the messages_json field for each transcript, returning parsed messages or null if parsing fails.
- DELETE requires user authentication and only allows deleting transcripts owned by the authenticated user.
*/

import { NextResponse } from "next/server";
import { db } from "~/server/db";
import type { Library } from "@prisma/client";
import { auth } from "~/server/auth";

/**
 * DELETE
 *
 * Deletes a transcript by id for the authenticated user.
 * Expects an "id" query parameter. Returns 401 if not authenticated,
 * 400 if id is missing, 404 if transcript not found, or 200 on success.
 */
export async function DELETE(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  try {
    const transcript = await db.library.findFirst({
      where: {
        id,
        type: "transcript",
        user_id: session.user.id,
      },
    });

    if (!transcript) {
      return NextResponse.json(
        { error: "Transcript not found" },
        { status: 404 },
      );
    }

    await db.library.delete({
      where: {
        id,
        user_id: session.user.id,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting transcript:", error);
    return NextResponse.json(
      { error: "Failed to delete transcript" },
      { status: 500 },
    );
  }
}

/**
 * GET
 *
 * Returns a paginated list of transcript records.
 * Accepts "offset" and "limit" query parameters for pagination.
 * Each transcript includes parsed messages (if valid JSON) or null.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const offset = parseInt(searchParams.get("offset") ?? "0", 10);
  const limit = parseInt(searchParams.get("limit") ?? "20", 10);

  const transcripts = await db.library.findMany({
    where: { type: "transcript" },
    orderBy: { updated_at: "desc" },
    skip: offset,
    take: limit,
  });

  const result = transcripts.map((t: Library) => {
    let parsedMessages: unknown = null;
    try {
      parsedMessages = JSON.parse(t.messages_json);
    } catch {
      parsedMessages = null;
    }

    return {
      id: t.id,
      title: t.title,
      responder: t.responder,
      created_at: t.created_at,
      updated_at: t.updated_at,
      message_count: t.message_count,
      messages: parsedMessages,
    };
  });

  return NextResponse.json(result);
}
