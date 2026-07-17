// ─── Book Engine: Export Service ─────────────────────────────────────────────
import { markdownToDocxBuffer } from "@/server/services/document-render-docx";
import { getBook, getSpine, listPages } from "@/server/services/book";
import type { Page, Block } from "@gezy/sdk";

/**
 * Build a Markdown representation of the entire book.
 */
export async function buildBookMarkdown(bookId: string): Promise<string> {
  const book = await getBook(bookId);
  const spine = await getSpine(bookId);
  const pages = await listPages(bookId);

  if (!book || !spine) {
    throw new Error("Book or spine not found");
  }

  let md = `---\ntitle: "${book.title}"\n`;
  md += `description: "${book.description || ""}"\n`;
  md += `language: ${book.language}\n`;
  md += `chapters: ${book.chapterCount}\n`;
  md += `---\n\n`;
  md += `# ${book.title}\n\n`;
  if (book.description) {
    md += `${book.description}\n\n`;
  }

  for (const chapter of spine.chapters) {
    md += `# ${chapter.title}\n\n`;
    if (chapter.learningObjectives?.length) {
      md += `**Learning Objectives:** ${chapter.learningObjectives.join(", ")}\n\n`;
    }

    const chapterPages = pages.filter((p) => p.chapterId === chapter.id);
    for (const page of chapterPages) {
      md += `## ${page.title}\n\n`;
      for (const block of page.blocks) {
        md += renderBlockToMarkdown(block);
      }
    }
  }

  return md;
}

function renderBlockToMarkdown(block: Block): string {
  switch (block.type) {
    case "text":
      return `${block.content.title ? `### ${block.content.title}\n\n` : ""}${block.content.body || ""}\n\n`;
    case "callout":
      return `> **${block.content.type || "Note"}:** ${block.content.body}\n\n`;
    case "quiz": {
      const questions =
        (block.content.questions as Array<{
          question: string;
          options?: string[];
          correct_answer: string;
          explanation?: string;
        }>) || [];
      let quiz = `### Quiz\n\n`;
      for (const q of questions) {
        quiz += `**Q:** ${q.question}\n\n`;
        if (q.options) {
          for (const opt of q.options) {
            const isCorrect =
              opt.toLowerCase().trim() ===
              q.correct_answer.toLowerCase().trim();
            quiz += `- ${opt}${isCorrect ? " ✓" : ""}\n`;
          }
        }
        quiz += `\n**Answer:** ${q.correct_answer}\n\n`;
        if (q.explanation) {
          quiz += `*${q.explanation}*\n\n`;
        }
      }
      return quiz;
    }
    default:
      return `\n\n[${block.type} block]\n\n`;
  }
}

/**
 * Export a book to DOCX.
 */
export async function exportBookToDocx(bookId: string): Promise<Buffer> {
  const md = await buildBookMarkdown(bookId);
  const book = await getBook(bookId);
  return markdownToDocxBuffer(md, book?.title ?? "Book");
}

/**
 * Export a book to Markdown.
 */
export async function exportBookToMarkdown(bookId: string): Promise<string> {
  return buildBookMarkdown(bookId);
}

/**
 * Export a book to PDF via Playwright.
 */
export async function exportBookToPdf(bookId: string): Promise<Buffer> {
  const md = await buildBookMarkdown(bookId);
  const html = `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Book</title>
<style>
body { font-family: Georgia, serif; max-width: 800px; margin: 0 auto; padding: 40px; line-height: 1.6; }
h1, h2, h3 { font-family: Arial, sans-serif; }
blockquote { border-left: 4px solid #ccc; padding-left: 16px; color: #555; }
</style>
</head>
<body>
${md.replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>")}
</body>
</html>
  `;
  // Use Playwright to render PDF
  const { playwrightManager } =
    await import("@/server/services/playwright-manager");
  const browser = await (playwrightManager as any).getBrowser();
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: "networkidle" });
  const pdf = await page.pdf({
    format: "A4",
    margin: { top: "2cm", right: "2cm", bottom: "2cm", left: "2cm" },
  });
  await page.close();
  return Buffer.from(pdf);
}
