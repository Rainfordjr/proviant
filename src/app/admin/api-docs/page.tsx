import { readFileSync } from "node:fs";
import { join } from "node:path";
import { marked } from "marked";

export default async function ApiDocsPage() {
  const filePath = join(process.cwd(), "docs", "API.md");
  const markdown = readFileSync(filePath, "utf8");
  const html = await marked.parse(markdown, { gfm: true });

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

      <article
        className="prose prose-slate max-w-none rounded-xl border border-gray-200 bg-white p-8 shadow-sm
          prose-headings:scroll-mt-20
          prose-pre:bg-gray-900 prose-pre:text-gray-100
          prose-code:before:content-none prose-code:after:content-none
          prose-code:rounded prose-code:bg-gray-100 prose-code:px-1.5 prose-code:py-0.5
          prose-code:text-[0.85em] prose-code:font-medium prose-code:text-gray-800
          prose-pre:prose-code:bg-transparent prose-pre:prose-code:text-gray-100
          prose-pre:prose-code:p-0 prose-a:text-blue-600 hover:prose-a:text-blue-700"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
