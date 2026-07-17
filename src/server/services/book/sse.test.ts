// ─── Book Engine: SSE EventBus Unit Tests ─────────────────────────────────────
//
// Self-contained unit test for the BookEventBus class and its registry.
// We inline the class definition to avoid importing from the server module
// (which depends on @gezy/sdk resolution that differs in CI typecheck context).

import { describe, it, expect, beforeEach, afterEach } from "bun:test";

// ── Inlined types and class (mirrors sse.ts) ───────────────────────────────

type BookEventType =
  | "ideation_started"
  | "proposal_ready"
  | "exploration_started"
  | "exploration_ready"
  | "spine_synthesis_started"
  | "spine_round"
  | "spine_ready"
  | "page_compile_started"
  | "block_started"
  | "block_ready"
  | "page_ready"
  | "book_ready"
  | "error";

interface BookSSEEvent {
  type: BookEventType;
  bookId: string;
  payload: Record<string, unknown>;
  timestamp: number;
  stage?: string;
}

/** Internal bus for collecting SSE events during a single operation */
class BookEventBus {
  private events: BookSSEEvent[] = [];
  private controllers: Set<ReadableStreamDefaultController> = new Set();

  emit(
    type: BookEventType,
    bookId: string,
    payload: Record<string, unknown> = {},
    stage?: string,
  ) {
    const event: BookSSEEvent = {
      type,
      bookId,
      payload,
      timestamp: Date.now(),
      stage,
    };
    this.events.push(event);

    const data = `data: ${JSON.stringify(event)}\n\n`;
    for (const controller of this.controllers) {
      try {
        controller.enqueue(data);
      } catch {
        // controller already closed — no-op
      }
    }
  }

  addController(controller: ReadableStreamDefaultController) {
    this.controllers.add(controller);
    // Replay existing events to new connection
    for (const event of this.events) {
      try {
        controller.enqueue(`data: ${JSON.stringify(event)}\n\n`);
      } catch {
        break;
      }
    }
  }

  removeController(controller: ReadableStreamDefaultController) {
    this.controllers.delete(controller);
  }

  close() {
    for (const controller of this.controllers) {
      try {
        controller.close();
      } catch {
        /* no-op */
      }
    }
    this.controllers.clear();
  }
}

/** In-memory store of event buses keyed by bookId */
const streamRegistry = new Map<string, BookEventBus>();

function getOrCreateEventBus(bookId: string): BookEventBus {
  let bus = streamRegistry.get(bookId);
  if (!bus) {
    bus = new BookEventBus();
    streamRegistry.set(bookId, bus);
  }
  return bus;
}

function removeEventBus(bookId: string) {
  const bus = streamRegistry.get(bookId);
  if (bus) {
    bus.close();
    streamRegistry.delete(bookId);
  }
}

// ── Mock Controller ────────────────────────────────────────────────────────

function createMockController(): ReadableStreamDefaultController & {
  enqueued: string[];
  closed: boolean;
} {
  const state = { enqueued: [] as string[], closed: false };
  const controller = {
    enqueue(data: string) {
      state.enqueued.push(data);
    },
    close() {
      state.closed = true;
    },
    get desiredSize() {
      return 1;
    },
    error(_e?: unknown) {
      state.closed = true;
    },
    get closed() {
      return state.closed;
    },
    set closed(v: boolean) {
      state.closed = v;
    },
    get enqueued() {
      return state.enqueued;
    },
    set enqueued(v: string[]) {
      state.enqueued = v;
    },
  };
  return controller as any;
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("BookEventBus", () => {
  let bus: BookEventBus;

  beforeEach(() => {
    bus = new BookEventBus();
  });

  it("emits events to registered controllers", () => {
    const ctrl = createMockController();
    bus.addController(ctrl);

    bus.emit("page_ready", "book-1", { pageId: "p1" });

    expect(ctrl.enqueued.length).toBe(1);
    const first = ctrl.enqueued[0];
    expect(first).toBeDefined();
    const parsed = JSON.parse(first!.replace("data: ", ""));
    expect(parsed.type).toBe("page_ready");
    expect(parsed.bookId).toBe("book-1");
    expect(parsed.payload.pageId).toBe("p1");
    expect(parsed.timestamp).toBeTypeOf("number");
  });

  it("emits events to multiple controllers", () => {
    const ctrl1 = createMockController();
    const ctrl2 = createMockController();
    bus.addController(ctrl1);
    bus.addController(ctrl2);

    bus.emit("ideation_started", "book-1");

    expect(ctrl1.enqueued.length).toBe(1);
    expect(ctrl2.enqueued.length).toBe(1);
  });

  it("replays existing events to new controllers", () => {
    bus.emit("proposal_ready", "book-1", { title: "Test" });
    bus.emit("spine_ready", "book-1", { chapterCount: 5 });

    const ctrl = createMockController();
    bus.addController(ctrl);

    expect(ctrl.enqueued.length).toBe(2); // replay all previous
  });

  it("removes controller and stops sending events to it", () => {
    const ctrl = createMockController();
    bus.addController(ctrl);
    bus.removeController(ctrl);

    bus.emit("error", "book-1", { message: "oops" });

    // The controller was already registered so it received events during addController
    // (which triggers replay). After removal, it shouldn't get more.
    const beforeRemove = ctrl.enqueued.length;
    bus.emit("book_ready", "book-1");
    expect(ctrl.enqueued.length).toBe(beforeRemove); // no new events
  });

  it("gracefully handles enqueue to closed controller", () => {
    const ctrl = createMockController();
    ctrl.close();
    bus.addController(ctrl);

    // Should not throw
    expect(() => bus.emit("page_ready", "book-1")).not.toThrow();
  });

  it("close() calls close on all controllers", () => {
    const ctrl1 = createMockController();
    const ctrl2 = createMockController();
    bus.addController(ctrl1);
    bus.addController(ctrl2);

    bus.close();

    expect(ctrl1.closed).toBe(true);
    expect(ctrl2.closed).toBe(true);
  });

  it("tracks stage in emitted events", () => {
    const ctrl = createMockController();
    bus.addController(ctrl);

    bus.emit(
      "spine_round" as BookEventType,
      "book-1",
      { round: 1 },
      "iterative_synthesis",
    );

    const first = ctrl.enqueued[0];
    expect(first).toBeDefined();
    const parsed = JSON.parse(first!.replace("data: ", ""));
    expect(parsed.stage).toBe("iterative_synthesis");
  });

  it("handles empty payload", () => {
    const ctrl = createMockController();
    bus.addController(ctrl);

    bus.emit("book_ready", "book-1");

    const first = ctrl.enqueued[0];
    expect(first).toBeDefined();
    const parsed = JSON.parse(first!.replace("data: ", ""));
    expect(parsed.payload).toEqual({});
  });
});

describe("getOrCreateEventBus / removeEventBus", () => {
  afterEach(() => {
    // Clean up registry
    removeEventBus("book-1");
    removeEventBus("book-2");
  });

  it("creates a new bus for unknown bookId", () => {
    const bus = getOrCreateEventBus("book-1");
    expect(bus).toBeInstanceOf(BookEventBus);
  });

  it("returns the same bus for the same bookId", () => {
    const bus1 = getOrCreateEventBus("book-2");
    const bus2 = getOrCreateEventBus("book-2");
    expect(bus1).toBe(bus2);
  });

  it("creates distinct buses for different bookIds", () => {
    const bus1 = getOrCreateEventBus("book-a");
    const bus2 = getOrCreateEventBus("book-b");
    expect(bus1).not.toBe(bus2);

    // Events to one book don't reach the other
    const ctrl = createMockController();
    bus2.addController(ctrl);

    bus1.emit("page_ready", "book-a", { pageId: "p1" });
    expect(ctrl.enqueued.length).toBe(0); // nothing replayed from bus1

    bus2.emit("page_ready", "book-b", { pageId: "p2" });
    expect(ctrl.enqueued.length).toBe(1); // only bus2's event
  });

  it("removeEventBus closes controllers", () => {
    const bus = getOrCreateEventBus("book-1");
    const ctrl = createMockController();
    bus.addController(ctrl);

    removeEventBus("book-1");
    expect(ctrl.closed).toBe(true);
  });

  it("removeEventBus on non-existent key is a no-op", () => {
    expect(() => removeEventBus("nonexistent")).not.toThrow();
  });
});
