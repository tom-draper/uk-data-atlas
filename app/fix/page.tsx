import type { Metadata } from "next";
import Navigation from "@/components/Navigation";
import { Eyebrow, Sheet } from "@/components/docs/Page";
import { pageMetadata } from "@/lib/site";

// Kept out of search until the page has content.
export const metadata: Metadata = pageMetadata({
	subject: "Fix your data",
	description:
		"Drop in a spreadsheet of area codes or names. We'll tell you what they are, fix what's broken, and convert them to the geography you need.",
	path: "/fix",
	robots: { index: false, follow: true },
});

export default function FixPage() {
	return (
		<div className="min-h-screen bg-[#f3f3f1] text-slate-700">
			<Navigation />
			<main className="mx-auto max-w-[1480px] px-3 sm:px-4">
				<Sheet>
					<div className="max-w-[760px]">
						<Eyebrow>Fix your data</Eyebrow>
						<h1 className="text-[32px] leading-[1.15] font-semibold tracking-tight text-slate-900 sm:text-[38px]">
							Fix your data
						</h1>
						<p className="mt-4 text-[17px] leading-[1.7] text-slate-600">
							Drop in a spreadsheet of area codes or names.
							We&apos;ll tell you what they are, fix what&apos;s
							broken, and convert them to the geography you need.
						</p>
						<p className="mt-6 text-[14px] font-medium text-slate-500">
							Coming soon.
						</p>
					</div>
				</Sheet>
			</main>
		</div>
	);
}
