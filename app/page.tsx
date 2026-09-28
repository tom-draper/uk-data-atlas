import type { Metadata } from "next";
import Link from "next/link";
import Navigation from "../components/Navigation";

export const metadata: Metadata = {
	title: "UK Data Atlas",
	description:
		"A powerful mapping platform for visualizing data that shapes the United Kingdom.",
};

export default function Home() {
	return (
		<div
			style={{
				backgroundImage: "url(/map-background.webp)",
				backgroundSize: "cover",
				minHeight: "100vh",
			}}
		>
			<div className="relative z-10">
				<Navigation />
				<div className="pt-[20vh] px-[16%]">
					<div className="p-5">
						<h1 className="text-[38px] leading-[1.08] font-semibold tracking-tight text-slate-900 sm:text-[50px]">
							UK Data Atlas
						</h1>
						<p className="mt-5 text-[18px] leading-[1.65] text-slate-600">
							A powerful mapping platform for visualizing data
							that shapes the{" "}
							<span className="text-slate-800">
								United Kingdom
							</span>
							.
						</p>

						<div className="mt-7 flex flex-wrap items-center gap-3">
							<Link
								className="inline-flex items-center rounded-md bg-slate-900 px-4 py-2.5 text-[14px] font-medium text-white shadow-[0_8px_24px_rgba(15,23,42,0.18)] transition-colors hover:bg-slate-800"
								href="/atlas"
							>
								Get Started
							</Link>
							<Link
								className="inline-flex items-center rounded-md border border-white/80 bg-white/55 px-4 py-2.5 text-[14px] font-medium text-slate-800 transition-colors hover:bg-white/85"
								href="/docs/v1"
							>
								Explore the API
							</Link>
							{/* <a className="text-[#4e4e4e] pt-0 my-auto pl-8 hover:underline cursor-pointer" href="/atlas?demo=true">
							Or try the demo
						</a> */}
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
