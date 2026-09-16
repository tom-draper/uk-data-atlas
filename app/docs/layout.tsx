import type { Metadata } from "next";
import { notFound } from "next/navigation";
import SunlitBackdrop, { Sunfall } from "@/components/docs/SunlitBackdrop";
import DocsHeader from "@/components/docs/DocsHeader";
import DocsSidebar, {
	type SidebarSection,
} from "@/components/docs/DocsSidebar";
import { docsEnabled, docsIndexable, docsMode } from "@/lib/docs/mode";
import { loadApiContract } from "@/lib/docs/openapi";
import { glassPane } from "@/lib/docs/theme";
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
	// Only what the navigation shows crosses to the client.
	const sections: SidebarSection[] = contract.sections.map((section) => ({
		name: section.name,
		slug: section.slug,
		operations: section.operations.map((op) => ({
			slug: op.slug,
			method: op.method,
			path: op.path,
			summary: op.summary,
		})),
	}));

	return (
		<div className="relative min-h-screen text-slate-700">
			<SunlitBackdrop />
			<div className="relative z-10">
				<DocsHeader
					sections={sections}
					version={contract.version}
					preview={docsMode() === "preview"}
				/>
				<div className="mx-auto flex max-w-[1480px] gap-4 px-3 pt-4 pb-10 sm:px-4">
					<aside
						className="sticky top-[76px] hidden h-[calc(100vh-92px)] w-[272px] shrink-0 flex-col overflow-hidden rounded-xl lg:flex"
						style={glassPane}
					>
						<DocsSidebar sections={sections} />
					</aside>
					<main className="min-w-0 flex-1">{children}</main>
				</div>
			</div>
			<Sunfall />
		</div>
	);
}
