import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";

export async function videoFileResponse(filePath: string, request: Request, filename: string): Promise<Response> {
  const info = await stat(filePath);
  const size = info.size;
  const safeName = filename.replace(/["\r\n]/g, "");
  const download = new URL(request.url).searchParams.get("download") === "1";
  const headers = new Headers({
    "Content-Type": "video/mp4",
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, no-store",
    "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${safeName}"`,
  });

  const range = request.headers.get("range");
  if (!range) {
    headers.set("Content-Length", String(size));
    return new Response(Readable.toWeb(createReadStream(filePath)) as ReadableStream, { status: 200, headers });
  }

  const match = /^bytes=(\d*)-(\d*)$/.exec(range);
  if (!match) {
    headers.set("Content-Range", `bytes */${size}`);
    return new Response(null, { status: 416, headers });
  }

  const start = match[1] ? Number(match[1]) : 0;
  const end = match[2] ? Number(match[2]) : size - 1;
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < start || start >= size) {
    headers.set("Content-Range", `bytes */${size}`);
    return new Response(null, { status: 416, headers });
  }
  const boundedEnd = Math.min(end, size - 1);
  headers.set("Content-Range", `bytes ${start}-${boundedEnd}/${size}`);
  headers.set("Content-Length", String(boundedEnd - start + 1));
  return new Response(Readable.toWeb(createReadStream(filePath, { start, end: boundedEnd })) as ReadableStream, {
    status: 206,
    headers,
  });
}
