"use client";

import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { withCDN } from "@/lib/helpers/cdn";
import { placeKindName } from "@/lib/places/labels";
import type { PlaceIndex, PlaceIndexEntry } from "@/lib/places/profile";

const normalise = (text: string) =>
	text
		.normalize("NFD")
		.replace(/[̀-ͯ]/g, "")
		.toLowerCase()
		.replace(/&/g, " and ")
		.replace(/[^a-z0-9]+/g, " ")
		.trim();

const POSTCODE = /^[a-z]{1,2}\d[a-z\d]?\s*\d[a-z]{2}$/i;

type Result = { entry: PlaceIndexEntry; rank: number };

function search(index: PlaceIndex, query: string): PlaceIndexEntry[] {
	const code = query.trim().toUpperCase();
	const text = normalise(query);
	if (!text) return [];
	const results: Result[] = [];
	for (const entry of [...index.named, ...index.areas]) {
		const [id, name, , , , lastYear] = entry;
		const named = normalise(name);
		let rank: number | undefined;
		if (id === code) rank = 0;
		else if (named === text) rank = 1;
		else if (named.startsWith(text)) rank = 2;
		else if (code.length >= 3 && id.startsWith(code)) rank = 3;
		else if (text.length >= 3 && named.includes(text)) rank = 4;
		if (rank === undefined) continue;
		// Named places and current areas before those no longer in use.
		const order =
			rank * 10 +
			(index.named.includes(entry) ? 0 : 1) +
			(lastYear === null ? 0 : 2);
		results.push({ entry, rank: order });
	}
	return results
		.sort((a, b) => a.rank - b.rank || a.entry[1].localeCompare(b.entry[1]))
		.slice(0, 12)
		.map(({ entry }) => entry);
}

/**
 * Find any place by code or name. The index is fetched on first focus, so
 * the page costs nothing until someone searches.
 */
export default function PlaceSearch({
	autoFocus = false,
}: {
	autoFocus?: boolean;
}) {
	const router = useRouter();
	const [index, setIndex] = useState<PlaceIndex>();
	const [query, setQuery] = useState("");
	const [active, setActive] = useState(0);
	const loading = useRef(false);

	const load = () => {
		if (loading.current) return;
		loading.current = true;
		void fetch(withCDN("/data/datasets/places/index.json"))
			.then((response) => response.json() as Promise<PlaceIndex>)
			.then(setIndex)
			.catch(() => {
				loading.current = false;
			});
	};
	useEffect(() => {
		if (autoFocus) load();
	}, [autoFocus]);

	const results = useMemo(
		() => (index ? search(index, query) : []),
		[index, query],
	);
	const isPostcode = POSTCODE.test(query.trim());
	const open = (entry: PlaceIndexEntry | undefined) => {
		if (entry) router.push(`/places/${entry[0]}`);
	};

	return (
		<div className="relative">
			<label className="flex items-center gap-3 rounded-lg border border-slate-900/10 bg-white px-4 py-3 shadow-sm focus-within:border-slate-400">
				<Search className="h-5 w-5 shrink-0 text-slate-400" />
				<span className="sr-only">Search places</span>
				<input
					type="search"
					value={query}
					autoFocus={autoFocus}
					onFocus={load}
					onChange={(event) => {
						setQuery(event.target.value);
						setActive(0);
					}}
					onKeyDown={(event) => {
						if (event.key === "ArrowDown")
							setActive((value) =>
								Math.min(value + 1, results.length - 1),
							);
						else if (event.key === "ArrowUp")
							setActive((value) => Math.max(value - 1, 0));
						else if (event.key === "Enter") open(results[active]);
						else return;
						event.preventDefault();
					}}
					placeholder="A code like E05000954, or a name like Greater Manchester"
					className="min-w-0 flex-1 bg-transparent text-[16px] text-slate-900 outline-none placeholder:text-slate-400"
					role="combobox"
					aria-expanded={results.length > 0}
					aria-controls="place-results"
					aria-autocomplete="list"
				/>
			</label>
			{query.trim() && (
				<div
					id="place-results"
					role="listbox"
					className="absolute inset-x-0 top-full z-20 mt-2 overflow-hidden rounded-lg border border-slate-900/10 bg-white shadow-lg"
				>
					{!index ? (
						<p className="px-4 py-3 text-[14px] text-slate-500">
							Loading places…
						</p>
					) : isPostcode && results.length === 0 ? (
						<p className="px-4 py-3 text-[14px] text-slate-500">
							Postcode pages aren&apos;t here yet. Search for the
							ward or council the postcode is in instead.
						</p>
					) : results.length === 0 ? (
						<p className="px-4 py-3 text-[14px] text-slate-500">
							No place matches that code or name.
						</p>
					) : (
						results.map((entry, position) => {
							const [
								id,
								name,
								kind,
								parent,
								firstYear,
								lastYear,
							] = entry;
							return (
								<button
									key={id}
									type="button"
									role="option"
									aria-selected={position === active}
									onMouseEnter={() => setActive(position)}
									onClick={() => open(entry)}
									className={`flex w-full items-baseline justify-between gap-4 px-4 py-2.5 text-left ${position === active ? "bg-slate-100" : ""}`}
								>
									<span className="min-w-0">
										<span className="text-[15px] font-medium text-slate-900">
											{name}
										</span>
										<span className="ml-2 text-[13px] text-slate-500">
											{placeKindName(kind)}
											{parent ? `, ${parent}` : ""}
										</span>
									</span>
									<span className="shrink-0 text-[12.5px] text-slate-500">
										{/^[A-Z0-9]+$/.test(id) ? id : ""}
										{lastYear !== null && lastYear !== 0
											? ` · ${firstYear} to ${lastYear}`
											: ""}
									</span>
								</button>
							);
						})
					)}
				</div>
			)}
		</div>
	);
}
