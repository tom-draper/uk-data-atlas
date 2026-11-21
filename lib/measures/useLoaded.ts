"use client";

import { useEffect, useState } from "react";

export type Loaded<T> =
	| { status: "idle" }
	| { status: "loading" }
	| { status: "ready"; value: T }
	| { status: "error"; error: Error };

// Shared, so a caller sees the same object on every render while nothing has
// changed and its memoised work holds. This file is not compiled by the React
// Compiler (see the eslint comment below), so nothing else would keep it.
const IDLE = { status: "idle" } as const;
const LOADING = { status: "loading" } as const;

/**
 * The result of `load`, read again when `key` changes. Null reads nothing.
 * Nothing is cancelled: the loads are shared, so another card may still want
 * an answer this one has stopped waiting for.
 */
export function useLoaded<T>(
	key: string | null,
	load: () => Promise<T>,
): Loaded<T> {
	const [result, setResult] = useState<{ key: string; state: Loaded<T> }>();
	useEffect(() => {
		if (!key) return;
		let current = true;
		load().then(
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
		// The key names what is loaded.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [key]);
	if (!key) return IDLE;
	return result?.key === key ? result.state : LOADING;
}
