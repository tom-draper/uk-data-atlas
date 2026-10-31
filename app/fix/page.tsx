import type { Metadata } from "next";
import Navigation from "@/components/Navigation";
import SunlitBackdrop from "@/components/docs/SunlitBackdrop";
import { Eyebrow, Sheet } from "@/components/docs/Page";
import { TextLink } from "@/components/docs/Prose";
import FixTool from "@/components/fix/FixTool";
import { pageMetadata } from "@/lib/site";

// Kept out of search until the tool has settled.
export const metadata: Metadata = pageMetadata({
	subject: "Fix your data",
	description:
		"Drop in a spreadsheet of area codes or names. We'll tell you which boundaries they are, what's wrong with them, and what retired codes became.",
	path: "/fix",
	robots: { index: false, follow: true },
});

export default function FixPage() {
	return (
		<div className="relative min-h-screen text-slate-700">
			<SunlitBackdrop />
			<div className="relative z-10">
				<Navigation />
				<main className="mx-auto max-w-[1480px] px-3 sm:px-4">
					<Sheet>
						<div className="max-w-[960px]">
							<Eyebrow>Fix your data</Eyebrow>
							<h1 className="text-[32px] leading-[1.15] font-semibold tracking-tight text-slate-900 sm:text-[38px]">
								Fix your data
							</h1>
							<p className="mt-4 max-w-[760px] text-[17px] leading-[1.7] text-slate-600">
								Drop in a spreadsheet with area codes or names
								in it. We&apos;ll work out which{" "}
								<TextLink href="/boundaries">
									boundaries
								</TextLink>{" "}
								they are, say what&apos;s wrong with them, and
								find what retired codes became.
							</p>
							<div className="mt-8">
								<FixTool />
							</div>
						</div>
					</Sheet>
				</main>
			</div>
		</div>
	);
}
