import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "@/lib/fix/api";
import { runCheck } from "@/lib/fix/check";
import { readTable } from "@/lib/fix/table";
import type { BulkLookup, Crosswalk } from "@/lib/fix/types";
import { history, inferred, latest, releases } from "./sample";

vi.mock("@/lib/fix/api", async (importActual) => ({
	...(await importActual<typeof import("@/lib/fix/api")>()),
	boundaryReleases: vi.fn(),
	validateInferred: vi.fn(),
	validateAgainst: vi.fn(),
	areaHistory: vi.fn(),
	crosswalks: vi.fn(),
	bulkLookups: vi.fn(),
	lookupCsv: vi.fn(),
}));

const table = readTable(readFileSync("public/fix/sample-wards.csv", "utf8"));
const FROM = { geography: "ward", boundaryRelease: "2024-12-uk-bgc" };
const TO = { geography: "ward", boundaryRelease: "2026-05-uk-bgc" };

const crosswalk = {
	id: "ward-2024-12-to-2026-05-official-lookup",
	from: FROM,
	to: TO,
	method: "official-lookup",
	artifact: "crosswalks/ward-2024-12-to-2026-05.json",
} as Crosswalk;
const lookup = {
	id: "crosswalk-ward-2024-12-to-2026-05",
	kind: "crosswalk",
	source: { artifact: crosswalk.artifact },
	formats: { csv: { href: "/v1/lookups/x.csv", bytes: 100 } },
} as BulkLookup;

const LOOKUP_CSV = [
	"sourceCode,targetCode,targetLabels",
	"E05013408,E05016249,Brinkworth",
	"E05013446,E05016253,Alpha",
	"E05013446,E05016254,Beta",
].join("\n");

const run = () =>
	runCheck({ table, area: 0, kind: "code", parent: null, release: null });

beforeEach(() => {
	vi.resetAllMocks();
	vi.mocked(api.boundaryReleases).mockResolvedValue(releases);
	vi.mocked(api.validateInferred).mockResolvedValue(inferred);
	vi.mocked(api.validateAgainst).mockResolvedValue(latest);
	vi.mocked(api.areaHistory).mockImplementation(async (_from, code) =>
		history(code),
	);
	vi.mocked(api.crosswalks).mockResolvedValue([crosswalk]);
	vi.mocked(api.bulkLookups).mockResolvedValue([lookup]);
	vi.mocked(api.lookupCsv).mockResolvedValue(LOOKUP_CSV);
});

describe("runCheck successors", () => {
	it("reads what retired codes became from an official lookup, in one download", async () => {
		const { diagnosis } = await run();
		expect(api.lookupCsv).toHaveBeenCalledTimes(1);
		// Only the codes the lookup lacks need their history read.
		const read = vi.mocked(api.areaHistory).mock.calls.map((c) => c[1]);
		expect(read).not.toContain("E05013408");
		expect(read).not.toContain("E05013446");
		const split = diagnosis.results.find((r) => r.value === "E05013446");
		expect(split?.successors?.map((s) => s.code)).toEqual([
			"E05016253",
			"E05016254",
		]);
		expect(diagnosis.findings.map((f) => f.id)).not.toContain("unchecked");
	});

	it("reads history for codes the lookup does not hold", async () => {
		vi.mocked(api.lookupCsv).mockResolvedValue(
			"sourceCode,targetCode,targetLabels\n",
		);
		const { diagnosis } = await run();
		const read = vi.mocked(api.areaHistory).mock.calls.map((c) => c[1]);
		expect(read).toContain("E05013408");
		const moved = diagnosis.results.find((r) => r.value === "E05013408");
		expect(moved?.successors?.map((s) => s.code)).toEqual(["E05016249"]);
	});

	it("falls back to history when the lookup cannot be read", async () => {
		vi.mocked(api.lookupCsv).mockRejectedValue(
			new api.ApiError("down", 502),
		);
		const { diagnosis } = await run();
		expect(vi.mocked(api.areaHistory).mock.calls.length).toBeGreaterThan(0);
		const moved = diagnosis.results.find((r) => r.value === "E05013408");
		expect(moved?.successors?.map((s) => s.code)).toEqual(["E05016249"]);
	});

	it("does not download a lookup when none covers the release", async () => {
		vi.mocked(api.crosswalks).mockResolvedValue([]);
		await run();
		expect(api.lookupCsv).not.toHaveBeenCalled();
	});
});
