import type { DocsField, DocsParameter } from "@/lib/docs/openapi";
import Prose, { Inline } from "./Prose";

function Values({ values, label }: { values: string[]; label: string }) {
	if (values.length === 0) return null;
	return (
		<div className="mt-2 flex flex-wrap items-center gap-1.5 text-[12px]">
			<span className="text-slate-500">{label}</span>
			{values.map((value) => (
				<code
					key={value}
					className="rounded-[4px] bg-white/70 px-1.5 py-px font-mono text-[11.5px] text-slate-700 ring-1 ring-slate-900/[0.06]"
				>
					{value}
				</code>
			))}
		</div>
	);
}

function Name({
	name,
	type,
	required,
}: {
	name: string;
	type: string;
	required: boolean;
}) {
	return (
		<div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
			<code className="font-mono text-[13.5px] font-semibold text-slate-900">
				{name}
			</code>
			<span className="font-mono text-[12px] text-slate-500">{type}</span>
			{required ? (
				<span className="text-[11px] font-medium text-rose-600">
					required
				</span>
			) : (
				<span className="text-[11px] text-slate-400">optional</span>
			)}
		</div>
	);
}

export function ParameterList({ parameters }: { parameters: DocsParameter[] }) {
	return (
		<ul className="divide-y divide-slate-900/[0.06]">
			{parameters.map((parameter) => (
				<li
					key={`${parameter.location}-${parameter.name}`}
					className="py-4"
				>
					<Name
						name={parameter.name}
						type={parameter.type}
						required={parameter.required}
					/>
					{parameter.description && (
						<Prose
							text={parameter.description}
							className="mt-1.5 !text-[14px] !leading-[1.65]"
						/>
					)}
					<Values values={parameter.values} label="One of" />
					{parameter.defaultValue !== null && (
						<Values
							values={[parameter.defaultValue]}
							label="Default"
						/>
					)}
				</li>
			))}
		</ul>
	);
}

export function FieldList({
	fields,
	depth = 0,
}: {
	fields: DocsField[];
	depth?: number;
}) {
	return (
		<ul
			className={
				depth === 0
					? "divide-y divide-slate-900/[0.06]"
					: "mt-3 divide-y divide-slate-900/[0.05] rounded-md border border-slate-900/[0.06] bg-white/35 px-4"
			}
		>
			{fields.map((field) => (
				<li key={field.name} className={depth === 0 ? "py-4" : "py-3"}>
					<Name
						name={field.name}
						type={field.type}
						required={field.required}
					/>
					{field.description && (
						<Prose
							text={field.description}
							className="mt-1.5 !text-[14px] !leading-[1.65]"
						/>
					)}
					<Values values={field.values} label="One of" />
					{field.children.length > 0 && (
						<details className="group mt-2">
							<summary className="inline-flex cursor-pointer list-none items-center gap-1 rounded-full border border-slate-900/[0.08] bg-white/50 px-2.5 py-0.5 text-[12px] text-slate-600 select-none hover:bg-white/80 hover:text-slate-900">
								<span className="group-open:hidden">Show</span>
								<span className="hidden group-open:inline">
									Hide
								</span>
								{field.children.length} child{" "}
								{field.children.length === 1
									? "field"
									: "fields"}
							</summary>
							<FieldList
								fields={field.children}
								depth={depth + 1}
							/>
						</details>
					)}
				</li>
			))}
		</ul>
	);
}
