import { db as prisma } from "~/server/db";
import { auth } from "~/server/auth";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body: unknown = await req.json();

    if (
      typeof body !== "object" ||
      body === null ||
      !("title" in body) ||
      !("messages" in body)
    ) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const { title, messages } = body as {
      title: unknown;
      messages: unknown;
    };

    if (
      typeof title !== "string" ||
      title.length > 150 ||
      !Array.isArray(messages)
    ) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const userId = session.user.id;
    const content = JSON.stringify(messages);
    const count = messages.length;

    const existing = await prisma.library.findFirst({
      where: {
        user_id: userId,
        type: "transcript",
        title,
      },
    });

    if (existing) {
      await prisma.library.update({
        where: { id: existing.id },
        data: {
          messages_json: content,
          message_count: count,
          updated_at: new Date(),
        },
      });
    } else {
      await prisma.library.create({
        data: {
          id: crypto.randomUUID(),
          user_id: userId,
          type: "transcript",
          title,
          messages_json: content,
          message_count: count,
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error saving transcript:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
