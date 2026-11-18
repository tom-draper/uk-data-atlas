import { parentPort } from "node:worker_threads";
parentPort.on("message", ({ index, label }) => {
	if (label === "crash") process.exit(7);
	setTimeout(
		() => {
			if (label === "fail")
				parentPort.postMessage({ index, error: "fixture failure" });
			else
				parentPort.postMessage({
					index,
					result: {
						entry: {
							method: "shared-arcs",
							href: label,
							bytes: label.length,
						},
						bytes: Buffer.from(label),
					},
				});
		},
		label === "slow" ? 100 : 1,
	);
});
