"use client";

import { useMemo } from "react";
import { MeasureQueryError } from "./client";
import { loadMeasureValues, restrictToAreas } from "./cache";
import { measureValuesUrl } from "./request";
import type { MeasureValuesPayload, MeasureValuesRequest } from "./types";
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
				...whole,
				dimensions: { [dimension]: [member] },
			}))
		: [];
	const key = requests.length
		? requests.map(measureValuesUrl).join(" ")
		: null;
	const loaded = useLoaded(key, async () => {
		const settled = await Promise.allSettled(
			requests.map(loadMeasureValues),
		);
		const payloads: Record<string, MeasureValuesPayload> = {};
		let failure: unknown;
		settled.forEach((one, index) => {
			if (one.status === "fulfilled")
				payloads[members[index]!] = one.value;
			else if (
				!(one.reason instanceof MeasureQueryError) ||
				one.reason.status !== 404
			)
				failure ??= one.reason;
		});
		if (failure) throw failure;
		if (Object.keys(payloads).length === 0)
			throw (settled[0] as PromiseRejectedResult).reason;
		return payloads;
	});
	const areasKey = areas ? areas.join(",") : null;
	const all = loaded.status === "ready" ? loaded.value : null;
	const payloads = useMemo(
		() =>
			all && areasKey !== null
				? Object.fromEntries(
						Object.entries(all).map(([member, payload]) => [
							member,
							restrictToAreas(payload, areas!),
						]),
					)
				: all,
		// The areas are named by their key.
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[all, areasKey],
	);
	if (loaded.status !== "ready") return loaded;
	return { status: "ready", payloads: payloads! };
}
