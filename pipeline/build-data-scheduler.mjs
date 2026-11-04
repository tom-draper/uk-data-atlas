/**
 * Walks the planned stages in order. `settle(stage)` handles a stage that
 * needs no command and returns true when the stage has to run; `run(stage)`
 * runs it and resolves to false when it failed, which stops the walk.
 *
 * @param {{
 *   stages: Array<{ name: string }>,
 *   settle: (stage: any) => boolean,
 *   run: (stage: any) => Promise<boolean>,
 * }} options
 */
export async function runSchedule({ stages, settle, run }) {
	for (const stage of stages) {
		if (!settle(stage)) continue;
		if (!(await run(stage))) return;
	}
}
