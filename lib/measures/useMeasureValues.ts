"use client";

import { useEffect, useState } from "react";
import { fetchMeasureValues, MeasureQueryError } from "./client";
import { measureValuesUrl } from "./request";
import type { MeasureValuesPayload, MeasureValuesRequest } from "./types";

export type MeasureValuesState =
	| { status: "idle" }
	| { status: "loading" }
	| { status: "ready"; data: MeasureValuesPayload }
	| { status: "error"; error: MeasureQueryError | Error };

/**
 * The values of a measure, fetched when the request changes. A request is
 * identified by the URL it writes, so an equal request made again does not
 * refetch. Pass null to read nothing.
 */
export function useMeasureValues(
	request: MeasureValuesRequest | null,
): MeasureValuesState {
	const url = request ? measureValuesUrl(request) : null;
	const [result, setResult] = useState<{
		url: string;
		state: MeasureValuesState;
	}>();

	useEffect(() => {
		if (!request || !url) return;
		const controller = new AbortController();
		fetchMeasureValues(request, { signal: controller.signal })
			.then((data) =>
				setResult({ url, state: { status: "ready", data } }),
			)
			.catch((error: unknown) => {
				if (controller.signal.aborted) return;
				setResult({
					url,
					state: {
						status: "error",
						error:
							error instanceof Error
								? error
								: new Error("The measure could not be read."),
					},
				});
			});
		return () => controller.abort();
		// The URL names the request, so an equal request does not refetch.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [url]);

	if (!url) return { status: "idle" };
	return result?.url === url ? result.state : { status: "loading" };
}
