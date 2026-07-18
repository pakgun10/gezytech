import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Loader2, Sparkles, ArrowRight, ArrowLeft } from "lucide-react";
import { useBooks } from "@/client/hooks/useBooks";
import { Button } from "@/client/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/client/components/ui/dialog";
import { Textarea } from "@/client/components/ui/textarea";
import { Label } from "@/client/components/ui/label";
import { Progress } from "@/client/components/ui/progress";
import { toast } from "sonner";
import type { BookProposal } from "@gezy/sdk";

interface CreateBookWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type WizardStep = "intent" | "proposal" | "compiling";

export function CreateBookWizard({
  open,
  onOpenChange,
}: CreateBookWizardProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { createBook } = useBooks();

  const [step, setStep] = useState<WizardStep>("intent");
  const [userIntent, setUserIntent] = useState("");
  const [language, setLanguage] = useState("en");
  const [proposal, setProposal] = useState<BookProposal | null>(null);
  const [bookId, setBookId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [progress, setProgress] = useState(0);

  async function handleGenerateProposal() {
    if (!userIntent.trim() || userIntent.length < 10) {
      toast.error(
        t("books.wizard.intentTooShort", {
          defaultValue: "Please describe your book in at least 10 characters.",
        }),
      );
      return;
    }
    setIsSubmitting(true);
    try {
      const data = await createBook({
        userIntent,
        knowledgeBaseIds: [],
        language,
      });
      setBookId(data.bookId);
      setProposal(data.proposal);
      setStep("proposal");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error(t("books.wizard.ideationError", { defaultValue: message }));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleGenerateSpine() {
    if (!bookId) return;
    setIsSubmitting(true);
    setStep("compiling");
    try {
      const res = await fetch(`/api/books/${bookId}/spine`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Spine generation failed");
      await fetch(`/api/books/${bookId}/compile`, {
        method: "POST",
        credentials: "include",
      });
      pollForCompletion(bookId);
    } catch (err) {
      toast.error(
        t("books.wizard.spineError", {
          defaultValue: "Failed to generate spine.",
        }),
      );
      setStep("proposal");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function pollForCompletion(id: string) {
    let attempts = 0;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/books/${id}`, { credentials: "include" });
        const data = await res.json();
        if (data.book?.status === "ready") {
          clearInterval(interval);
          onOpenChange(false);
          navigate(`/books/${id}`);
        } else if (data.book?.status === "compiling") {
          setProgress(Math.min(90, attempts * 5));
        }
        attempts++;
        if (attempts > 60) {
          clearInterval(interval);
          toast.error(
            t("books.wizard.compileTimeout", {
              defaultValue: "Compilation is taking longer than expected.",
            }),
          );
        }
      } catch {
        clearInterval(interval);
      }
    }, 2000);
  }

  function handleClose() {
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent size="2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-5 text-primary" />
            {t("books.wizard.title", { defaultValue: "Create a New Book" })}
          </DialogTitle>
          <DialogDescription>
            {step === "intent" &&
              t("books.wizard.intentDescription", {
                defaultValue: "Describe the book you want to create.",
              })}
            {step === "proposal" &&
              t("books.wizard.proposalDescription", {
                defaultValue: "Review the AI-generated proposal.",
              })}
            {step === "compiling" &&
              t("books.wizard.compilingDescription", {
                defaultValue: "Generating your book...",
              })}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {step === "intent" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>
                  {t("books.wizard.intentLabel", {
                    defaultValue: "What book do you want to create?",
                  })}
                </Label>
                <Textarea
                  value={userIntent}
                  onChange={(e) => setUserIntent(e.target.value)}
                  placeholder={t("books.wizard.intentPlaceholder", {
                    defaultValue:
                      "e.g., A complete Mathematics textbook for Grade 7 SMP aligned with the national curriculum...",
                  })}
                  rows={5}
                />
              </div>
              <div className="space-y-2">
                <Label>
                  {t("books.wizard.languageLabel", {
                    defaultValue: "Language",
                  })}
                </Label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="en">English</option>
                  <option value="id">Bahasa Indonesia</option>
                </select>
              </div>
            </div>
          )}

          {step === "proposal" && proposal && (
            <div className="space-y-4">
              <div className="rounded-lg border bg-muted/50 p-4">
                <h3 className="font-semibold">{proposal.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {proposal.description}
                </p>
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <span className="rounded bg-background px-2 py-1">
                    {proposal.targetLevel}
                  </span>
                  <span className="rounded bg-background px-2 py-1">
                    {proposal.estimatedChapters} chapters
                  </span>
                </div>
                <p className="mt-3 text-sm">{proposal.rationale}</p>
              </div>
            </div>
          )}

          {step === "compiling" && (
            <div className="space-y-4 py-8 text-center">
              <Loader2 className="mx-auto size-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">
                {t("books.wizard.compilingText", {
                  defaultValue:
                    "This may take a few minutes. You can close this dialog and check the book later.",
                })}
              </p>
              <Progress value={progress} />
            </div>
          )}
        </div>

        <DialogFooter>
          {step === "intent" && (
            <Button onClick={handleGenerateProposal} disabled={isSubmitting}>
              {isSubmitting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <ArrowRight className="size-4" />
              )}
              {t("books.wizard.generateProposal", {
                defaultValue: "Generate Proposal",
              })}
            </Button>
          )}
          {step === "proposal" && (
            <>
              <Button variant="outline" onClick={() => setStep("intent")}>
                <ArrowLeft className="size-4" />
                {t("common.back", { defaultValue: "Back" })}
              </Button>
              <Button onClick={handleGenerateSpine} disabled={isSubmitting}>
                {isSubmitting ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <ArrowRight className="size-4" />
                )}
                {t("books.wizard.createBook", { defaultValue: "Create Book" })}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
