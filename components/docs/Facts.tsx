import type { ReactNode } from "react";
import { Card } from "./Page";

/** A short run of labelled facts, such as a dataset's years and nations. */
export default function Facts({
	items,
}: {
	items: { label: string; value: ReactNode }[];
}) {
	return (
		<Card className="my-8 grid gap-x-8 gap-y-4 px-5 py-4 sm:grid-cols-2">
			{items.map((item) => (
				<div key={item.label} className="min-w-0">
					<p className="text-[13px] text-slate-500">{item.label}</p>
					<div className="mt-0.5 text-[15px] leading-snug font-medium text-slate-900">
						{item.value}
					</div>
				</div>
			))}
		</Card>
	);
}
