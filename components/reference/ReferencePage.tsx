import type { ReactNode } from "react";
import Navigation from "@/components/Navigation";
import { Eyebrow, Sheet } from "@/components/docs/Page";
import ReferenceSidebar, { type ReferenceGroup } from "./ReferenceSidebar";

/**
 * The layout of the /datasets and /boundaries pages: the docs' typography and
 * a list of the page's sections down the left, under the site's navigation.
 */
export default function ReferencePage({
	label,
	groups,
	eyebrow,
	title,
	lede,
	children,
}: {
	label: string;
	groups: ReferenceGroup[];
	eyebrow: string;
	title: string;
	lede: ReactNode;
	children: ReactNode;
}) {
	return (
		<div className="min-h-screen bg-[#f3f3f1] text-slate-700">
			<Navigation />
			<div className="mx-auto flex max-w-[1480px] gap-6 px-3 sm:px-4">
				<aside className="sticky top-0 hidden h-screen w-[248px] shrink-0 flex-col border-r border-slate-900/[0.06] pt-6 pr-5 lg:flex">
					<ReferenceSidebar label={label} groups={groups} />
				</aside>
				<main className="min-w-0 flex-1 pb-10">
					<Sheet>
						<article className="max-w-[760px]">
							<Eyebrow>{eyebrow}</Eyebrow>
							<h1 className="text-[32px] leading-[1.15] font-semibold tracking-tight text-slate-900 sm:text-[38px]">
								{title}
							</h1>
							<div className="mt-4 text-[17px] leading-[1.7] text-slate-600">
								{lede}
							</div>
							<div className="mt-2">{children}</div>
						</article>
					</Sheet>
				</main>
			</div>
		</div>
	);
}
