import { availableParallelism } from "node:os";

const GIGABYTE = 1024 ** 3;
const MAX_WORKERS = 4;
const PARENT_MEMORY = GIGABYTE;
const WORKER_MEMORY = 2 * GIGABYTE;

export const datasetConcurrency = () => {
	const requested = Number(process.env.ATLAS_PRECOMPILE_JOBS);
	if (Number.isInteger(requested) && requested > 0) return requested;
	return Math.max(
		1,
		Math.min(
			MAX_WORKERS,
			availableParallelism() - 1,
			Math.floor(
				(process.availableMemory() - PARENT_MEMORY) / WORKER_MEMORY,
			),
		),
	);
};
