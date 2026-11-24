import cluster, { type Worker } from "node:cluster";
import { randomUUID } from "node:crypto";

const COLLECTION_TIMEOUT_MS = 1000;

type Message =
	| { type: "metrics.collect" | "metrics.snapshot"; id: string }
	| { type: "metrics.snapshot-result"; id: string; text: string }
	| { type: "metrics.reply"; id: string; text: string | null };

const parseMessage = (value: unknown): Message | undefined => {
	if (
		typeof value !== "object" ||
		value === null ||
		!("type" in value) ||
		!("id" in value) ||
		typeof value.id !== "string"
	)
		return undefined;
	const { id } = value;
	if (value.type === "metrics.collect" || value.type === "metrics.snapshot")
		return { type: value.type, id };
	if (!("text" in value)) return undefined;
	if (
		value.type === "metrics.snapshot-result" &&
		typeof value.text === "string"
	)
		return { type: value.type, id, text: value.text };
	if (
		value.type === "metrics.reply" &&
		(typeof value.text === "string" || value.text === null)
	)
		return { type: value.type, id, text: value.text };
	return undefined;
};

const renderWorkers = (snapshots: Map<number, string>): string => {
	const families = new Map<string, string[]>();
	for (const [worker, text] of [...snapshots].sort(([a], [b]) => a - b)) {
		let family: string[] = [];
		let first = false;
		for (const line of text.trimEnd().split("\n")) {
			if (line.startsWith("# HELP ")) {
				const name = line.split(" ")[2]!;
				first = !families.has(name);
				family = families.get(name) ?? [];
				families.set(name, family);
			}
			if (line.startsWith("#")) {
				if (first) family.push(line);
			} else if (line) {
				family.push(
					line.replace(/^([^ {]+)(\{| )/, (_, name, delimiter) =>
						delimiter === "{"
							? `${name}{worker="${worker}",`
							: `${name}{worker="${worker}"} `,
					),
				);
			}
		}
	}
	return `${[...families.values()].flat().join("\n")}\n`;
};

const send = (worker: Worker, message: Message, onError: () => void) => {
	if (!worker.isConnected()) return onError();
	worker.send(message, (error: Error | null) => {
		if (error) onError();
	});
};

export const installPrimaryMetrics = () => {
	type Collection = {
		id: string;
		workers: Set<number>;
		snapshots: Map<number, string>;
		requesters: Map<Worker, string>;
		timer: NodeJS.Timeout;
	};
	let active: Collection | undefined;
	const finish = (text: string | null) => {
		const collection = active;
		if (!collection) return;
		active = undefined;
		clearTimeout(collection.timer);
		for (const [worker, id] of collection.requesters)
			send(worker, { type: "metrics.reply", id, text }, () => {});
	};
	const onMessage = (worker: Worker, value: unknown) => {
		const message = parseMessage(value);
		if (message?.type === "metrics.collect") {
			if (active) {
				active.requesters.set(worker, message.id);
				return;
			}
			const workers = Object.values(cluster.workers ?? {}).filter(
				(candidate): candidate is Worker => candidate !== undefined,
			);
			const id = randomUUID();
			active = {
				id,
				workers: new Set(workers.map((candidate) => candidate.id)),
				snapshots: new Map(),
				requesters: new Map([[worker, message.id]]),
				timer: setTimeout(() => finish(null), COLLECTION_TIMEOUT_MS),
			};
			for (const candidate of workers) {
				send(candidate, { type: "metrics.snapshot", id }, () => {
					if (active?.id === id) finish(null);
				});
			}
		} else if (
			message?.type === "metrics.snapshot-result" &&
			active?.id === message.id &&
			active.workers.has(worker.id)
		) {
			active.snapshots.set(worker.id, message.text);
			if (active.snapshots.size === active.workers.size) {
				const workers = Object.keys(cluster.workers ?? {});
				const unchanged =
					workers.length === active.workers.size &&
					workers.every((id) => active?.workers.has(Number(id)));
				finish(unchanged ? renderWorkers(active.snapshots) : null);
			}
		}
	};
	const onDisconnect = (worker: Worker) => {
		if (active?.workers.has(worker.id)) finish(null);
	};
	cluster.on("message", onMessage);
	cluster.on("disconnect", onDisconnect);
	return () => {
		cluster.off("message", onMessage);
		cluster.off("disconnect", onDisconnect);
		finish(null);
	};
};

export const createWorkerMetrics = (render: () => string) => {
	type Pending = {
		id: string;
		resolve: (text: string | null) => void;
		promise: Promise<string | null>;
		timer: NodeJS.Timeout;
	};
	let pending: Pending | undefined;
	const finish = (text: string | null) => {
		if (!pending) return;
		clearTimeout(pending.timer);
		const { resolve } = pending;
		pending = undefined;
		resolve(text);
	};
	const onMessage = (value: unknown) => {
		const message = parseMessage(value);
		if (message?.type === "metrics.snapshot" && process.connected) {
			process.send?.(
				{
					type: "metrics.snapshot-result",
					id: message.id,
					text: render(),
				},
				(error: Error | null) => {
					if (error) finish(null);
				},
			);
		} else if (
			message?.type === "metrics.reply" &&
			pending?.id === message.id
		)
			finish(message.text);
	};
	const onDisconnect = () => finish(null);
	process.on("message", onMessage);
	process.on("disconnect", onDisconnect);
	return {
		collect: (): Promise<string | null> => {
			if (pending) return pending.promise;
			if (!process.connected) return Promise.resolve(null);
			const id = randomUUID();
			let resolve: (text: string | null) => void = () => {};
			const promise = new Promise<string | null>((complete) => {
				resolve = complete;
			});
			pending = {
				id,
				promise,
				resolve,
				timer: setTimeout(
					() => finish(null),
					COLLECTION_TIMEOUT_MS + 500,
				),
			};
			process.send?.(
				{ type: "metrics.collect", id },
				(error: Error | null) => {
					if (error && pending?.id === id) finish(null);
				},
			);
			return promise;
		},
		close: () => {
			process.off("message", onMessage);
			process.off("disconnect", onDisconnect);
			finish(null);
		},
	};
};
