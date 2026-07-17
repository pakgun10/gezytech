import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { BookOpen, Plus, Trash2 } from 'lucide-react'
import { useBooks } from '@/client/hooks/useBooks'
import { PageHeader } from '@/client/components/layout/PageHeader'
import { EmptyState } from '@/client/components/common/EmptyState'
import { Button } from '@/client/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/client/components/ui/card'
import { Badge } from '@/client/components/ui/badge'
import { Skeleton } from '@/client/components/ui/skeleton'
import { CreateBookWizard } from './CreateBookWizard'
import type { Book } from '@gezy/sdk'

function BookStatusBadge({ status }: { status: Book['status'] }) {
  const variants: Record<Book['status'], { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
    draft: { label: 'Draft', variant: 'secondary' },
    spine_ready: { label: 'Spine Ready', variant: 'outline' },
    compiling: { label: 'Compiling', variant: 'default' },
    ready: { label: 'Ready', variant: 'default' },
  }
  const { label, variant } = variants[status]
  return <Badge variant={variant}>{label}</Badge>
}

export function BooksPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { books, isLoading, deleteBook } = useBooks()
  const [wizardOpen, setWizardOpen] = useState(false)

  async function handleDelete(e: React.MouseEvent, bookId: string) {
    e.stopPropagation()
    if (!confirm(t('books.deleteConfirm', { defaultValue: 'Delete this book?' }))) return
    await deleteBook(bookId)
  }

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        icon={BookOpen}
        title={t('books.title', { defaultValue: 'Books' })}
        actions={
          <Button onClick={() => setWizardOpen(true)}>
            <Plus className="size-4" />
            {t('books.create', { defaultValue: 'Create Book' })}
          </Button>
        }
      />

      <div className="flex-1 overflow-auto p-4">
        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-40" />
            ))}
          </div>
        ) : books.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            title={t('books.empty.title', { defaultValue: 'No books yet' })}
            description={t('books.empty.description', { defaultValue: 'Create your first AI-generated book from your knowledge bases.' })}
            actionLabel={t('books.empty.action', { defaultValue: 'Create Book' })}
            onAction={() => setWizardOpen(true)}
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {books.map((book) => (
              <Card
                key={book.id}
                className="cursor-pointer transition-shadow hover:shadow-md"
                onClick={() => navigate(`/books/${book.id}`)}
              >
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <CardTitle className="truncate text-base">{book.title}</CardTitle>
                      <CardDescription className="line-clamp-2">
                        {book.description || t('books.noDescription', { defaultValue: 'No description' })}
                      </CardDescription>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => handleDelete(e, book.id)}
                      className="text-muted-foreground hover:text-destructive shrink-0"
                      title={t('common.delete', { defaultValue: 'Delete' })}
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <BookStatusBadge status={book.status} />
                    <span>•</span>
                    <span>{book.chapterCount} {t('books.chapters', { defaultValue: 'chapters' })}</span>
                    <span>•</span>
                    <span>{book.pageCount} {t('books.pages', { defaultValue: 'pages' })}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {wizardOpen && <CreateBookWizard open={wizardOpen} onOpenChange={setWizardOpen} />}
    </div>
  )
}
