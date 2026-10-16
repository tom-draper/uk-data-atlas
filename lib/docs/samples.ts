import {
	API_BASE_URL,
	API_ORIGIN,
	type DocsOperation,
	type DocsRequestBody,
} from "./openapi";

/**
 * Ready-to-run request samples in the languages the docs offer, built from a
 * request URL so every sample on a page asks exactly the same question.
 */

export type SampleLanguage = "curl" | "javascript" | "python";

export interface CodeSample {
	language: SampleLanguage;
	label: string;
	code: string;
}

/** How a response should be read: the JSON envelope, other JSON, text or bytes. */
export type ResponseKind = "envelope" | "json" | "text" | "binary";

const SAMPLE_LABELS: Record<SampleLanguage, string> = {
	curl: "cURL",
	javascript: "JavaScript",
	python: "Python",
};

function splitUrl(url: string): { base: string; params: [string, string][] } {
	const [base, query = ""] = url.split(/\?(.*)/);
	const params = query
		.split("&")
		.filter(Boolean)
		.map((pair): [string, string] => {
			const [key, value = ""] = pair.split(/=(.*)/);
			return [decode(key), decode(value)];
		});
	return { base, params };
}

function decode(value: string): string {
	try {
		return decodeURIComponent(value.replace(/\+/g, " "));
	} catch {
		return value;
	}
}

function pythonString(value: string): string {
	return JSON.stringify(value);
}

function pythonParams(params: [string, string][]): string {
	const grouped = new Map<string, string[]>();
	for (const [key, value] of params) {
		grouped.set(key, [...(grouped.get(key) ?? []), value]);
	}
	const lines = [...grouped].map(([key, values]) => {
		const value =
			values.length === 1
				? pythonString(values[0])
				: `[${values.map(pythonString).join(", ")}]`;
		return `        ${pythonString(key)}: ${value},`;
	});
	return `{\n${lines.join("\n")}\n    }`;
}

const isJson = (body: DocsRequestBody) =>
	body.contentType === "application/json";

/** A parsed JSON value written as Python, where `null` is `None`. */
function pythonLiteral(value: unknown, indent = "    "): string {
	if (value === null) return "None";
	if (value === true) return "True";
	if (value === false) return "False";
	if (Array.isArray(value)) {
		return `[${value.map((item) => pythonLiteral(item, indent)).join(", ")}]`;
	}
	if (typeof value === "object") {
		const inner = `${indent}    `;
		const lines = Object.entries(value).map(
			([key, item]) =>
				`${inner}${pythonString(key)}: ${pythonLiteral(item, inner)},`,
		);
		return `{\n${lines.join("\n")}\n${indent}}`;
	}
	return JSON.stringify(value);
}

function javascriptBody(body: DocsRequestBody): string {
	const payload = isJson(body)
		? `JSON.stringify(${JSON.stringify(JSON.parse(body.example), null, 2).replace(/\n/g, "\n  ")})`
		: JSON.stringify(body.example);
	return `{\n  method: "POST",\n  headers: { "Content-Type": ${JSON.stringify(body.contentType)} },\n  body: ${payload},\n}`;
}

function javascriptSample(
	url: string,
	kind: ResponseKind,
	body?: DocsRequestBody,
): string {
	const request = body
		? `const response = await fetch(${JSON.stringify(url)}, ${javascriptBody(body)});`
		: `const response = await fetch(\n  ${JSON.stringify(url)},\n);`;
	switch (kind) {
		case "envelope":
			return `${request}\nconst { data } = await response.json();\n\nconsole.log(data);`;
		case "json":
			return `${request}\nconst body = await response.json();`;
		case "text":
			return `${request}\nconst text = await response.text();`;
		case "binary":
			return `${request}\nconst bytes = await response.arrayBuffer();`;
	}
}

function pythonSample(
	url: string,
	kind: ResponseKind,
	body?: DocsRequestBody,
): string {
	const { base, params } = splitUrl(url);
	const args = [
		pythonString(base),
		...(params.length > 0 ? [`params=${pythonParams(params)}`] : []),
		...(body
			? isJson(body)
				? [`json=${pythonLiteral(JSON.parse(body.example))}`]
				: [
						`data=${pythonString(body.example)}`,
						`headers={"Content-Type": ${pythonString(body.contentType)}}`,
					]
			: []),
	];
	const method = body ? "post" : "get";
	const call =
		args.length > 1
			? `response = requests.${method}(\n${args.map((arg) => `    ${arg},`).join("\n")}\n)`
			: `response = requests.${method}(${args[0]})`;
	const read = {
		envelope: 'data = response.json()["data"]\n\nprint(data)',
		json: "body = response.json()",
		text: "text = response.text",
		binary: "content = response.content",
	}[kind];
	return `import requests\n\n${call}\nresponse.raise_for_status()\n${read}`;
}

function curlSample(url: string, body?: DocsRequestBody): string {
	if (!body) return `curl "${url}"`;
	// A shell single-quoted string ends at a quote, so close and reopen it.
	const data = body.example.replace(/'/g, `'\\''`);
	return `curl -X POST "${url}" \\\n  -H "Content-Type: ${body.contentType}" \\\n  --data '${data}'`;
}

/** Samples for a request; with a `body`, it is POSTed as written. */
export function requestSamples(
	url: string,
	kind: ResponseKind = "envelope",
	body?: DocsRequestBody,
): CodeSample[] {
	return [
		{
			language: "curl",
			label: SAMPLE_LABELS.curl,
			code: curlSample(url, body),
		},
		{
			language: "javascript",
			label: SAMPLE_LABELS.javascript,
			code: javascriptSample(url, kind, body),
		},
		{
			language: "python",
			label: SAMPLE_LABELS.python,
			code: pythonSample(url, kind, body),
		},
	];
}

/** How an operation's success response is read, given the URL asked for. */
export function responseKind(
	operation: DocsOperation,
	url: string,
): ResponseKind {
	const format = /[?&]format=(\w+)/.exec(url)?.[1];
	if (format === "csv" || format === "ndjson") return "text";
	const success = operation.responses.find((r) => r.status.startsWith("2"));
	const types = success?.contentTypes ?? [];
	if (types.includes("application/json")) {
		// The spec says so in words where a JSON body is served bare.
		return /not wrapped in the usual API envelope/.test(
			operation.description,
		)
			? "json"
			: "envelope";
	}
	if (
		types.some((type) => type.startsWith("text/") || type.includes("yaml"))
	) {
		return "text";
	}
	return types.length > 0 ? "binary" : "envelope";
}

export interface OperationExample {
	url: string;
	samples: CodeSample[];
	response: { status: string; body: string; isJson: boolean } | null;
}

/**
 * The spec's worked example for an operation: its request in every language
 * and the response it gives. Without one, the bare route with its required
 * query parameters as placeholders.
 */
export function operationExample(operation: DocsOperation): OperationExample {
	const worked = operation.responses.find((r) => r.exampleRequest);
	const query = operation.parameters
		.filter((p) => p.location === "query" && p.required)
		.map((p) => `${p.name}={${p.name}}`)
		.join("&");
	const url = worked?.exampleRequest
		? `${API_ORIGIN}${worked.exampleRequest}`
		: `${API_BASE_URL}${operation.path}${query ? `?${query}` : ""}`;
	const answered = operation.responses.find((r) => r.example);

	return {
		url,
		samples: requestSamples(
			url,
			responseKind(operation, url),
			operation.requestBody ?? undefined,
		),
		response: answered?.example
			? {
					status: answered.status,
					body: answered.example,
					isJson: /^\s*[[{]/.test(answered.example),
				}
			: null,
	};
}
