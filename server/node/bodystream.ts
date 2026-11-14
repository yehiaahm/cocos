import type { IncomingMessage } from 'node:http';
import { HttpError } from '../http';

/**
 * Node request → web ReadableStream with a hard byte ceiling.
 *
 * Replaces `Readable.toWeb(req)`: that adapter keeps calling `controller.enqueue()` after the stream has been
 * cancelled (which is exactly what happens when a size cap trips mid-upload) and the resulting uncaught
 * "Controller is already closed" exception takes the whole process down. Here every callback is guarded, the
 * socket is paused when the consumer is behind, and a cancelled body is drained and thrown away.
 */
export function limitedBody(req: IncomingMessage, maxBytes: number): ReadableStream<Uint8Array> {
  let seen = 0;
  let finished = false;

  return new ReadableStream<Uint8Array>({
    start(controller) {
      const stop = () => {
        finished = true;
        req.off('data', onData);
        req.off('end', onEnd);
        req.off('error', onError);
        req.off('close', onClose);
        // Keep reading (and discarding) so the connection isn't left half-read; the server closes it after a 413.
        req.on('error', () => undefined);
        req.resume();
      };
      const onData = (chunk: Buffer) => {
        if (finished) return;
        seen += chunk.length;
        if (seen > maxBytes) {
          const err = new HttpError(413, 'Request too large', 'too_large');
          stop();
          try {
            controller.error(err);
          } catch {
            /* already closed */
          }
          return;
        }
        try {
          controller.enqueue(new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.length));
          if ((controller.desiredSize ?? 1) <= 0) req.pause();
        } catch {
          stop();
        }
      };
      const onEnd = () => {
        if (finished) return;
        finished = true;
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };
      const onError = (err: Error) => {
        if (finished) return;
        stop();
        try {
          controller.error(err);
        } catch {
          /* already closed */
        }
      };
      const onClose = () => {
        // Socket dropped before the body finished.
        if (finished || req.complete) return;
        stop();
        try {
          controller.error(new Error('Request aborted'));
        } catch {
          /* already closed */
        }
      };
      req.on('data', onData);
      req.on('end', onEnd);
      req.on('error', onError);
      req.on('close', onClose);
    },
    pull() {
      if (!finished) req.resume();
    },
    cancel() {
      finished = true;
      req.on('error', () => undefined);
      req.resume(); // drain and discard
    },
  });
}
