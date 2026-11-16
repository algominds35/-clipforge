import { processQueuedJobs } from "../src/lib/jobs/process-cut";

async function main() {
  for (;;) {
    const processed = await processQueuedJobs();
    await new Promise((resolve) => setTimeout(resolve, processed > 0 ? 250 : 1000));
  }
}

void main();
