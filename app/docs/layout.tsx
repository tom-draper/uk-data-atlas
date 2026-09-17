import type { Metadata } from "next";
import { notFound } from "next/navigation";
import SunlitBackdrop, { Sunfall } from "@/components/docs/SunlitBackdrop";
import DocsHeader from "@/components/docs/DocsHeader";
import DocsSidebar from "@/components/docs/DocsSidebar";
import { docsEnabled, docsIndexable, docsMode } from "@/lib/docs/mode";
import { docsNavigation } from "@/lib/docs/navigation";
import { loadApiContract } from "@/lib/docs/openapi";
import "./docs.css";

export function generateMetadata(): Metadata {
	return docsIndexable() ? {} : { robots: { index: false, follow: false } };
}

export default function DocsLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	if (!docsEnabled()) notFound();

	const contract = loadApiContract();
	const groups = docsNavigation(contract);

	return (
		<div className="relative min-h-screen text-slate-700">
			<SunlitBackdrop />
			<div className="relative z-10">
				<DocsHeader
					groups={groups}
					version={contract.version}
					preview={docsMode() === "preview"}
				/>
				<div className="mx-auto flex max-w-[1480px] gap-6 px-3 pt-2 pb-10 sm:px-4">
					<aside className="sticky top-[76px] hidden h-[calc(100vh-84px)] w-[248px] shrink-0 flex-col border-r border-slate-900/[0.06] pt-4 pr-5 pl-1 lg:flex">
						<DocsSidebar groups={groups} />
					</aside>
					<main className="min-w-0 flex-1">{children}</main>
				</div>
			</div>
			<Sunfall />
		</div>
	);
}
