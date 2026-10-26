import { frontDoorExamples, type FrontDoorExample } from "./frontDoor";
import {
	CONCEPTS,
	endpointContent,
	GET_STARTED,
	GUIDES,
	USING_THE_API,
	type NavLink,
} from "./navigation";
import { API_BASE_URL, type ApiContract } from "./openapi";

/**
 * `llms.txt` and `llms-full.txt` in the llmstxt.org format, built from the
 * docs' own navigation, the front-door examples and the spec, so the files
 * list what the site lists. Served from the website root.
 */

const SUMMARY =
	"A read-only HTTP API for UK statistical geography: boundaries across releases, how areas have changed, postcodes, named places and measure values from open data. It is in early access, so routes and responses may still change.";

const NOTES = [
	`Base URL: ${API_BASE_URL}. Every request below is a plain GET unless it says otherwise; no key is needed.`,
	"A successful JSON response wraps its result in `data`, with `atlasRelease` naming the exact build that produced it. Failures are problem documents with a stable `code`.",
];

/** Markdown links, `code` and bold marks removed, for a plain-text summary. */
function plain(text: string): string {
	return text.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").replace(/[`*]/g, "");
}

function firstSentence(text: string): string {
	return /^[\s\S]*?[.!?](?=\s|$)/.exec(plain(text))?.[0] ?? plain(text);
}

function pageLinks(site: string, links: NavLink[]): string[] {
	return links.map((link) => `- [${link.title}](${site}${link.href})`);
}

function routeLine(site: string, example: FrontDoorExample): string {
	const { operation, route } = example;
	const title = endpointContent(operation).title;
	return `- [${title}](${site}${example.href}): ${route.question} \`${example.curl}\``;
}

export function buildLlmsTxt(contract: ApiContract, site: string): string {
	const examples = frontDoorExamples(contract);
	return [
		`# ${contract.title}`,
		`> ${SUMMARY}`,
		...NOTES,
		"## Docs",
		[
			`- [OpenAPI description](${API_BASE_URL}/openapi.yaml): the contract, as OpenAPI 3.1 YAML`,
			`- [Front door in full](${site}/llms-full.txt): every front-door route below with its parameters and an example`,
			...pageLinks(site, GET_STARTED),
			...pageLinks(site, USING_THE_API),
		].join("\n"),
		"## Front door",
		examples.map((example) => routeLine(site, example)).join("\n"),
		"## Optional",
		[
			`- [API reference](${site}/docs/v1/reference): every route, generated from the spec`,
			...pageLinks(site, CONCEPTS),
			...pageLinks(site, GUIDES),
		].join("\n"),
	]
		.join("\n\n")
		.concat("\n");
}

export function buildLlmsFullTxt(contract: ApiContract, site: string): string {
	const routes = frontDoorExamples(contract).map((example) => {
		const { operation, route } = example;
		const content = endpointContent(operation);
		const parameters = operation.parameters.map(
			(p) =>
				`- \`${p.name}\` (${p.location}${p.required ? ", required" : ""}): ${firstSentence(p.description)}`,
		);
		return [
			`### ${content.title}`,
			`\`${operation.method.toUpperCase()} ${API_BASE_URL}${operation.path}\`. Docs: ${site}${example.href}`,
			plain(content.intro),
			...(content.tips
				? content.tips.map((tip) => `- ${plain(tip)}`)
				: []),
			...(parameters.length > 0
				? ["Parameters:", parameters.join("\n")]
				: []),
			`${route.question}\n\n\`\`\`sh\n${example.samples[0].code}\n\`\`\``,
		].join("\n\n");
	});
	return [
		buildLlmsTxt(contract, site).trimEnd(),
		"## Front door in full",
		routes.join("\n\n"),
	]
		.join("\n\n")
		.concat("\n");
}
