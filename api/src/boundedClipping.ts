import { createRequire } from "node:module";
import {
	MessageChannel,
	receiveMessageOnPort,
	Worker,
	type MessagePort,
} from "node:worker_threads";
import type { MultiPolygon } from "polygon-clipping";

// polygon-clipping can loop forever on near-coincident edges, and a loop in
// the calling thread cannot be interrupted. The clip runs in a worker instead;
// the caller blocks on a shared flag with a deadline, so the API stays
// synchronous and a runaway clip costs one worker rather than the build.
const WORKER = `
const { workerData } = require("node:worker_threads");
const polygonClipping = require(workerData.clipping);
const signal = new Int32Array(workerData.signal);
workerData.port.on("message", ({ operation, first, second }) => {
	let result;
	try {
		result = { geometry: polygonClipping[operation](first, second) };
	} catch (error) {
		result = { error: error instanceof Error ? error.message : String(error) };
	}
	workerData.port.postMessage(result);
	Atomics.store(signal, 0, 1);
	Atomics.notify(signal, 0);
});
`;

const CLIPPING_MODULE = createRequire(import.meta.url).resolve(
	"polygon-clipping",
);

export type ClippingOperation = "intersection" | "xor";

export type BoundedClip =
	| { status: "clipped"; geometry: MultiPolygon }
	| { status: "failed"; reason: string };

export class BoundedClipper {
	private worker?: Worker;
	private port?: MessagePort;
	private readonly signal = new Int32Array(new SharedArrayBuffer(4));

	constructor(private readonly timeoutMs: number) {}

	private start() {
		const { port1, port2 } = new MessageChannel();
		this.worker = new Worker(WORKER, {
			eval: true,
			workerData: {
				clipping: CLIPPING_MODULE,
				signal: this.signal.buffer,
				port: port2,
			},
			transferList: [port2],
		});
		this.worker.unref();
		this.port = port1;
	}

	clip(
		operation: ClippingOperation,
		first: MultiPolygon,
		second: MultiPolygon,
	): BoundedClip {
		if (!this.worker) this.start();
		Atomics.store(this.signal, 0, 0);
		this.port!.postMessage({ operation, first, second });
		if (Atomics.wait(this.signal, 0, 0, this.timeoutMs) === "timed-out") {
			this.close();
			return {
				status: "failed",
				reason: `Clipping did not finish within ${this.timeoutMs} ms.`,
			};
		}
		const received = receiveMessageOnPort(this.port!)?.message as
			{ geometry: MultiPolygon } | { error: string } | undefined;
		if (!received)
			return {
				status: "failed",
				reason: "The clipping worker returned no result.",
			};
		return "error" in received
			? { status: "failed", reason: received.error }
			: { status: "clipped", geometry: received.geometry };
	}

	close() {
		void this.worker?.terminate();
		this.port?.close();
		this.worker = undefined;
		this.port = undefined;
	}
}
