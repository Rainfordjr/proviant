import { readFileSync } from "node:fs";
import { join } from "node:path";
import { marked } from "marked";

type TocEntry = { level: number; text: string; id: string };

function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/<[^>]*>/g, "")
    .replace(/[`*_~]/g, "")
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-");
}

function buildToc(markdown: string): TocEntry[] {
  const entries: TocEntry[] = [];
  const seen = new Map<string, number>();
  let inFence = false;

  for (const line of markdown.split("\n")) {
    if (line.startsWith("```")) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const m = line.match(/^(#{2,4})\s+(.+?)\s*$/);
    if (!m) continue;

    const level = m[1].length;
    const text = m[2].trim();
    let id = slugify(text);
    const count = seen.get(id) ?? 0;
    seen.set(id, count + 1);
    if (count > 0) id = `${id}-${count}`;
    entries.push({ level, text, id });
  }
  return entries;
}

function addHeadingIds(html: string, entries: TocEntry[]): string {
  let cursor = 0;
  return html.replace(/<h([2-4])>([\s\S]*?)<\/h\1>/g, (match, level) => {
    const entry = entries[cursor++];
    if (!entry || entry.level !== Number(level)) return match;
    return match.replace(/^<h(\d)>/, `<h$1 id="${entry.id}">`);
  });
}

export default async function ApiDocsPage() {
  const filePath = join(process.cwd(), "docs", "API.md");
  const markdown = readFileSync(filePath, "utf8");
  const toc = buildToc(markdown);
  const rawHtml = await marked.parse(markdown, { gfm: true });
  const html = addHeadingIds(rawHtml as string, toc);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">API Reference</h1>
        <p className="text-sm text-gray-400">
          Complete reference for the Proviant HTTP API. Sourced from{" "}
          <code className="rounded bg-gray-800 px-1.5 py-0.5 text-xs text-gray-300">
            docs/API.md
          </code>
          .
        </p>
      </div>

      <div className="flex gap-6">
        <article
          className="prose prose-slate min-w-0 max-w-none flex-1 rounded-xl border border-gray-200 bg-white p-8 shadow-sm
            prose-headings:scroll-mt-24
            prose-pre:bg-gray-900 prose-pre:text-gray-100
            prose-code:before:content-none prose-code:after:content-none
            prose-code:rounded prose-code:bg-gray-100 prose-code:px-1.5 prose-code:py-0.5
            prose-code:text-[0.85em] prose-code:font-medium prose-code:text-gray-800
            prose-pre:prose-code:bg-transparent prose-pre:prose-code:text-gray-100
            prose-pre:prose-code:p-0 prose-a:text-blue-600 hover:prose-a:text-blue-700
            prose-table:text-sm prose-th:bg-gray-50 prose-th:text-gray-700"
          dangerouslySetInnerHTML={{ __html: html }}
        />

        <aside className="hidden w-64 shrink-0 lg:block">
          <nav className="sticky top-6 max-h-[calc(100vh-3rem)] overflow-y-auto rounded-xl border border-gray-800 bg-gray-900 p-4 text-sm">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
              On this page
            </p>
            <ul className="space-y-1">
              {toc.map((entry) => (
                <li
                  key={entry.id}
                  style={{ paddingLeft: `${(entry.level - 2) * 12}px` }}
                >
                  <a
                    href={`#${entry.id}`}
                    className={
                      entry.level === 2
                        ? "block py-1 font-semibold text-gray-200 hover:text-white"
                        : entry.level === 3
                        ? "block py-0.5 text-gray-400 hover:text-gray-100"
                        : "block py-0.5 text-xs text-gray-500 hover:text-gray-300"
                    }
                  >
                    {entry.text}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </aside>
      </div>
    </div>
  );
}
