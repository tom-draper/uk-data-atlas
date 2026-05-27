import { useState, useEffect, useRef } from "react";

export function useDataLoader<T>(
	loader: () => Promise<Record<string, T>>,
	enabled = true,
): { datasets: Record<string, T>; loading: boolean; error: string } {
	const [datasets, setDatasets] = useState<Record<string, T>>({});
	const [loading, setLoading] = useState(enabled);
	const [error, setError] = useState("");
	const loaderRef = useRef(loader);

	useEffect(() => {
		if (!enabled) return;
		loaderRef
			.current()
			.then((result) => {
				setDatasets(result);
				setLoading(false);
			})
			.catch((err: any) => {
				setError(err?.message || "Error loading data");
				setLoading(false);
			});
	}, [enabled]); // eslint-disable-line react-hooks/exhaustive-deps

	return { datasets, loading, error };
}
