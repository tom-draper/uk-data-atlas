import CodePanel, { RequestSamples } from "./CodePanel";
import { findOperationById, loadApiContract } from "@/lib/docs/openapi";
import { operationExample, requestSamples } from "@/lib/docs/samples";

/** An endpoint's worked example from the spec: the request, then its response. */
export function SpecExample({
	id,
	showResponse = true,
}: {
	id: string;
	showResponse?: boolean;
}) {
	const example = operationExample(findOperationById(loadApiContract(), id));
	return (
		<div className="my-5 space-y-3">
			<RequestSamples samples={example.samples} />
			{showResponse && example.response && (
				<CodePanel
					title="Response"
					language={example.response.isJson ? "json" : "text"}
					code={example.response.body}
					maxHeight="280px"
					badge={
						<span className="font-mono text-[10.5px] text-emerald-300/90">
							{example.response.status}
						</span>
					}
				/>
			)}
		</div>
	);
}

/** A request written for a guide, optionally paired with its spec example response. */
export function Request({
	url,
	operationId,
}: {
	url: string;
	operationId?: string;
}) {
	const response = operationId
		? operationExample(findOperationById(loadApiContract(), operationId))
				.response
		: null;

	return (
		<div className="my-5 space-y-3">
			<RequestSamples samples={requestSamples(url)} />
			{response && (
				<CodePanel
					title="Example response"
					language={response.isJson ? "json" : "text"}
					code={response.body}
					maxHeight="280px"
					badge={
						<span className="font-mono text-[10.5px] text-emerald-300/90">
							{response.status}
						</span>
					}
				/>
			)}
		</div>
	);
}
