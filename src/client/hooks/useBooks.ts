import { useState, useEffect, useCallback } from 'react'
import { api } from '@/client/lib/api'
import type { Book, BookProposal, Spine, Page } from '@gezy/sdk'

export interface CreateBookInput {
  userIntent: string
  knowledgeBaseIds?: string[]
  language?: string
}

export function useBooks() {
  const [books, setBooks] = useState<Book[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const refetch = useCallback(async () => {
    setIsLoading(true)
    try {
      const data = await api.get<{ books: Book[] }>('/books')
      setBooks(data.books)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    refetch()
  }, [refetch])

  const createBook = useCallback(async (input: CreateBookInput): Promise<{ bookId: string; proposal: BookProposal }> => {
    const data = await api.post<{ bookId: string; proposal: BookProposal }>('/books', input)
    await refetch()
    return data
  }, [refetch])

  const deleteBook = useCallback(async (bookId: string) => {
    await api.delete(`/books/${bookId}`)
    setBooks((prev) => prev.filter((b) => b.id !== bookId))
  }, [])

  return { books, isLoading, refetch, createBook, deleteBook }
}

export function useBook(bookId: string | null) {
  const [book, setBook] = useState<Book | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const refetch = useCallback(async () => {
    if (!bookId) return
    setIsLoading(true)
    try {
      const data = await api.get<{ book: Book }>(`/books/${bookId}`)
      setBook(data.book)
    } finally {
      setIsLoading(false)
    }
  }, [bookId])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { book, isLoading, refetch }
}

export function useBookSpine(bookId: string | null) {
  const [spine, setSpine] = useState<Spine | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const generateSpine = useCallback(async (): Promise<Spine | null> => {
    if (!bookId) return null
    setIsLoading(true)
    try {
      const data = await api.post<{ spine: Spine }>(`/books/${bookId}/spine`, {})
      setSpine(data.spine)
      return data.spine
    } finally {
      setIsLoading(false)
    }
  }, [bookId])

  const refetch = useCallback(async () => {
    if (!bookId) return
    setIsLoading(true)
    try {
      const data = await api.get<{ spine: Spine }>(`/books/${bookId}/spine`)
      setSpine(data.spine)
    } finally {
      setIsLoading(false)
    }
  }, [bookId])

  return { spine, isLoading, generateSpine, refetch }
}

export function useBookPages(bookId: string | null) {
  const [pages, setPages] = useState<Page[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const refetch = useCallback(async () => {
    if (!bookId) return
    setIsLoading(true)
    try {
      const data = await api.get<{ pages: Page[] }>(`/books/${bookId}/pages`)
      setPages(data.pages)
    } finally {
      setIsLoading(false)
    }
  }, [bookId])

  const compileBook = useCallback(async () => {
    if (!bookId) return
    await api.post(`/books/${bookId}/compile`, {})
  }, [bookId])

  const compilePage = useCallback(async (pageId: string) => {
    if (!bookId) return
    await api.post(`/books/${bookId}/pages/${pageId}/compile`, {})
  }, [bookId])

  return { pages, isLoading, refetch, compileBook, compilePage }
}

export function useBookSSE(bookId: string | null, onEvent?: (event: { type: string; payload: Record<string, unknown> }) => void) {
  useEffect(() => {
    if (!bookId) return

    const eventSource = new EventSource(`/api/books/${bookId}/stream`)

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        onEvent?.(data)
      } catch {
        // ignore non-JSON messages
      }
    }

    eventSource.onerror = () => {
      eventSource.close()
    }

    return () => {
      eventSource.close()
    }
  }, [bookId, onEvent])
}
