import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { logger } from "hono/logger";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";

const app = new Hono();

const filePath = "./assets/PerituneMaterial_Amenoshita.mp3";
const fileStat = await stat(filePath);

app.use(logger());

app.get("/stream", (c) => {
  const range = c.req.header("range");
  if (!range) {
    return c.text("Range header required", 416);
  }

  const [startStr, endStr] = range.replace(/bytes=/, "").split("-");
  const start = parseInt(startStr, 10);
  const end = endStr ? parseInt(endStr, 10) : fileStat.size - 1;
  const chunkSize = end - start + 1;

  const headers = {
    "Content-Range": `bytes ${start}-${end}/${fileStat.size}`,
    "Accept-Ranges": "bytes",
    "Content-Length": chunkSize.toString(),
    "Content-Type": "audio/mpeg",
  };

  const stream = createReadStream(filePath, { start, end });
  const reader = stream[Symbol.asyncIterator]();
  const webStream = new ReadableStream({
    async pull(controller) {
      try {
        const { done, value } = await reader.next();
        if (done) {
          controller.close();
        } else {
          controller.enqueue(value);
        }
      } catch (error) {
        controller.error(error);
      }
    },
    cancel(reason) {
      stream.destroy(reason);
    },
  });
  return new Response(webStream, {
    status: 206,
    headers,
  });
});

serve(
  {
    fetch: app.fetch,
    port: 3000,
  },
  (info) => {
    console.log(`Server is running on http://localhost:${info.port}`);
  }
);
