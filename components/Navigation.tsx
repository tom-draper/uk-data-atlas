// components/Navigation.tsx
import Link from "next/link";

export default function Navigation() {
	return (
		<nav>
			<div className="flex py-6 px-4 w-[65%] mx-auto">
				<h1 className="text-xl w-50 font-semibold">UK Data Atlas</h1>
				<div className="flex place-items-center grow text-[#4e4e4e]">
					<div className="ml-auto grow text-right">
						<Link
							href="/"
							className="px-4 content-center cursor-pointer hover:underline"
						>
							Home
						</Link>
						<Link
							href="/sources"
							className="px-4 content-center cursor-pointer hover:underline"
						>
							Sources
						</Link>
						<Link
							href="/"
							className="px-4 content-center cursor-pointer hover:underline"
						>
							About
						</Link>
					</div>
				</div>
			</div>
		</nav>
	);
}
