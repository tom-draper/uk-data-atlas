import { describe, expect, test } from "vitest";
import {
	createBuildLog,
	formatArtifact,
	formatBytes,
	formatCount,
	formatDuration,
	formatGzipBytes,
} from "@uk-data-atlas/atlas-db";

describe("formatDuration", () => {
	test.each([
		[0, "<0.1s"],
		[42, "<0.1s"],
		[99, "<0.1s"],
		[100, "0.1s"],
		[400, "0.4s"],
		[4200, "4.2s"],
		[9949, "9.9s"],
		[9960, "10s"],
		[10_000, "10s"],
		[42_400, "42s"],
		[59_400, "59s"],
		[59_600, "1m 00s"],
		[60_000, "1m 00s"],
		[187_000, "3m 07s"],
		[3_599_000, "59m 59s"],
		[3_600_000, "1h 00m"],
		[3_720_000, "1h 02m"],
		[90_000_000, "25h 00m"],
		[-5, "<0.1s"],
		[Number.NaN, "<0.1s"],
	])("%d ms prints %s", (milliseconds, expected) => {
		expect(formatDuration(milliseconds)).toBe(expected);
	});
});

describe("formatBytes", () => {
	test.each([
		[0, "0 B"],
		[1, "1 B"],
		[512, "512 B"],
		[1023, "1023 B"],
		[1024, "1 KB"],
		[4300, "4.2 KB"],
		[38 * 1024, "38 KB"],
		[300, "300 B"],
		[123 * 1024, "123 KB"],
		[1024 * 1024 - 1, "1 MB"],
		[7.2 * 1024 * 1024, "7.2 MB"],
		[1.13 * 1024 ** 3, "1.13 GB"],
		[5000 * 1024 ** 3, "5000 GB"],
	])("%d bytes prints %s", (bytes, expected) => {
		expect(formatBytes(bytes)).toBe(expected);
	});

	test("a small non-empty file never prints as zero", () => {
		expect(formatBytes(1)).not.toMatch(/^0/);
		expect(formatBytes(300 * 1024 * 1024 * 1024)).toBe("300 GB");
		expect(formatBytes(10 * 1024)).toBe("10 KB");
		expect(formatBytes(400)).toBe("400 B");
		expect(formatBytes(1100)).toBe("1.07 KB");
	});

	test("compressed sizes say gzip", () => {
		expect(formatGzipBytes(7.2 * 1024 * 1024)).toBe("7.2 MB gzip");
	});
});

describe("formatCount", () => {
	test.each([
		[0, "0"],
		[322, "322"],
		[1234, "1,234"],
		[1_234_567, "1,234,567"],
	])("%d prints %s", (count, expected) => {
		expect(formatCount(count)).toBe(expected);
	});
});

describe("build log", () => {
	const capture = (verbose = false) => {
		const out: string[] = [];
		const err: string[] = [];
		const log = createBuildLog({
			out: (line) => out.push(line),
			err: (line) => err.push(line),
			verbose: () => verbose,
		});
		return { log, out, err };
	};

	test("status lines go to stdout and warnings and errors to stderr", () => {
		const { log, out, err } = capture();
		log.info("Wrote 322 rows to data/build/x.json");
		log.warn("Two codes were not found");
		log.error("Cannot read the source");
		expect(out).toEqual(["Wrote 322 rows to data/build/x.json"]);
		expect(err).toEqual([
			"Warning: Two codes were not found",
			"Error: Cannot read the source",
		]);
	});

	test("artifact lines share one shape", () => {
		const { log, out } = capture();
		log.artifact("dataset", "house-price.json", {
			status: "compiled",
			bytes: 7.2 * 1024 * 1024,
			ms: 5900,
		});
		log.artifact("tiles", "lad", { status: "cached" });
		expect(out).toEqual([
			"dataset: house-price.json (compiled, 7.2 MB, 5.9s)",
			"tiles: lad (cached)",
		]);
		expect(
			formatArtifact("boundary", "lsoa", { status: "kept", ms: 20 }),
		).toBe("boundary: lsoa (kept, <0.1s)");
	});

	test("details are shown only when verbose", () => {
		const quiet = capture(false);
		quiet.log.detail("Wrote data/build/a.json");
		expect(quiet.out).toEqual([]);
		const verbose = capture(true);
		verbose.log.detail("Wrote data/build/a.json");
		expect(verbose.out).toEqual(["Wrote data/build/a.json"]);
	});
});
