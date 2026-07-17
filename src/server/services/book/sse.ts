// ─── Book Engine: SSE Streaming ──────────────────────────────────────────────
import type { Context } from "hono";
import type { BookEventType } from "@gezy/sdk";

export interface BookSSEEvent {
  type: BookEventType;
  bookId: string;
  payload: Record<string, unknown>;
  timestamp: number;
  stage?: string;
}

/** Internal bus for collecting SSE events during a single operation */
export class BookEventBus {
  private events: BookSSEEvent[] = [];
  private controllers: Set<ReadableStreamDefaultController> = new Set();

  /** Collect an event and push to all active SSE connections */
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

  /** Register a new SSE connection for this book */
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

  /** Remove a closed SSE connection */
  removeController(controller: ReadableStreamDefaultController) {
    this.controllers.delete(controller);
  }

  /** Clean up all connections */
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

export function getOrCreateEventBus(bookId: string): BookEventBus {
  let bus = streamRegistry.get(bookId);
  if (!bus) {
    bus = new BookEventBus();
    streamRegistry.set(bookId, bus);
  }
  return bus;
}

export function removeEventBus(bookId: string) {
  const bus = streamRegistry.get(bookId);
  if (bus) {
    bus.close();
    streamRegistry.delete(bookId);
  }
}

/** Setup an SSE stream response for a given book */
export function setupBookSSE(c: Context, bookId: string): Response {
  const bus = getOrCreateEventBus(bookId);

  let controller: ReadableStreamDefaultController;
  const stream = new ReadableStream({
    start(ctrl) {
      controller = ctrl;
      bus.addController(controller);

      // Heartbeat every 15 seconds
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(": heartbeat\n\n");
        } catch {
          clearInterval(heartbeat);
        }
      }, 15000);

      // Cleanup on client disconnect (abort)
      c.req.raw.signal.addEventListener("abort", () => {
        clearInterval(heartbeat);
        bus.removeController(controller);
      });
    },
    cancel() {
      bus.removeController(controller);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
