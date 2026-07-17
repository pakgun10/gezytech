// ─── Book Engine: SSE EventBus Unit Tests ─────────────────────────────────────
import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { BookEventBus, getOrCreateEventBus, removeEventBus } from "./sse";

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
    // Minimal ReadableStreamDefaultController shape
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
    const parsed = JSON.parse(ctrl.enqueued[0].replace("data: ", ""));
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
      "spine_round" as any,
      "book-1",
      { round: 1 },
      "iterative_synthesis",
    );

    const parsed = JSON.parse(ctrl.enqueued[0].replace("data: ", ""));
    expect(parsed.stage).toBe("iterative_synthesis");
  });

  it("handles empty payload", () => {
    const ctrl = createMockController();
    bus.addController(ctrl);

    bus.emit("book_ready", "book-1");

    const parsed = JSON.parse(ctrl.enqueued[0].replace("data: ", ""));
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
