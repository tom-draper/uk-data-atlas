import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "About - UK Data Atlas",
	description: "About the UK Data Atlas project.",
};

export default function AboutPage() {
	return (
		<div className="min-h-screen bg-linear-to-br from-gray-50 to-gray-100 p-8">
			<div className="max-w-5xl mx-auto space-y-8">
				<h1 className="text-3xl font-bold text-gray-900">About</h1>
			</div>
		</div>
	);
}
