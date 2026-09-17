// components/Navigation.tsx
import Link from "next/link";

const linkClass =
	"rounded-md px-2.5 py-1.5 text-[14px] text-slate-600 transition-colors hover:bg-white/50 hover:text-slate-900";

export default function Navigation() {
	return (
		<nav>
			<div className="flex py-6 px-4 w-[65%] mx-auto">
				<div className="flex grow items-center">
					<div className="ml-auto flex items-center gap-1 text-right">
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
