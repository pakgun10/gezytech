import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useParams, useNavigate } from "react-router-dom";
import { BookOpen, ChevronLeft, ChevronRight, Download } from "lucide-react";
import {
  useBook,
  useBookSpine,
  useBookPages,
  useBookSSE,
} from "@/client/hooks/useBooks";
import { PageHeader } from "@/client/components/layout/PageHeader";
import { Button } from "@/client/components/ui/button";
import { ScrollArea } from "@/client/components/ui/scroll-area";
import { Skeleton } from "@/client/components/ui/skeleton";
import { TextBlock } from "./blocks/TextBlock";
import { QuizBlock } from "./blocks/QuizBlock";
import { CalloutBlock } from "./blocks/CalloutBlock";
import type { Page, Block } from "@gezy/sdk";

function BlockRenderer({ block }: { block: Block }) {
  switch (block.type) {
    case "text":
      return <TextBlock content={block.content} />;
    case "quiz":
      return <QuizBlock content={block.content} />;
    case "callout":
      return <CalloutBlock content={block.content} />;
    default:
      return (
        <div className="text-sm text-muted-foreground">
          Unsupported block: {block.type}
        </div>
      );
  }
}

export function BookReader() {
  const { t } = useTranslation();
  const { bookId } = useParams<{ bookId: string }>();
  const navigate = useNavigate();
  const { book, isLoading: bookLoading } = useBook(bookId || null);
  const { spine, isLoading: spineLoading } = useBookSpine(bookId || null);
  const {
    pages,
    isLoading: pagesLoading,
    refetch: refetchPages,
  } = useBookPages(bookId || null);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);

  useBookSSE(bookId || null, (event) => {
    if (event.type === "page_ready" || event.type === "book_ready") {
      void refetchPages();
    }
  });

  useEffect(() => {
    setCurrentPageIndex(0);
  }, [bookId]);

  const currentPage = pages[currentPageIndex];
  const hasPrev = currentPageIndex > 0;
  const hasNext = currentPageIndex < pages.length - 1;

  if (bookLoading || spineLoading || pagesLoading) {
    return (
      <div className="flex h-full flex-col">
        <PageHeader
          icon={BookOpen}
          title={t("books.loading", { defaultValue: "Loading book..." })}
        />
        <div className="flex-1 p-4">
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  if (!book || !spine || !currentPage) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-4 text-center">
        <BookOpen className="size-12 text-muted-foreground" />
        <p className="mt-4 text-muted-foreground">
          {t("books.notFound", { defaultValue: "Book not found" })}
        </p>
        <Button className="mt-4" onClick={() => navigate("/books")}>
          {t("books.backToLibrary", { defaultValue: "Back to Library" })}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        icon={BookOpen}
        title={book.title}
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                window.open(`/api/books/${bookId}/export/markdown`, "_blank")
              }
            >
              <Download className="size-4" />
              {t("books.exportMarkdown", { defaultValue: "Markdown" })}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                window.open(`/api/books/${bookId}/export/docx`, "_blank")
              }
            >
              <Download className="size-4" />
              {t("books.exportDocx", { defaultValue: "DOCX" })}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                window.open(`/api/books/${bookId}/export/pdf`, "_blank")
              }
            >
              <Download className="size-4" />
              {t("books.exportPdf", { defaultValue: "PDF" })}
            </Button>
          </>
        }
      />

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar TOC */}
        <aside className="hidden w-64 shrink-0 border-r border-border bg-background p-4 lg:block">
          <h3 className="mb-3 text-sm font-semibold">
            {t("books.tableOfContents", { defaultValue: "Table of Contents" })}
          </h3>
          <ScrollArea className="h-[calc(100%-2rem)]">
            <nav className="space-y-1">
              {spine.chapters.map((chapter, idx) => {
                const page = pages.find((p) => p.chapterId === chapter.id);
                const pageIndex = page
                  ? pages.findIndex((p) => p.id === page.id)
                  : -1;
                const isActive = pageIndex === currentPageIndex;
                return (
                  <button
                    key={chapter.id}
                    onClick={() =>
                      pageIndex >= 0 && setCurrentPageIndex(pageIndex)
                    }
                    className={`w-full rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
                      isActive
                        ? "bg-primary/10 font-medium text-primary"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    {chapter.order + 1}. {chapter.title}
                  </button>
                );
              })}
            </nav>
          </ScrollArea>
        </aside>

        {/* Main content */}
        <main className="flex min-w-0 flex-1 flex-col">
          <ScrollArea className="flex-1 p-4 md:p-8">
            <div className="mx-auto max-w-3xl">
              <h1 className="mb-6 text-2xl font-bold">{currentPage.title}</h1>
              <div className="space-y-6">
                {currentPage.blocks.map((block) => (
                  <div
                    key={block.id}
                    className="rounded-lg border border-border/50 p-4"
                  >
                    <BlockRenderer block={block} />
                  </div>
                ))}
              </div>
            </div>
          </ScrollArea>

          {/* Navigation */}
          <div className="flex items-center justify-between border-t border-border p-4">
            <Button
              variant="outline"
              onClick={() => setCurrentPageIndex((i) => i - 1)}
              disabled={!hasPrev}
            >
              <ChevronLeft className="size-4" />
              {t("books.previous", { defaultValue: "Previous" })}
            </Button>
            <span className="text-sm text-muted-foreground">
              {currentPageIndex + 1} / {pages.length}
            </span>
            <Button
              variant="outline"
              onClick={() => setCurrentPageIndex((i) => i + 1)}
              disabled={!hasNext}
            >
              {t("books.next", { defaultValue: "Next" })}
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </main>
      </div>
    </div>
  );
}
