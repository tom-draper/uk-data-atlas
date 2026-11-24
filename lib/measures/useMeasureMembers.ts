"use client";

import { useMemo } from "react";
import { MeasureQueryError } from "./client";
import { loadMeasureValues } from "./cache";
import { measureValuesUrl } from "./request";
import type { MeasureValuesPayload, MeasureValuesRequest } from "./types";
import { useAreaFilter } from "./useAreaFilter";
import { useLoaded } from "./useLoaded";

export type MeasureMembersState =
	| { status: "idle" }
	| { status: "loading" }
	| { status: "ready"; payloads: Record<string, MeasureValuesPayload> }
	| { status: "error"; error: Error };

/**
 * A measure's values for several members of one dimension. The route answers
 * for one member at a time, so this reads each, for every area of the source
 * and through the shared cache, then cuts them down to `request.areas`. A
 * member the route does not hold is left out rather than failing the rest.
 * Pass null to read nothing.
 */
export function useMeasureMembers(
	request: Omit<MeasureValuesRequest, "dimensions"> | null,
	dimension: string,
	members: readonly string[],
): MeasureMembersState {
	const { areas, ...whole } = request ?? { measure: "" };
	const requests = request
		? members.map((member) => ({
				member,
				query: { ...whole, dimensions: { [dimension]: [member] } },
			}))
		: [];
	const load = async () => {
		const settled = await Promise.allSettled(
			requests.map(
				async ({ member, query }) =>
					[member, await loadMeasureValues(query)] as const,
			),
		);
		const entries: Array<readonly [string, MeasureValuesPayload]> = [];
		let missing: MeasureQueryError | undefined;
		for (const one of settled) {
			if (one.status === "fulfilled") entries.push(one.value);
			else if (
				one.reason instanceof MeasureQueryError &&
				one.reason.status === 404
			)
				missing ??= one.reason;
			else throw one.reason;
		}
		if (entries.length === 0 && missing) throw missing;
		return Object.fromEntries(entries);
	};
	const loaded = useLoaded(
		requests.length
			? {
					key: JSON.stringify(
						requests.map(({ query }) => measureValuesUrl(query)),
					),
					load,
				}
			: null,
	);
	const filter = useAreaFilter(areas);
	return useMemo(() => {
		if (loaded.status !== "ready") return loaded;
		return {
			status: "ready",
			payloads: filter
				? Object.fromEntries(
						Object.entries(loaded.value).map(
							([member, payload]) => [member, filter(payload)],
						),
					)
				: loaded.value,
		};
	}, [loaded, filter]);
}
