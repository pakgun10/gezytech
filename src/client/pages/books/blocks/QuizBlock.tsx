import { useState } from "react";
import { Button } from "@/client/components/ui/button";
import { CheckCircle2, XCircle } from "lucide-react";

interface Question {
  question: string;
  options?: string[];
  correct_answer: string;
  explanation?: string;
}

interface QuizBlockProps {
  content: Record<string, unknown>;
}

export function QuizBlock({ content }: QuizBlockProps) {
  const questions = (content.questions as Question[]) || [];
  const [selected, setSelected] = useState<Record<number, string>>({});
  const [showResults, setShowResults] = useState(false);

  function handleSelect(qIndex: number, option: string) {
    if (showResults) return;
    setSelected((prev) => ({ ...prev, [qIndex]: option }));
  }

  function isCorrect(qIndex: number) {
    return (
      selected[qIndex]?.toLowerCase().trim() ===
      questions[qIndex]!.correct_answer.toLowerCase().trim()
    );
  }

  const score = questions.reduce(
    (acc, _, idx) => acc + (isCorrect(idx) ? 1 : 0),
    0,
  );

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Quiz</h3>
      {questions.map((q, qIndex) => (
        <div key={qIndex} className="rounded-lg border border-border/50 p-4">
          <p className="font-medium">
            {qIndex + 1}. {q.question}
          </p>
          <div className="mt-3 space-y-2">
            {q.options?.map((option, oIndex) => {
              const isSelected = selected[qIndex] === option;
              const showCorrect =
                showResults &&
                option.toLowerCase().trim() ===
                  q.correct_answer.toLowerCase().trim();
              const showWrong = showResults && isSelected && !isCorrect(qIndex);
              return (
                <button
                  key={oIndex}
                  onClick={() => handleSelect(qIndex, option)}
                  className={`flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                    isSelected
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-muted"
                  } ${showCorrect ? "border-green-500 bg-green-500/10" : ""} ${showWrong ? "border-red-500 bg-red-500/10" : ""}`}
                >
                  <span>{option}</span>
                  {showCorrect && (
                    <CheckCircle2 className="size-4 text-green-500" />
                  )}
                  {showWrong && <XCircle className="size-4 text-red-500" />}
                </button>
              );
            })}
          </div>
          {showResults && q.explanation && (
            <p className="mt-2 text-sm text-muted-foreground">
              {q.explanation}
            </p>
          )}
        </div>
      ))}
      <div className="flex items-center justify-between pt-2">
        {showResults ? (
          <p className="text-sm font-medium">
            Score: {score}/{questions.length}
          </p>
        ) : (
          <span className="text-sm text-muted-foreground">
            {questions.length} questions
          </span>
        )}
        <Button
          onClick={() => setShowResults(!showResults)}
          variant="outline"
          size="sm"
        >
          {showResults ? "Retry" : "Check Answers"}
        </Button>
      </div>
    </div>
  );
}
