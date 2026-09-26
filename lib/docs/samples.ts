import { API_BASE_URL, API_ORIGIN, type DocsOperation } from "./openapi";

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

function javascriptSample(url: string, kind: ResponseKind): string {
	const request = `const response = await fetch(\n  ${JSON.stringify(url)},\n);`;
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

function pythonSample(url: string, kind: ResponseKind): string {
	const { base, params } = splitUrl(url);
	const call =
		params.length > 0
			? `response = requests.get(\n    ${pythonString(base)},\n    params=${pythonParams(params)},\n)`
			: `response = requests.get(${pythonString(base)})`;
	const read = {
		envelope: 'data = response.json()["data"]\n\nprint(data)',
		json: "body = response.json()",
		text: "text = response.text",
		binary: "content = response.content",
	}[kind];
	return `import requests\n\n${call}\nresponse.raise_for_status()\n${read}`;
}

export function requestSamples(
	url: string,
	kind: ResponseKind = "envelope",
): CodeSample[] {
	return [
		{ language: "curl", label: SAMPLE_LABELS.curl, code: `curl "${url}"` },
		{
			language: "javascript",
			label: SAMPLE_LABELS.javascript,
			code: javascriptSample(url, kind),
		},
		{
			language: "python",
			label: SAMPLE_LABELS.python,
			code: pythonSample(url, kind),
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
		samples: requestSamples(url, responseKind(operation, url)),
		response: answered?.example
			? {
					status: answered.status,
					body: answered.example,
					isJson: /^\s*[[{]/.test(answered.example),
				}
			: null,
	};
}
