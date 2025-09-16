import fs from "fs/promises";
import path from "path";
import DocViewerClient from "./DocViewerClient";
import styles from "./md-theme.module.css";

export default async function Page() {
  const mdPath = path.join(process.cwd(), "src", "lib", "docs", "userguide.md");
  let content = await fs.readFile(mdPath, "utf8");

  // normalize common path links used in the doc
  content = content
    .replace(/\]\(\.\/screenshots\//g, "](/img/screenshots/")
    .replace(/\]\(screenshots\//g, "](/img/screenshots/")
    .replace(/\]\(\.\/screenshot\//g, "](/img/screenshots/")
    .replace(/\]\(\/screenshots\//g, "](/img/screenshots/")
    .replace(/\/public\/img\//g, "/img/")
    .replace(
      /\/?public\/img\/voicelibre4\.svg/g,
      "/img/screenshots/voicelibre4.svg",
    );

  // strip surrounding fenced code markers if file starts/ends with them (unchanged behavior)
  if (content.startsWith("```")) {
    content = content.replace(/^```.*\n/, "");
  }
  if (content.trimEnd().endsWith("```")) {
    content = content.replace(/\n```$/, "");
  }

  // --- Sanitization & normalization to avoid weird truncation during render
  // 1) Remove BOM if present
  content = content.replace(/^\uFEFF/, "");

  // 2) Normalize Unicode to NFC (helps combining characters and unusual forms)
  try {
    content = content.normalize("NFC");
  } catch {
    // older Node runtimes won't throw here, but guard anyway
  }

  // 3) Remove problematic control characters (but keep \n, \r, \t)
  content = content.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, "");

  // 4) Defensive: Replace U+FFFD with a question mark so it doesn't silently hide.
  content = content.replace(/\uFFFD/g, "?");

  // --- Keep Languages as a single inline paragraph (no bullets), but give the browser explicit break opportunities after commas.
  // Insert a ZERO-WIDTH SPACE (U+200B) after every comma+space in the Languages supported section only.
  try {
    content = content.replace(
      /(##\s*Languages supported\s*\n)([\s\S]*?)(?=\n##\s+|\n---|\z)/i,
      (_match, heading: string, body: string) => {
        // Only insert break opportunity after comma-space sequences.
        // Do not change to bullets.
        const fixed = body.replace(/, /g, ",\u200B ");
        return heading + fixed;
      },
    );
  } catch (err) {
    // don't crash page render; fall back to original content
    console.error("Failed to apply languages inline-break fix:", err);
  }

  return (
    <div className={styles.mdTheme}>
      <DocViewerClient content={content} />
    </div>
  );
}
