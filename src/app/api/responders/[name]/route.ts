/*
src/app/api/responders/[name]/route.ts

Summary:
Handles GET, PATCH, and DELETE operations for a single responder entity, identified by name. Supports authenticated user and admin access for updating or deleting responder configurations. Used for fetching, updating, and deleting responder records owned by the user or by the system.

Imports to:
- Used by: Next.js API routing system for /api/responders/[name] endpoint.

Exports:
- GET: Returns the responder object for the given name (if owned by user or system).
- PATCH: Updates the responder (if owned by user or, for admins, by system).
- DELETE: Deletes the responder (if owned by user).

Exports used by:
- src/components/bottomBar/modals/EditResponderModal.tsx (fetches, updates responders)
- src/app/chat/page.tsx (calls PATCH/DELETE via EditResponderModal and responder management UI)

Nuances:
- PATCH allows renaming a responder, but prevents duplicate names for the same owner.
- Admins can update system responders; regular users can only update their own.
- DELETE only allows users to delete their own responders, not system responders.
- All operations require authentication; PATCH/DELETE require ownership or admin rights.
*/

import { auth } from "../../../../server/auth";
import { db } from "../../../../server/db";
import { NextResponse } from "next/server";

interface RouteContext {
  params: Promise<{ name: string }>;
}

interface ResponderUpdate {
  name?: string;
  model?: string;
  prompt?: string;
  voice?: string;
  voice_model?: string;
  max_tokens?: number;
  short_mem?: number;
  long_mem?: number;
  mem_expire?: number;
}

/**
 * GET
 * Returns the responder object for the given name, if owned by the authenticated user or by the system.
 * Responds with 404 if not found, or 401 if not authenticated.
 */
export async function GET(request: Request, context: RouteContext) {
  const { name } = await context.params;
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const responder = await db.responders.findFirst({
    where: {
      name,
      OR: [{ owner: session.user.id }, { owner: "system" }],
    },
  });

  if (!responder) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(responder);
}

/**
 * DELETE
 * Deletes the responder with the given name if owned by the authenticated user.
 * Responds with 404 if not found or not owned, or 401 if not authenticated.
 */
export async function DELETE(request: Request, context: RouteContext) {
  const { name } = await context.params;
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const existing = await db.responders.findUnique({
    where: {
      responder: {
        name,
        owner: session.user.id,
      },
    },
  });

  if (!existing) {
    return NextResponse.json(
      { error: "Not found or not owned" },
      { status: 404 },
    );
  }

  await db.responders.delete({
    where: {
      responder: {
        name,
        owner: session.user.id,
      },
    },
  });

  return NextResponse.json({ success: true });
}

/**
 * PATCH
 * Updates the responder with the given name if owned by the authenticated user, or by the system (admin only).
 * Allows renaming, but prevents duplicate names for the same owner.
 * Responds with 404 if not found, 400 for invalid input or duplicate name, or 401 if not authenticated.
 */
export async function PATCH(request: Request, context: RouteContext) {
  const { name } = await context.params;
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const data = (await request.json()) as unknown;

  if (typeof data !== "object" || data === null) {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 },
    );
  }

  const update = data as ResponderUpdate;

  const responder = await db.responders.findUnique({
    where: {
      responder: {
        name,
        owner: userId,
      },
    },
  });

  if (responder) {
    if (update.name && update.name !== name) {
      const existing = await db.responders.findFirst({
        where: {
          name: update.name,
          owner: userId,
        },
      });

      if (existing) {
        return NextResponse.json(
          { error: "Responder with this name already exists" },
          { status: 400 },
        );
      }
    }

    await db.responders.update({
      where: {
        responder: {
          name,
          owner: userId,
        },
      },
      data: update,
    });

    return NextResponse.json({ success: true });
  }

  if (session.user.admin) {
    const systemResponder = await db.responders.findUnique({
      where: {
        responder: {
          name,
          owner: "system",
        },
      },
    });

    if (!systemResponder) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (update.name && update.name !== name) {
      const existing = await db.responders.findFirst({
        where: {
          name: update.name,
          owner: "system",
        },
      });

      if (existing) {
        return NextResponse.json(
          { error: "Responder with this name already exists" },
          { status: 400 },
        );
      }
    }

    await db.responders.update({
      where: {
        responder: {
          name,
          owner: "system",
        },
      },
      data: update,
    });

    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Not found" }, { status: 404 });
}
