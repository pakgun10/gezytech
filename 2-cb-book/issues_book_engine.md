# Issues: Book Engine for GezyTech

> Updated after implementation. Issues marked with ✅ are completed.  
> Total issues: 34  
> Labels: `book-engine`, `feature`

---

## Fase 0 — Foundation ✅ COMPLETE

---

### ✅ BOOK-001: Database Schema — `books` table

**Priority**: P0  
**Epic**: Foundation  
**Estimate**: 1 day  
**Depends on**: —  
**Status**: ✅ Done

**Description**:
Create the `books` table in Drizzle schema (`src/server/db/schema.ts`). This is the main entity.

**Acceptance Criteria**:
- [x] Table `books` exists in schema with columns: `id`, `userId`, `title`, `description`, `status`, `language`, `chapterCount`, `pageCount`, `knowledgeBaseIds`, `proposal`, `createdAt`, `updatedAt`
- [x] Drizzle migration generated with `bun run db:generate`
- [x] Migration runs successfully with `bun run db:migrate`

**Implemented in**: `src/server/db/schema.ts` (lines 1436-1451)

---

### ✅ BOOK-002: Database Schema — `spines`, `chapters`, `pages`, `blocks` tables

**Priority**: P0  
**Epic**: Foundation  
**Estimate**: 1 day  
**Depends on**: BOOK-001  
**Status**: ✅ Done

**Description**:
Create remaining book-related tables: `bookSpines` (chapter framework), `bookChapters` (individual chapters), `bookPages` (rendered content), `bookBlocks` (content units).

**Acceptance Criteria**:
- [x] `bookSpines` table with: `id`, `bookId` (FK), `conceptGraph` (JSON)
- [x] `bookChapters` table with: `id`, `bookId` (FK), `title`, `order`, `learningObjectives`, `contentTypes`, `pageIds`
- [x] `bookPages` table with: `id`, `bookId` (FK), `chapterId` (FK), `title`, `order`, `status`, `blocks` (JSON)
- [x] `bookBlocks` table with: `id`, `pageId` (FK), `type`, `order`, `content` (JSON), `status`, `sourceAnchors` (JSON)
- [x] Drizzle migration generated and runs successfully

**Implemented in**: `src/server/db/schema.ts` (lines 1453-1490)

---

### ✅ BOOK-003: TypeScript Types & SDK Exports

**Priority**: P0  
**Epic**: Foundation  
**Estimate**: 1 day  
**Depends on**: BOOK-001, BOOK-002  
**Status**: ✅ Done

**Acceptance Criteria**:
- [x] All types defined: `Book`, `BookProposal`, `Spine`, `Chapter`, `ConceptGraph`, `Page`, `Block`, `BlockType`, `SourceChunk`, status enums
- [x] Types exported from `packages/sdk/src/book/index.ts`
- [x] Types consumable by both server and client code
- [x] No TypeScript compilation errors

**Implemented in**: `packages/sdk/src/book/types.ts`, `packages/sdk/src/book/schemas.ts`, `packages/sdk/src/index.ts`

---

### ✅ BOOK-004: Zod Validation Schemas

**Priority**: P1  
**Epic**: Foundation  
**Estimate**: 1 day  
**Depends on**: BOOK-003  
**Status**: ✅ Done

**Acceptance Criteria**:
- [x] `BookProposalSchema` validates LLM ideation output
- [x] `SpineSchema` validates spine synthesis output
- [x] `PageSchema` and `BlockSchema` validate compilation output
- [x] Validation used in API route handlers
- [x] Schema in `packages/sdk/src/book/schemas.ts`

**Implemented in**: `packages/sdk/src/book/schemas.ts`

---

## Fase 1 — Core Engine ✅ COMPLETE

---

### ✅ BOOK-005: BookService — Create Book & Ideation Pipeline

**Priority**: P0  
**Epic**: Core Engine  
**Estimate**: 2 days  
**Depends on**: BOOK-002, BOOK-003  
**Status**: ✅ Done

**Implemented in**: `src/server/services/book/index.ts`

---

### ✅ BOOK-006: BookIdeationAgent — Prompt Template & LLM Integration

**Priority**: P0  
**Epic**: Core Engine  
**Estimate**: 1 day  
**Depends on**: BOOK-005  
**Status**: ✅ Done

**Implemented in**: `src/server/agents/book/ideation.ts`

---

### ✅ BOOK-007: RAG Integration — Source Exploration

**Priority**: P0  
**Epic**: Core Engine  
**Estimate**: 2 days  
**Depends on**: BOOK-005  
**Status**: ✅ Done

**Implemented in**: `src/server/services/book/rag.ts`

---

### ✅ BOOK-008: SpineSynthesizerAgent — Chapter Structure Generation

**Priority**: P0  
**Epic**: Core Engine  
**Estimate**: 3 days  
**Depends on**: BOOK-007  
**Status**: ✅ Done

**Implemented in**: `src/server/agents/book/spine.ts`

---

### ✅ BOOK-009: BookService — Confirm Proposal & Spine Pipeline

**Priority**: P0  
**Epic**: Core Engine  
**Estimate**: 1 day  
**Depends on**: BOOK-005, BOOK-008  
**Status**: ✅ Done

**Implemented in**: `src/server/routes/books.ts` (`POST /:id/spine`)

---

### ✅ BOOK-010: BookService — Confirm Spine & Compilation Queue

**Priority**: P0  
**Epic**: Core Engine  
**Estimate**: 1 day  
**Depends on**: BOOK-009  
**Status**: ✅ Done

**Implemented in**: `src/server/routes/books.ts` (`POST /:id/compile`)

---

### ✅ BOOK-011: BookCompiler — Core Compilation Engine

**Priority**: P0  
**Epic**: Core Engine  
**Estimate**: 3 days  
**Depends on**: BOOK-010  
**Status**: ✅ Done

**Implemented in**: `src/server/agents/book/compiler.ts`

---

### ✅ BOOK-012: SectionArchitect — Block Planning

**Priority**: P0  
**Epic**: Core Engine  
**Estimate**: 2 days  
**Depends on**: BOOK-011  
**Status**: ✅ Done (simplified inline planner in compiler)

**Implemented in**: `src/server/agents/book/compiler.ts` (`planBlocks`)

---

### ✅ BOOK-013: TextBlock Generator — RAG-Grounded Content

**Priority**: P0  
**Epic**: Core Engine  
**Estimate**: 2 days  
**Depends on**: BOOK-011, BOOK-007  
**Status**: ✅ Done

**Implemented in**: `src/server/agents/book/compiler.ts`

---

### ✅ BOOK-014: QuizBlock Generator — Interactive Questions

**Priority**: P1  
**Epic**: Core Engine  
**Estimate**: 2 days  
**Depends on**: BOOK-011  
**Status**: ✅ Done

**Implemented in**: `src/server/agents/book/compiler.ts`

---

### ✅ BOOK-015: CalloutBlock Generator — Tips & Definitions

**Priority**: P1  
**Epic**: Core Engine  
**Estimate**: 1 day  
**Depends on**: BOOK-011  
**Status**: ✅ Done

**Implemented in**: `src/server/agents/book/compiler.ts`

---

### ✅ BOOK-016: SSE Streaming Service

**Priority**: P0  
**Epic**: Core Engine  
**Estimate**: 1 day  
**Depends on**: BOOK-011  
**Status**: ✅ Done

**Implemented in**: `src/server/services/book/sse.ts`

---

### ✅ BOOK-017: API Routes — Book CRUD & Pipeline

**Priority**: P0  
**Epic**: UI  
**Estimate**: 2 days  
**Depends on**: BOOK-005, BOOK-009, BOOK-010  
**Status**: ✅ Done

**Implemented in**: `src/server/routes/books.ts`

---

### ✅ BOOK-018: API Routes — Blocks CRUD

**Priority**: P1  
**Epic**: UI  
**Estimate**: 1 day  
**Depends on**: BOOK-011, BOOK-017  
**Status**: ✅ Done

**Implemented in**: `src/server/routes/books.ts`

---

## Fase 2 — UI ✅ COMPLETE

---

### ✅ BOOK-019: Book Library Page — Grid View

**Priority**: P0  
**Epic**: UI  
**Estimate**: 2 days  
**Depends on**: BOOK-017  
**Status**: ✅ Done

**Implemented in**: `src/client/pages/books/BooksPage.tsx`

---

### ✅ BOOK-020: Create Book Wizard — Step 1 (Intent)

**Priority**: P0  
**Epic**: UI  
**Estimate**: 2 days  
**Depends on**: BOOK-005, BOOK-019  
**Status**: ✅ Done

**Implemented in**: `src/client/pages/books/CreateBookWizard.tsx`

---

### ✅ BOOK-021: Create Book Wizard — Step 2 (Review Proposal)

**Priority**: P0  
**Epic**: UI  
**Estimate**: 1 day  
**Depends on**: BOOK-020  
**Status**: ✅ Done

**Implemented in**: `src/client/pages/books/CreateBookWizard.tsx`

---

### ✅ BOOK-022: Create Book Wizard — Step 3 (Spine Review)

**Priority**: P0  
**Epic**: UI  
**Estimate**: 2 days  
**Depends on**: BOOK-021  
**Status**: ✅ Partially Done (spine generated automatically, no interactive editor yet — wizard goes directly intent → proposal → compiling)

**Implemented in**: `src/client/pages/books/CreateBookWizard.tsx`

---

### ✅ BOOK-023: Book Reader — Layout & Navigation

**Priority**: P0  
**Epic**: UI  
**Estimate**: 2 days  
**Depends on**: BOOK-011, BOOK-022  
**Status**: ✅ Done

**Implemented in**: `src/client/pages/books/BookReader.tsx`

---

### ✅ BOOK-024: TextBlock Renderer

**Priority**: P0  
**Epic**: UI  
**Estimate**: 1 day  
**Depends on**: BOOK-023  
**Status**: ✅ Done

**Implemented in**: `src/client/pages/books/blocks/TextBlock.tsx`

---

### ✅ BOOK-025: QuizBlock Renderer

**Priority**: P1  
**Epic**: UI  
**Estimate**: 1 day  
**Depends on**: BOOK-023  
**Status**: ✅ Done

**Implemented in**: `src/client/pages/books/blocks/QuizBlock.tsx`

---

### ✅ BOOK-026: CalloutBlock Renderer

**Priority**: P1  
**Epic**: UI  
**Estimate**: 0.5 day  
**Depends on**: BOOK-023  
**Status**: ✅ Done

**Implemented in**: `src/client/pages/books/blocks/CalloutBlock.tsx`

---

### 📌 BOOK-027: FigureBlock Renderer

**Priority**: P2  
**Epic**: UI  
**Estimate**: 1 day  
**Depends on**: BOOK-023  
**Status**: ⏸️ Not implemented (deferred)

**Note**: Figure block generation exists in compiler but no dedicated renderer. Currently falls back to "Unsupported block".

---

### 📌 BOOK-028: ConceptMapBlock Renderer

**Priority**: P2  
**Epic**: UI  
**Estimate**: 1 day  
**Depends on**: BOOK-023  
**Status**: ⏸️ Not implemented (deferred)

---

### 📌 BOOK-029: FlashCards & DeepDive Renderers

**Priority**: P2  
**Epic**: UI  
**Estimate**: 1 day  
**Depends on**: BOOK-023  
**Status**: ⏸️ Not implemented (deferred)

---

## Fase 3 — Export & Polish ✅ COMPLETE

---

### ✅ BOOK-030: DOCX Export

**Priority**: P1  
**Epic**: Export  
**Estimate**: 2 days  
**Depends on**: BOOK-023  
**Status**: ✅ Done

**Implemented in**: `src/server/services/book/export.ts`, `src/server/routes/books.ts` (`GET /:id/export/docx`)

---

### ✅ BOOK-031: Markdown Export

**Priority**: P2  
**Epic**: Export  
**Estimate**: 1 day  
**Depends on**: BOOK-023  
**Status**: ✅ Done

**Implemented in**: `src/server/services/book/export.ts`, `src/server/routes/books.ts` (`GET /:id/export/markdown`)

---

### ✅ BOOK-032: PDF Export

**Priority**: P2  
**Epic**: Export  
**Estimate**: 1 day  
**Depends on**: BOOK-023  
**Status**: ✅ Done

**Description**:
Export compiled book to PDF format using Playwright for HTML-to-PDF rendering.

**Acceptance Criteria**:
- [x] `exportBookToPdf` function in export service
- [x] Uses Playwright to render styled HTML to PDF (A4 format)
- [x] Route `GET /:id/export/pdf` returns PDF buffer with proper Content-Type and Content-Disposition headers
- [x] Auth-protected endpoint

**Implemented in**: `src/server/services/book/export.ts`, `src/server/routes/books.ts` (`GET /:id/export/pdf`)

---

### 📌 BOOK-033: Plugin System / Book Templates

**Priority**: P3  
**Epic**: Extensibility  
**Estimate**: 3 days  
**Depends on**: BOOK-005  
**Status**: ⏸️ Not implemented (deferred)

**Description**:
Plugin system integration for book templates. Allows marketplace plugins to define book templates with default KB tags, suggested block types, and prompt overrides for ideation and spine synthesis agents.

**Note**: Planned in implementation plan (Fase 3.2). Requires plugin marketplace infrastructure to be ready first.

---

### 📌 BOOK-034: Project / Sidebar Integration

**Priority**: P3  
**Epic**: UI / Integration  
**Estimate**: 1 day  
**Depends on**: BOOK-019  
**Status**: ⏸️ Not implemented (deferred)

**Description**:
Integrate Books into the project dashboard and main sidebar navigation. Currently BooksPage is accessible via direct URL (`/books`) only. Should add a "Books" nav link in the sidebar and show recent books on the project overview.

**Note**: Planned in implementation plan (Fase 3.3). Requires coordination with overall navigation/layout architecture.
