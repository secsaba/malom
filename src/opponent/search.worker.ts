/**
 * The Web Worker the opponent thinks in, so that a search deep enough to be
 * worth playing never holds the interface's thread while it runs.
 *
 * It holds no rules and no judgement of its own: a game comes in, the search the
 * opponent would have run here runs there instead, and the result goes back.
 * That is the whole of it — which is why everything the computer plays can be
 * tested in one process, with no worker anywhere near it.
 */

import { type WorkerReply, type WorkerRequest, searchInProcess } from "./opponent";

self.onmessage = ({ data }: MessageEvent<WorkerRequest>) => {
  void searchInProcess(data).then((result) => {
    self.postMessage({ id: data.id, result } satisfies WorkerReply);
  });
};
