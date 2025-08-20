"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import ReactMarkdown from "react-markdown";
import { useRouter } from "next/navigation";
import { HeaderBar } from "../../components/HeaderBar";
import { useTheme } from "../../lib/theme-provider";
import type { Components } from "react-markdown";
import styles from "./md-theme.module.css";

type Section = { title: string; body: string };

export default function DocViewerClient({ content }: { content: string }) {
  const router = useRouter();
  // keep the theme hook for other logic if needed, but we will NOT use it to toggle dark mode
  const { theme } = useTheme();

  // mobile --vh fix
  useEffect(() => {
    const setVh = () => {
      if (typeof window !== "undefined") {
        document.documentElement.style.setProperty(
          "--vh",
          `${window.innerHeight * 0.01}px`,
        );
      }
    };
    setVh();
    window.addEventListener("resize", setVh);
    window.addEventListener("orientationchange", setVh);
    return () => {
      window.removeEventListener("resize", setVh);
      window.removeEventListener("orientationchange", setVh);
    };
  }, []);

  // Parse markdown into sections by "## Heading" and merge any prefix into first section.
  const sections: Section[] = useMemo(() => {
    if (!content) return [];

    const md = content.replace(/\r\n/g, "\n");
    const regex = /^\s*##\s+([^\n]+)\n([\s\S]*?)(?=^\s*##\s+|\z)/gm;
    const matches = Array.from(md.matchAll(regex));

    const found: Section[] = [];
    for (const m of matches) {
      const titleRaw = m[1];
      if (!titleRaw) continue;
      const title = String(titleRaw).trim();
      const body = String(m[2] ?? "").trim();
      found.push({ title, body });
    }

    if (found.length > 0) {
      const firstMatchIndex = md.search(/^\s*##\s+/m);
      if (firstMatchIndex > 0) {
        const prefix = md.slice(0, firstMatchIndex).trim();
        if (prefix) {
          const first = found[0];
          if (first) first.body = `${prefix}\n\n${first.body}`.trim();
        }
      }
      return found.filter((s) => s.title.length > 0);
    }

    return [{ title: "Overview", body: md.trim() }];
  }, [content]);

  // Accordion / measurement state
  const [openIndex, setOpenIndex] = useState<number>(0);

  // measure inner content element heights (used for optional animations / measuring)
  const innerContentRefs = useRef<Array<HTMLDivElement | null>>([]);

  const recalcHeights = () => {
    // Only recalculate layout, no heights state
    // (kept for compatibility if needed elsewhere)
  };

  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      recalcHeights();
      setTimeout(recalcHeights, 120);
    });
    const onResize = () => recalcHeights();
    window.addEventListener("resize", onResize);
    window.addEventListener("load", onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("load", onResize);
    };
  }, [sections.length]);

  useEffect(() => {
    setOpenIndex(0);
    innerContentRefs.current = [];
    setTimeout(recalcHeights, 80);
  }, [content]);

  // Toggle open/close. When opening, scroll the inner content into view so the
  // visible content isn't hidden under the fixed header.
  const toggle = (i: number) => {
    setOpenIndex((prev) => {
      const next = prev === i ? -1 : i;

      if (next === i) {
        setTimeout(() => {
          const inner = innerContentRefs.current[i];
          if (!inner || typeof window === "undefined") return;

          const headerEl = document.querySelector("header");
          const headerHeight = headerEl?.clientHeight ?? 64;

          const rect = inner.getBoundingClientRect();
          const scrollTop = window.scrollY || window.pageYOffset;
          const target = Math.max(0, scrollTop + rect.top - headerHeight - 12);
          window.scrollTo({ top: target, behavior: "smooth" });
        }, 160);
      }

      setTimeout(recalcHeights, 220);
      return next;
    });
  };

  //
  // Markdown renderers (typed)
  //

  const H1 = (props: React.ComponentPropsWithoutRef<"h1">) => (
    <h1 className="mt-6 mb-4 text-3xl font-extrabold text-gray-900" {...props}>
      {props.children}
    </h1>
  );

  const H2 = (props: React.ComponentPropsWithoutRef<"h2">) => (
    <h2 className="mt-6 mb-3 text-2xl font-semibold text-gray-900" {...props}>
      {props.children}
    </h2>
  );

  const H3 = (props: React.ComponentPropsWithoutRef<"h3">) => (
    <h3 className="mt-5 mb-2 text-xl font-semibold text-gray-900" {...props}>
      {props.children}
    </h3>
  );

  const P = (props: React.ComponentPropsWithoutRef<"p">) => (
    <p className="mb-3 leading-7 text-gray-700" {...props}>
      {props.children}
    </p>
  );

  const Ul = (props: React.ComponentPropsWithoutRef<"ul">) => (
    <ul className="mb-3 ml-6 list-outside list-disc" {...props}>
      {props.children}
    </ul>
  );

  const Ol = (props: React.ComponentPropsWithoutRef<"ol">) => (
    <ol className="mb-3 ml-6 list-outside list-decimal" {...props}>
      {props.children}
    </ol>
  );

  const Li = (props: React.ComponentPropsWithoutRef<"li">) => (
    <li className="mb-2" {...props} />
  );

  const Blockquote = (props: React.ComponentPropsWithoutRef<"blockquote">) => (
    <blockquote
      className="my-4 border-l-4 border-gray-300 pl-4 text-gray-600 italic"
      {...props}
    >
      {props.children}
    </blockquote>
  );

  const Hr = () => <hr className="my-6 border-gray-300" />;

  const Img = (props: React.ComponentPropsWithoutRef<"img">) => {
    // Always use next/image for markdown images, fallback to <img> only if src is missing
    const { src, alt, onLoad } = props;
    const handleLoad: React.ReactEventHandler<HTMLImageElement> = (e) => {
      if (typeof onLoad === "function") {
        (onLoad as (e: React.SyntheticEvent<HTMLImageElement>) => void)(e);
      }
      setTimeout(recalcHeights, 40);
    };

    if (typeof src === "string" && src.length > 0) {
      return (
        <Image
          src={src}
          alt={typeof alt === "string" ? alt : ""}
          width={300}
          height={200}
          className={`${props.className ?? ""} mx-auto block h-auto w-full max-w-[300px] rounded shadow`}
          draggable={false}
          onLoad={handleLoad}
          style={{ objectFit: "contain" }}
        />
      );
    }

    // If no src, do not render an image
    return null;
  };

  const Anchor = (props: React.ComponentPropsWithoutRef<"a">) => (
    <a
      {...props}
      target={props.target ?? "_blank"}
      rel="noopener noreferrer"
      className={`${props.className ?? ""} break-words text-blue-600 hover:underline`}
    >
      {props.children}
    </a>
  );

  const CodeBlock = (props: {
    inline?: boolean;
    children?: React.ReactNode;
    className?: string;
  }) => {
    const { inline, children } = props;
    if (inline) {
      return (
        <code className="rounded bg-gray-100 px-1 text-sm">{children}</code>
      );
    }
    const text = React.Children.toArray(children ?? [])
      .map((c) =>
        typeof c === "string" || typeof c === "number" ? String(c) : "",
      )
      .join("");
    return (
      <pre className="my-4 overflow-auto rounded bg-gray-100 p-3 text-gray-900">
        <code>{text.replace(/\n$/, "")}</code>
      </pre>
    );
  };

  const TableWrapper = (props: React.ComponentPropsWithoutRef<"table">) => (
    <div className="overflow-auto">
      <table className="mb-4 min-w-full border-collapse" {...props}>
        {props.children}
      </table>
    </div>
  );

  const Thead = (props: React.ComponentPropsWithoutRef<"thead">) => (
    <thead className="bg-gray-100" {...props} />
  );
  const Th = (props: React.ComponentPropsWithoutRef<"th">) => (
    <th className="border px-3 py-2 text-left font-semibold" {...props} />
  );
  const Td = (props: React.ComponentPropsWithoutRef<"td">) => (
    <td className="border px-3 py-2" {...props} />
  );

  const components: Components = {
    h1: H1,
    h2: H2,
    h3: H3,
    p: P,
    ul: Ul,
    ol: Ol,
    li: Li,
    blockquote: Blockquote,
    hr: Hr,
    img: Img,
    a: Anchor,
    code: CodeBlock as unknown as Components["code"],
    table: TableWrapper as unknown as Components["table"],
    thead: Thead as unknown as Components["thead"],
    th: Th as unknown as Components["th"],
    td: Td as unknown as Components["td"],
  };

  return (
    // NOTE: intentionally NOT applying a "dark" class here — doc viewer will always render in light
    <div>
      <div style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 60 }}>
        <HeaderBar
          activeView="chat"
          onNav={(view) => router.push(view === "chat" ? "/" : "/transcripts")}
        />
      </div>

      <main
        className="flex h-[calc(var(--vh,1vh)*100-64px)] flex-col"
        style={{ padding: 24, maxWidth: 980, margin: "0 auto", marginTop: 64 }}
      >
        <div className="mb-6 flex flex-col items-center">
          <Image
            src={
              theme === "dark"
                ? "/img/voicelibre4-dark.svg"
                : "/img/voicelibre4.svg"
            }
            alt="VoiceLibre Logo"
            width={64}
            height={64}
            className="mb-2 h-16 w-auto"
            priority
          />
          <h1 className="mb-2 text-3xl font-extrabold text-gray-900">
            User Guide
          </h1>
        </div>

        {/* force the markdown card to light look via CSS module (see md-theme.module.css) */}
        <article
          className={`${styles.mdThemeBody} markdown-body max-w-none rounded-lg p-4 shadow`}
        >
          <div className="divide-y rounded">
            {sections.map((sec, i) => {
              const isOpen = openIndex === i;

              return (
                <section key={i} className="py-2">
                  <button
                    type="button"
                    onClick={() => toggle(i)}
                    aria-expanded={isOpen}
                    className="flex w-full items-center justify-between py-3 text-left"
                  >
                    <span className="text-lg font-semibold text-gray-900">
                      {sec.title}
                    </span>
                    <svg
                      className={`h-5 w-5 transform transition-transform duration-200 ${isOpen ? "rotate-180" : "rotate-0"} text-gray-600`}
                      viewBox="0 0 20 20"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                      aria-hidden
                    >
                      <path
                        d="M5 8l5 5 5-5"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>

                  {/* IMPORTANT: don't set a numeric maxHeight when open; let the content flow.
                      When closed we keep maxHeight: 0 to hide. We still apply a transition, but
                      browsers cannot animate from 0->auto; that's acceptable — avoids clipping. */}
                  <div
                    className={
                      isOpen
                        ? "overflow-visible transition-[max-height] duration-300"
                        : "overflow-hidden transition-[max-height] duration-300"
                    }
                    style={{ maxHeight: isOpen ? undefined : "0px" }}
                    aria-hidden={!isOpen}
                  >
                    <div
                      ref={(el: HTMLDivElement | null) => {
                        innerContentRefs.current[i] = el;
                      }}
                      className="pt-2 pb-3"
                    >
                      <ReactMarkdown components={components}>
                        {sec.body}
                      </ReactMarkdown>
                    </div>
                  </div>
                </section>
              );
            })}
          </div>
        </article>
      </main>
    </div>
  );
}
