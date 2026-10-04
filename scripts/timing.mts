export const elapsedSince = (startedAt: number) =>
	`${(performance.now() - startedAt).toFixed(5)}ms`;
