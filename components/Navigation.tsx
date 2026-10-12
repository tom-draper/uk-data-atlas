// components/Navigation.tsx
import Link from "next/link";

const linkClass =
	"rounded-md px-2.5 py-1.5 whitespace-nowrap text-[14px] text-slate-600 transition-colors hover:bg-white/50 hover:text-slate-900";

export default function Navigation() {
	return (
		<nav>
			<div className="mx-auto flex w-full px-4 py-3 sm:w-[90%] sm:py-6 min-[1301px]:w-[65%]">
				<div className="flex min-w-0 grow items-center">
					<div className="flex flex-wrap items-center gap-1 sm:ml-auto sm:justify-end sm:text-right">
						<Link href="/atlas" className={linkClass}>
							Atlas
						</Link>
						<Link href="/maps" className={linkClass}>
							Maps
						</Link>
						<Link href="/places" className={linkClass}>
							Places
						</Link>
						<Link href="/datasets" className={linkClass}>
							Datasets
						</Link>
						<Link href="/geographies" className={linkClass}>
							Geographies
						</Link>
						<Link href="/docs/v1" className={linkClass}>
							API Docs
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
