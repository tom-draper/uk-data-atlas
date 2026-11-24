"use client";

import { useEffect, useEffectEvent, useState } from "react";

export type Loaded<T> =
	| { status: "idle" }
	| { status: "loading" }
	| { status: "ready"; value: T }
	| { status: "error"; error: Error };

// Keep the result stable while idle or waiting for an answer.
const IDLE = { status: "idle" } as const;
const LOADING = { status: "loading" } as const;

/**
 * Read once per request key. Null reads nothing.
 * Nothing is cancelled: the loads are shared, so another card may still want
 * an answer this one has stopped waiting for.
 */
export function useLoaded<T>(
	request: { key: string; load: () => Promise<T> } | null,
): Loaded<T> {
	const key = request?.key;
	const load = useEffectEvent(() => request?.load());
	const [result, setResult] = useState<{ key: string; state: Loaded<T> }>();
	useEffect(() => {
		if (!key) return;
		let current = true;
		load()?.then(
			(value) => {
				if (current)
					setResult({ key, state: { status: "ready", value } });
			},
			(error: unknown) => {
				if (current)
					setResult({
						key,
						state: {
							status: "error",
							error:
								error instanceof Error
									? error
									: new Error(
											"The measure could not be read.",
										),
						},
					});
			},
		);
		return () => {
			current = false;
		};
	}, [key]);
	if (!key) return IDLE;
	return result?.key === key ? result.state : LOADING;
}
