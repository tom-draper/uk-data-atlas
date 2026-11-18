import { serveSyncJobs } from "../../src/lib/syncWorkerPool.ts";

/** Doubles a job and adds the offset it was started with; a negative job fails. */
serveSyncJobs<number, number, { offset: number }>((job, { offset }) => {
	if (job < 0) throw new Error(`Job ${job} is refused`);
	return job * 2 + offset;
});
