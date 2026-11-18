import { parentPort } from "node:worker_threads";
parentPort.on("message", ({ index, release }) => {
	if (release.id === "crash") process.exit(1);
	if (release.id === "fail")
		return parentPort.postMessage({ index, error: "test failure" });
	setTimeout(
		() =>
			parentPort.postMessage({
				index,
				unavailable: {
					geography: release.geography,
					boundaryRelease: release.id,
					reason: "fixture reason",
				},
			}),
		release.id === "slow" ? 100 : 0,
	);
});
