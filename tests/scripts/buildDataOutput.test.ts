import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";
import { createLinePrefixer } from "@/scripts/build-data-output.mjs";

const relay = fileURLToPath(
	new URL("../../scripts/build-data-relay.mjs", import.meta.url),
);

const prefixed = (chunks: string[], overwrite = false) => {
	let output = "";
	const prefixer = createLinePrefixer({
		write: (text: string) => (output += text),
		overwrite,
	});
	for (const chunk of chunks) prefixer.push(Buffer.from(chunk));
	prefixer.flush();
	return output;
};

test("every line is indented by two spaces and blank lines stay empty", () => {
	expect(prefixed(["one\n\ntwo\n"])).toBe("  one\n\n  two\n");
});

test("a line split across chunks is joined and a partial last line is flushed", () => {
	expect(prefixed(["Wro", "te 322 rows\nDone"])).toBe(
		"  Wrote 322 rows\n  Done\n",
	);
});

test("multibyte characters split across chunks survive", () => {
	const bytes = Buffer.from("Área\n");
	let output = "";
	const prefixer = createLinePrefixer({
		write: (text: string) => (output += text),
	});
	prefixer.push(bytes.subarray(0, 1));
	prefixer.push(bytes.subarray(1));
	prefixer.flush();
	expect(output).toBe("  Área\n");
});

test("progress updates print only their final state off a terminal", () => {
	expect(prefixed(["10%\r50%\r100%\ndone\n"])).toBe("  100%\n  done\n");
	expect(prefixed(["10%\r100%\r"])).toBe("  100%\n");
	expect(prefixed(["a\r\nb\r\n"])).toBe("  a\n  b\n");
});

test("progress updates overwrite in place on a terminal", () => {
	expect(prefixed(["10%\r50%\r100%\n"], true)).toBe("  10%\r  50%\r  100%\n");
});

test("the relay indents stdout and stderr separately and keeps the exit status", () => {
	const result = spawnSync(
		process.execPath,
		[
			relay,
			process.execPath,
			"-e",
			'console.log("out"); console.error("err"); process.stdout.write("tail"); process.exit(7)',
		],
		{ encoding: "utf8" },
	);
	assert.equal(result.status, 7);
	assert.equal(result.stdout, "  out\n  tail\n");
	assert.equal(result.stderr, "  err\n");
});

test("the relay reports a command that cannot start", () => {
	const result = spawnSync(
		process.execPath,
		[relay, "no-such-command-here"],
		{
			encoding: "utf8",
		},
	);
	assert.equal(result.status, 127);
	assert.match(result.stderr, /^Error: Cannot start no-such-command-here/);
});
