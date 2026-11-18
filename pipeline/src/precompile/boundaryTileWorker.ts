import { parentPort } from "node:worker_threads";
import { compileBoundaryRelease } from "./compileBoundaryTiles.ts";

if (!parentPort) throw new Error("boundaryTileWorker.ts must run as a worker.");
const port = parentPort;
port.on(
	"message",
	async ({
		index,
		label,
		asset,
	}: {
		index: number;
		label: string;
		asset: string;
	}) => {
		try {
			const result = await compileBoundaryRelease(label, asset);
			port.postMessage({ index, result }, [
				result.bytes.buffer as ArrayBuffer,
			]);
		} catch (error) {
			port.postMessage({
				index,
				error:
					error instanceof Error
						? (error.stack ?? error.message)
						: String(error),
			});
		}
	},
);
