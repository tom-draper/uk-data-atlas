import { parse } from "yaml";

/**
 * The human documentation landing page, rendered from the OpenAPI description
 * the server already serves rather than written beside it.
 *
 * Everything on the page is read from that document: the endpoint chooser,
 * the glossary and the quick starts from its `x-` extensions, and each
 * operation's summary and most likely refusal from its paths. The page cannot
 * describe a route the contract does not, and the contract tests that hold the
 * document to the server hold the page to it too.
 */

type Refusal = {
	status?: number;
	code?: string;
	when: string;
	"x-example-request"?: string;
};

type Operation = {
	operationId: string;
	tags: string[];
	summary: string;
	deprecated?: boolean;
	"x-likely-refusal": Refusal;
};

export type QuickStartStep = {
	title: string;
	explain: string;
	request: string;
	/** The status the step answers with, when it is a deliberate refusal. */
	status?: number;
};

export type QuickStart = {
	id: string;
	title: string;
	audience: string;
	promise: string;
	steps: QuickStartStep[];
};

export type OpenApiGuide = {
	info: { title: string; description: string };
	servers: Array<{ url: string }>;
	tags: Array<{ name: string; description: string }>;
	paths: Record<string, { get?: Operation }>;
	"x-glossary": Array<{ term: string; meaning: string }>;
	"x-endpoint-chooser": Array<{ need: string; start: string[] }>;
	"x-quick-starts": QuickStart[];
};

const escape = (text: string) =>
	text
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;");

/** The inline Markdown the document's prose uses: code spans and bold. */
const inline = (text: string) =>
	escape(text)
		.replace(/`([^`]+)`/g, "<code>$1</code>")
		.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");

const paragraphs = (text: string) =>
	text
		.trim()
		.split(/\n\s*\n/)
		.map((block) => `<p>${inline(block.replace(/\s*\n\s*/g, " "))}</p>`)
		.join("\n");

/**
 * A route template as the index writes it. It is not linked: most routes
 * refuse a request without their parameters, and the requests worth
 * following are the quick starts and each refusal's example.
 */
const route = (path: string) =>
	`<code>${escape(path.startsWith("/v1") ? path : `/v1${path === "/" ? "" : path}`)}</code>`;

const STYLE = `
:root {
	color-scheme: light dark;
	--bg: #fbfaf7;
	--fg: #1d1c1a;
	--muted: #5d5a54;
	--rule: #e3e0d8;
	--panel: #f2efe8;
	--accent: #0b5d8f;
	--refusal: #9a3412;
}
@media (prefers-color-scheme: dark) {
	:root {
		--bg: #151515;
		--fg: #ebe8e1;
		--muted: #a8a49b;
		--rule: #33312d;
		--panel: #1f1e1c;
		--accent: #6cb6e8;
		--refusal: #f0a57a;
	}
}
* { box-sizing: border-box; }
body {
	margin: 0;
	background: var(--bg);
	color: var(--fg);
	font: 16px/1.6 system-ui, -apple-system, "Segoe UI", sans-serif;
}
main { max-width: 56rem; margin: 0 auto; padding: 2.5rem 16px 4rem; }
h1 { font-size: 2rem; line-height: 1.2; margin: 0 0 0.5rem; }
h2 { font-size: 1.4rem; margin: 3rem 0 1rem; padding-top: 1rem; border-top: 1px solid var(--rule); }
h3 { font-size: 1.1rem; margin: 2rem 0 0.5rem; }
a { color: var(--accent); }
code { font: 0.9em/1.4 ui-monospace, SFMono-Regular, Menlo, monospace; overflow-wrap: anywhere; }
pre { background: var(--panel); padding: 0.75rem 1rem; border-radius: 6px; overflow-x: auto; margin: 0.5rem 0 0; }
pre code { overflow-wrap: normal; }
.lead { color: var(--muted); }
.meta { color: var(--muted); font-size: 0.9rem; }
nav ul { list-style: none; padding: 0; display: flex; flex-wrap: wrap; gap: 0.25rem 1.25rem; }
table { border-collapse: collapse; width: 100%; }
.scroll { overflow-x: auto; }
th, td { text-align: left; vertical-align: top; padding: 0.5rem 0.75rem 0.5rem 0; border-bottom: 1px solid var(--rule); }
th { font-weight: 600; }
td code { display: inline-block; margin: 0 0.5rem 0.25rem 0; }
dl { display: grid; grid-template-columns: minmax(8rem, 14rem) 1fr; gap: 0.5rem 1.5rem; }
dt { font-weight: 600; }
dd { margin: 0; }
@media (max-width: 40rem) { dl { grid-template-columns: 1fr; } dd { margin-bottom: 0.75rem; } }
ol.steps { padding-left: 1.25rem; }
ol.steps > li { margin-bottom: 1.25rem; }
.expect { color: var(--refusal); font-size: 0.9rem; }
.operation { padding: 0.75rem 0; border-bottom: 1px solid var(--rule); }
.operation p { margin: 0.25rem 0 0; }
.refusal { color: var(--muted); font-size: 0.95rem; }
.refusal strong { color: var(--refusal); font-weight: 600; }
`;

export const renderDocsPage = (
	document: OpenApiGuide,
	atlasRelease: string,
): string => {
	const origin = document.servers[0]?.url.replace(/\/v1\/?$/, "") ?? "";
	const operations = Object.entries(document.paths).flatMap(([path, item]) =>
		item.get ? [{ path, operation: item.get }] : [],
	);
	const [lead] = document.info.description.trim().split(/\n\s*\n/);

	const chooser = document["x-endpoint-chooser"]
		.map(
			(row) =>
				`<tr><td>${inline(row.need)}</td><td>${row.start.map(route).join(" ")}</td></tr>`,
		)
		.join("\n");

	const glossary = document["x-glossary"]
		.map((entry) => `<dt>${escape(entry.term)}</dt><dd>${inline(entry.meaning)}</dd>`)
		.join("\n");

	const quickStarts = document["x-quick-starts"]
		.map(
			(guide) => `<section id="${escape(guide.id)}">
<h3>${escape(guide.title)}</h3>
<p><strong>${escape(guide.audience)}.</strong> ${inline(guide.promise)}</p>
<ol class="steps">
${guide.steps
	.map(
		(step) => `<li><strong>${escape(step.title)}.</strong> ${inline(step.explain)}
${step.status ? `<div class="expect">Answers ${step.status}, deliberately.</div>` : ""}
<pre><code>curl -sS '${escape(origin + step.request)}'</code></pre>
<a href="${escape(step.request)}">Open</a></li>`,
	)
	.join("\n")}
</ol>
</section>`,
		)
		.join("\n");

	const byTask = document.tags
		.map((tag) => {
			const tagged = operations.filter(({ operation }) =>
				operation.tags.includes(tag.name),
			);
			return `<section id="task-${escape(tag.name.toLowerCase().replaceAll(" ", "-"))}">
<h3>${escape(tag.name)}</h3>
<p class="lead">${inline(tag.description)}</p>
${tagged
	.map(({ path, operation }) => {
		const refusal = operation["x-likely-refusal"];
		const example = refusal["x-example-request"];
		const heading = refusal.status
			? `<strong>${refusal.status}${refusal.code ? ` ${escape(refusal.code)}` : ""}</strong> `
			: "";
		return `<div class="operation" id="${escape(operation.operationId)}">
<div>GET ${route(path)}${operation.deprecated ? " (deprecated)" : ""}</div>
<p>${inline(operation.summary)}</p>
<p class="refusal">Most likely refusal: ${heading}${inline(refusal.when)}${example ? ` <a href="${escape(example)}">See it</a>.` : ""}</p>
</div>`;
	})
	.join("\n")}
</section>`;
		})
		.join("\n");

	return `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(document.info.title)}</title>
<style>${STYLE}</style>
</head>
<body>
<main>
<h1>${escape(document.info.title)}</h1>
<div class="lead">${paragraphs(lead ?? "")}</div>
<p class="meta">Served from Atlas release <code>${escape(atlasRelease)}</code>. The binding contract is <a href="/v1/openapi.yaml">the OpenAPI description</a>, which this page is rendered from; <a href="/v1">the index</a> lists every route.</p>
<nav><ul>
<li><a href="#start-here">Start here</a></li>
<li><a href="#glossary">Glossary</a></li>
<li><a href="#quick-starts">Quick starts</a></li>
<li><a href="#operations">Operations by task</a></li>
</ul></nav>

<h2 id="start-here">Start here</h2>
<p>Begin from the job, not the route.</p>
<div class="scroll"><table>
<thead><tr><th>I need to…</th><th>Start here</th></tr></thead>
<tbody>
${chooser}
</tbody>
</table></div>

<h2 id="glossary">Glossary</h2>
<p>A data response carries several identities, and they are deliberately kept apart.</p>
<dl>
${glossary}
</dl>

<h2 id="quick-starts">Quick starts</h2>
<p>Each is a sequence of real requests, run against the server as a contract test on every build. A step that is refused is refused on purpose, to show what the API will not do.</p>
${quickStarts}

<h2 id="operations">Operations by task</h2>
<p>Every operation, with the refusal a client is most likely to meet first. Any operation may also answer <code>429</code> when a client has spent its requests, with <code>Retry-After</code>.</p>
${byTask}
</main>
</body>
</html>
`;
};

let rendered: { key: string; html: string } | undefined;

/** The page for a document and release, rendered once and then reused. */
export const docsPage = (openapiDocument: string, atlasRelease: string) => {
	const key = `${atlasRelease}\n${openapiDocument}`;
	if (rendered?.key !== key)
		rendered = {
			key,
			html: renderDocsPage(parse(openapiDocument) as OpenApiGuide, atlasRelease),
		};
	return rendered.html;
};
