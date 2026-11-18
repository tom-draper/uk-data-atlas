import { parentPort } from "node:worker_threads";
parentPort.on("message", ({ release }) => {
	if (release.id === "missing") process.exit(17);
});
await import("../../../src/maps/mapResourceWorker.ts");
