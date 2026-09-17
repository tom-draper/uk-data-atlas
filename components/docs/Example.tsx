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

/** A request written for a guide, in every sample language. */
export function Request({ url }: { url: string }) {
	return (
		<div className="my-5">
			<RequestSamples samples={requestSamples(url)} />
		</div>
	);
}
