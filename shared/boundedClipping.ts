import { existsSync } from "node:fs";
import { join } from "node:path";
import { createRequire } from "node:module";
import {
	MessageChannel,
	receiveMessageOnPort,
	Worker,
	type MessagePort,
} from "node:worker_threads";
import type { MultiPolygon } from "polygon-clipping";

/** Included in artifact provenance so results from older protocols are rebuilt. */
export const BOUNDED_CLIPPING_VERSION = 2;

// polygon-clipping can loop forever on near-coincident edges, and a loop in
// the calling thread cannot be interrupted. The clip runs in a worker instead;
// the caller blocks on a shared flag with a deadline, so the API stays
// synchronous and a runaway clip costs one worker rather than the build.
// Large geometries clipped many times, such as a constituency against each of
// its LSOAs, are registered once and named by reference rather than copied to
// the worker for every clip.
const WORKER = `
const { workerData } = require("node:worker_threads");
const polygonClipping = require(workerData.clipping);
const signal = new Int32Array(workerData.signal);
const registered = new Map();
const resolve = (geometry) =>
	typeof geometry === "string" ? registered.get(geometry) : geometry;
workerData.port.on("message", ({ register, requestId, operation, first, second }) => {
	if (register) {
		registered.set(register.id, register.geometry);
		return;
	}
	let result;
	try {
		result = {
			geometry: polygonClipping[operation](resolve(first), resolve(second)),
		};
	} catch (error) {
		result = { error: error instanceof Error ? error.message : String(error) };
	}
	workerData.port.postMessage({ requestId, ...result });
	Atomics.store(signal, 0, 1);
	Atomics.notify(signal, 0);
});
`;

const bundledClipping = join(import.meta.dirname, "polygon-clipping.cjs");
const CLIPPING_MODULE = existsSync(bundledClipping)
	? bundledClipping
	: createRequire(import.meta.url).resolve("polygon-clipping");

export type ClippingOperation = "intersection" | "xor" | "difference";

/** A geometry, or the id of one registered with the clipper. */
export type ClipOperand = MultiPolygon | string;

export type BoundedClip =
	| { status: "clipped"; geometry: MultiPolygon }
	| { status: "failed"; reason: string };

export class BoundedClipper {
	private worker?: Worker;
	private port?: MessagePort;
	private readonly signal = new Int32Array(new SharedArrayBuffer(4));
	// Kept here too, so a worker replaced after a timeout can be given them.
	private readonly registered = new Map<string, MultiPolygon>();
	private nextRequestId = 0;

	constructor(private readonly timeoutMs: number) {}

	/** Keep a geometry in the worker, to be named by `id` in later clips. */
	register(id: string, geometry: MultiPolygon) {
		this.registered.set(id, geometry);
		this.port?.postMessage({ register: { id, geometry } });
	}

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
		for (const [id, geometry] of this.registered)
			port1.postMessage({ register: { id, geometry } });
	}

	clip(
		operation: ClippingOperation,
		first: ClipOperand,
		second: ClipOperand,
	): BoundedClip {
		for (const operand of [first, second])
			if (typeof operand === "string" && !this.registered.has(operand))
				return {
					status: "failed",
					reason: `No geometry is registered as ${operand}.`,
				};
		if (!this.worker) this.start();
		const requestId = ++this.nextRequestId;
		const deadline = performance.now() + this.timeoutMs;
		this.port!.postMessage({ requestId, operation, first, second });
		for (;;) {
			// A notification is only a hint: the preceding request can notify
			// after its response was already read. Reset before checking the
			// queue so a response arriving between the check and wait wakes us.
			Atomics.store(this.signal, 0, 0);
			let received;
			while ((received = receiveMessageOnPort(this.port!)?.message)) {
				const response = received as { requestId: number } & (
					{ geometry: MultiPolygon } | { error: string }
				);
				if (response.requestId !== requestId) continue;
				return "error" in response
					? { status: "failed", reason: response.error }
					: { status: "clipped", geometry: response.geometry };
			}
			const remaining = deadline - performance.now();
			if (remaining <= 0) {
				this.close();
				return {
					status: "failed",
					reason: `Clipping did not finish within ${this.timeoutMs} ms.`,
				};
			}
			Atomics.wait(this.signal, 0, 0, remaining);
		}
	}

	close() {
		void this.worker?.terminate();
		this.port?.close();
		this.worker = undefined;
		this.port = undefined;
	}
}
