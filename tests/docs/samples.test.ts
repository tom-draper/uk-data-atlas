import { findOperationById, loadApiContract } from "@/lib/docs/openapi";
import {
	operationExample,
	requestSamples,
	responseKind,
} from "@/lib/docs/samples";

describe("requestSamples", () => {
	const url =
		"https://api.ukdataatlas.com/v1/areas:validate?geography=localAuthority&value=Bristol&value=North%20West";
	const [curl, javascript, python] = requestSamples(url);

	it("asks the same question in every language", () => {
		expect(curl.code).toBe(`curl "${url}"`);
		expect(javascript.code).toContain(JSON.stringify(url));
	});

	it("reads the envelope's data", () => {
		expect(javascript.code).toContain(
			"const { data } = await response.json();",
		);
		expect(python.code).toContain('data = response.json()["data"]');
	});

	it("gives Python readable, decoded params and keeps repeated ones", () => {
		expect(python.code).toContain(
			'"https://api.ukdataatlas.com/v1/areas:validate"',
		);
		expect(python.code).toContain('"geography": "localAuthority",');
		expect(python.code).toContain('"value": ["Bristol", "North West"],');
	});

	it("reads a table as text", () => {
		const [, js, py] = requestSamples("https://x/v1/lookups/a", "text");
		expect(js.code).toContain("await response.text()");
		expect(py.code).toContain("text = response.text");
		expect(py.code).toContain('requests.get("https://x/v1/lookups/a")');
	});
});

describe("operationExample", () => {
	const contract = loadApiContract();

	it("uses the spec's worked request and response", () => {
		const example = operationExample(
			findOperationById(contract, "resolvePlaces"),
		);
		expect(example.url).toBe(
			"https://api.ukdataatlas.com/v1/places?q=Bristol",
		);
		expect(example.response?.status).toBe("200");
		expect(example.response?.isJson).toBe(true);
	});

	it("falls back to the route with placeholders for required parameters", () => {
		const example = operationExample(
			findOperationById(contract, "getMapResourceTile"),
		);
		expect(example.url).toBe(
			"https://api.ukdataatlas.com/v1/map-resources/{geography}/{release}/tiles/{z}/{x}/{y}.mvt",
		);
		expect(example.response).toBeNull();
	});

	it("reads each kind of response the way it is served", () => {
		const kind = (id: string, url = "") =>
			responseKind(findOperationById(contract, id), url);
		expect(kind("resolvePlaces")).toBe("envelope");
		expect(kind("downloadBulkExport")).toBe("json");
		expect(kind("getOpenapiDescription")).toBe("text");
		expect(kind("getMapResourceTile")).toBe("binary");
		expect(kind("downloadBulkLookup", "?format=csv")).toBe("text");
	});
});
