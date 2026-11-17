"use client";

import { useEffect, useState } from "react";
import { fetchMeasureValues } from "./client";
import { measureValuesUrl } from "./request";
import type { MeasureValuesPayload, MeasureValuesRequest } from "./types";

export type MeasureMembersState =
	| { status: "idle" }
	| { status: "loading" }
	| { status: "ready"; payloads: Record<string, MeasureValuesPayload> }
	| { status: "error"; error: Error };

/**
 * A measure's values for several members of one dimension. The route answers
 * for one member at a time, so this asks for each at once and gathers the
 * answers by member code. Identified by the URLs it writes, so an equal
 * request made again does not refetch. Pass null to read nothing.
 */
export function useMeasureMembers(
	request: Omit<MeasureValuesRequest, "dimensions"> | null,
	dimension: string,
	members: readonly string[],
): MeasureMembersState {
	const requests = request
		? members.map((member) => ({
				...request,
				dimensions: { [dimension]: [member] },
			}))
		: [];
	const key = requests.map(measureValuesUrl).join(" ");
	const [result, setResult] = useState<{
		key: string;
		state: MeasureMembersState;
	}>();

	useEffect(() => {
		if (!key) return;
		const controller = new AbortController();
		Promise.all(
			requests.map((one) =>
				fetchMeasureValues(one, { signal: controller.signal }),
			),
		)
			.then((payloads) =>
				setResult({
					key,
					state: {
						status: "ready",
						payloads: Object.fromEntries(
							members.map((member, index) => [
								member,
								payloads[index]!,
							]),
						),
					},
				}),
			)
			.catch((error: unknown) => {
				if (controller.signal.aborted) return;
				setResult({
					key,
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
		// The URLs name the requests, so equal requests do not refetch.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [key]);

	if (!key) return { status: "idle" };
	return result?.key === key ? result.state : { status: "loading" };
}
