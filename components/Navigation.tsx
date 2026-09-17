// components/Navigation.tsx
import Link from "next/link";

const linkClass = "px-4 content-center cursor-pointer hover:underline";

export default function Navigation() {
	return (
		<nav>
			<div className="flex py-6 px-4 w-[65%] mx-auto">
				<h1 className="text-xl w-50 font-semibold">
					<Link href="/">UK Data Atlas</Link>
				</h1>
				<div className="flex place-items-center grow text-[#4e4e4e]">
					<div className="ml-auto grow text-right">
						<Link href="/atlas" className={linkClass}>
							Atlas
						</Link>
						<Link href="/docs" className={linkClass}>
							Documentation
						</Link>
						<Link href="/sources" className={linkClass}>
							Data sources
						</Link>
						<a
							href="https://github.com/tom-draper/uk-data-atlas"
							target="_blank"
							rel="noopener noreferrer"
							className={linkClass}
						>
							GitHub
						</a>
					</div>
				</div>
			</div>
		</nav>
	);
}
