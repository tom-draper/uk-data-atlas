import { availableParallelism } from "node:os";
import {
	MessageChannel,
	receiveMessageOnPort,
	Worker,
	workerData,
	type MessagePort,
} from "node:worker_threads";

/**
 * Work for worker threads, taken back by synchronous code. A stage that is
 * written as one synchronous pass over a database cannot await a pool; this
 * one hands out jobs, lets the caller go on, and blocks only in `take`, on a
 * shared flag the workers raise as each job ends (the way `BoundedClipper`
 * waits on its worker). Results are read by ticket, so a caller that takes
 * them in the order it submitted them sees exactly what a loop in its own
 * thread would have produced.
 */

/** How long `take` waits with no worker finishing anything before giving up. */
const STALL_MS = 10 * 60 * 1000;

type Reply<Result> = { ticket: number } & (
	{ result: Result } | { error: { message: string; stack?: string } }
);

/** Workers to use: `environment` if it is a positive integer, else up to `most`. */
export const workerCount = (
	environment: string,
	most: number,
	cpus = availableParallelism(),
) => {
	const requested = Number(process.env[environment]);
	if (Number.isInteger(requested) && requested > 0) return requested;
	return Math.max(1, Math.min(most, cpus - 1));
};

export class SyncWorkerPool<Job, Result> {
	private readonly workers: Worker[] = [];
	private readonly ports: MessagePort[] = [];
	private readonly signal = new Int32Array(new SharedArrayBuffer(4));
	private readonly done = new Map<number, Reply<Result>>();
	private nextTicket = 0;

	/**
	 * `module` calls `serveSyncJobs` with the function that runs one job.
	 * `options` is handed to the worker as `workerData.options`.
	 */
	constructor(module: URL, size: number, options?: unknown) {
		for (let started = 0; started < size; started++) {
			const { port1, port2 } = new MessageChannel();
			const worker = new Worker(module, {
				workerData: {
					port: port2,
					signal: this.signal.buffer,
					options,
				},
				transferList: [port2],
			});
			// The caller closes the pool; a worker must not outlive a failure.
			worker.unref();
			this.workers.push(worker);
			this.ports.push(port1);
		}
	}

	get size() {
		return this.workers.length;
	}

	/** Start a job on the next worker and return its ticket. */
	submit(job: Job) {
		const ticket = this.nextTicket++;
		this.ports[ticket % this.ports.length]!.postMessage({ ticket, job });
		return ticket;
	}

	/** Wait for a job's result. Throws what the job threw. */
	take(ticket: number): Result {
		let lastProgress = performance.now();
		for (;;) {
			// A raised flag is only a hint, and the worker raises it after it
			// has posted: read it before looking, so a reply that lands between
			// the look and the wait makes the wait return at once.
			const seen = Atomics.load(this.signal, 0);
			for (const port of this.ports) {
				let received;
				while ((received = receiveMessageOnPort(port))) {
					const reply = received.message as Reply<Result>;
					this.done.set(reply.ticket, reply);
					lastProgress = performance.now();
				}
			}
			const reply = this.done.get(ticket);
			if (reply) {
				this.done.delete(ticket);
				if ("error" in reply)
					// The worker's own stack says where the job failed.
					throw Object.assign(new Error(reply.error.message), {
						stack: reply.error.stack,
					});
				return reply.result;
			}
			const remaining = lastProgress + STALL_MS - performance.now();
			if (remaining <= 0)
				throw new Error(
					`No worker finished a job in ${STALL_MS / 1000} s.`,
				);
			Atomics.wait(this.signal, 0, seen, Math.min(remaining, 5000));
		}
	}

	close() {
		for (const worker of this.workers) void worker.terminate();
		for (const port of this.ports) port.close();
		this.workers.length = 0;
		this.ports.length = 0;
	}
}

/** Called once by a worker module: answer each job with `handle`'s result. */
export function serveSyncJobs<Job, Result, Options = unknown>(
	handle: (job: Job, options: Options) => Result,
) {
	const data = workerData as {
		port: MessagePort;
		signal: SharedArrayBuffer;
		options: Options;
	};
	const signal = new Int32Array(data.signal);
	data.port.on("message", ({ ticket, job }: { ticket: number; job: Job }) => {
		let reply: Reply<Result>;
		try {
			reply = { ticket, result: handle(job, data.options) };
		} catch (error) {
			reply = {
				ticket,
				error:
					error instanceof Error
						? { message: error.message, stack: error.stack }
						: { message: String(error) },
			};
		}
		data.port.postMessage(reply);
		Atomics.add(signal, 0, 1);
		Atomics.notify(signal, 0);
	});
}
