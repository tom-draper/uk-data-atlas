import type { Metadata } from "next";
import { pageMetadata } from "@/lib/site";

// Kept out of search until the page has content.
export const metadata: Metadata = pageMetadata({
	subject: "About",
	description:
		"About the UK Data Atlas: interactive maps and an API for official UK statistics, from elections to house prices.",
	path: "/about",
	robots: { index: false, follow: true },
});

export default function AboutPage() {
	return (
		<div className="min-h-screen bg-linear-to-br from-gray-50 to-gray-100 p-8">
			<div className="max-w-5xl mx-auto space-y-8">
				<h1 className="text-3xl font-bold text-gray-900">About</h1>
			</div>
		</div>
	);
}
