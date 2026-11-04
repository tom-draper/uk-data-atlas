/**
 * Runs one build stage's command and indents its output by two spaces, so the
 * orchestrator can group it under the stage line. Stdout stays on stdout and
 * stderr on stderr. The exit status, or the signal, is the command's own.
 *
 * Usage: node pipeline/build-data-relay.mjs <command> [args...]
 */
import { spawn } from "node:child_process";
import { createLinePrefixer } from "./build-data-output.mjs";

const [command, ...args] = process.argv.slice(2);
// Stages that run at once get their name in front of each line.
const prefix = process.env.DATA_BUILD_RELAY_PREFIX;
const { DATA_BUILD_RELAY_PREFIX: _prefix, ...env } = process.env;
const child = spawn(command, args, {
	stdio: ["inherit", "pipe", "pipe"],
	env,
});

const attach = (source, target) => {
	const prefixer = createLinePrefixer({
		prefix,
		write: (text) => target.write(text),
		// Progress updates would overwrite other stages' lines.
		overwrite: target.isTTY === true && prefix === undefined,
	});
	source.on("data", (chunk) => prefixer.push(chunk));
	source.on("end", () => prefixer.flush());
};
attach(child.stdout, process.stdout);
attach(child.stderr, process.stderr);

// Ctrl-C reaches the whole process group; let the command end first.
process.on("SIGINT", () => {});
process.on("SIGTERM", () => child.kill("SIGTERM"));

child.on("error", (error) => {
	console.error(`Error: Cannot start ${command}: ${error.message}`);
	process.exitCode = 127;
});
child.on("close", (status, signal) => {
	if (signal) {
		process.removeAllListeners(signal);
		process.kill(process.pid, signal);
	} else process.exitCode ??= status ?? 1;
});
