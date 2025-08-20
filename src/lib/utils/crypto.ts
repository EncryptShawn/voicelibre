import crypto from "crypto";
import { NextResponse } from "next/server";

export function decryptApiKey(encryptedKey: string | Buffer | Uint8Array) {
  try {
    const buf = Buffer.from(encryptedKey);
    const iv = buf.slice(0, 16);
    const encrypted = buf.slice(16);
    const decipher = crypto.createDecipheriv(
      "aes-256-cbc",
      Buffer.from(process.env.APIKEY_SECRET!, "base64"),
      iv,
    );
    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);
    return decrypted.toString("utf8");
  } catch {
    return NextResponse.json(
      { error: "Failed to decrypt user API key" },
      { status: 500 },
    );
  }
}
