/**
 * The opponent as the browser plays it: the same one, with its search running in
 * a Web Worker rather than in the interface's thread.
 *
 * This is the adapter and the only thing on either side of the boundary that
 * knows a worker exists. It posts a question, waits for the answer with the
 * matching id, and hands it to {@link createOpponent}, which is what everything
 * else is tested against.
 */

import type { SearchResult } from "../ai/search";
import type { ChooseMove } from "../session/game-session";
import {
  type OpponentOptions,
  type RunSearch,
  type WorkerReply,
  type WorkerRequest,
  createOpponent,
} from "./opponent";

/** A question the worker has not answered yet. */
type Pending = {
  readonly settle: (result: SearchResult) => void;
  readonly fail: (reason: Error) => void;
};

export const createWorkerOpponent = (options?: OpponentOptions): ChooseMove => {
  const pending = new Map<number, Pending>();
  let worker: Worker | undefined;
  let asked = 0;

  // Started on the first question rather than up front, so that two people
  // sharing a device never pay for a thread nobody is thinking in.
  const thinkingThread = () => {
    if (worker) return worker;

    const started = new Worker(new URL("./search.worker.ts", import.meta.url), { type: "module" });

    started.addEventListener("message", ({ data }: MessageEvent<WorkerReply>) => {
      const waiting = pending.get(data.id);
      pending.delete(data.id);
      waiting?.settle(data.result);
    });

    // A worker that has failed answers nothing, ever: everything waiting on it
    // is told as much rather than left waiting, and it is thrown away so that
    // the next question starts a thread rather than being posted into the dead
    // one — where it would wait for an answer that could never come.
    started.addEventListener("error", (event) => {
      const failed = [...pending.values()];
      pending.clear();
      worker = undefined;
      started.terminate();

      for (const { fail } of failed) fail(new Error(event.message));
    });

    worker = started;
    return started;
  };

  const runSearch: RunSearch = (request) =>
    new Promise((settle, fail) => {
      asked += 1;
      const id = asked;

      pending.set(id, { settle, fail });
      thinkingThread().postMessage({ ...request, id } satisfies WorkerRequest);
    });

  return createOpponent(runSearch, options);
};
