import { CheckCircle2, CircleDashed, TriangleAlert } from "lucide-react";
import type { components } from "@/api/v1";
import { Badge } from "@/components/ui/badge";

export function ImportPreview({
	job,
}: {
	job: components["schemas"]["handler.ImportJob"];
}) {
	const models = job.package?.models ?? [];
	const status = job.verification?.status ?? "not_tested";
	const passed = status === "completed";
	const failed = ["failed", "blocked", "timeout"].includes(status);
	return (
		<>
			<div className="flex items-center justify-between">
				<h2 className="font-semibold">Your draft</h2>
				<Badge variant="secondary">Version {job.revision ?? 1}</Badge>
			</div>
			<div className="flex gap-3 rounded-xl border bg-card p-4">
				{passed ? (
					<CheckCircle2 className="size-5 shrink-0 text-emerald-600" />
				) : failed ? (
					<TriangleAlert className="size-5 shrink-0 text-amber-600" />
				) : (
					<CircleDashed className="size-5 shrink-0 text-muted-foreground" />
				)}
				<div>
					<p className="text-sm font-medium">
						{passed
							? "Verification passed"
							: failed
								? "Execution needs attention"
								: "Execution not verified"}
					</p>
					<p className="mt-1 text-xs text-muted-foreground">
						{passed
							? `Root ${job.verification?.rootId}, horizon ${job.verification?.maxTime}. Other roots are not covered by this test.`
							: "Recognizing a framework is not a simulation test."}
					</p>
				</div>
			</div>
			<section
				aria-label="Recovered models"
				className="overflow-hidden rounded-xl border bg-card"
			>
				<p className="border-b px-4 py-3 text-sm font-medium">
					{models.length} model definitions
				</p>
				{models.map((model) => (
					<details className="border-b last:border-b-0" key={model.id}>
						<summary className="cursor-pointer px-4 py-3 text-sm">
							<span className="font-medium">{model.name}</span>
							<span className="mt-1 block text-xs text-muted-foreground">
								{model.type} ·{" "}
								{model.framework || model.language || "Unknown framework"} ·{" "}
								{model.ports?.length ?? 0} ports
							</span>
						</summary>
						<div className="space-y-3 px-4 pb-4 text-xs">
							{model.blockedReason && (
								<p className="text-amber-700 dark:text-amber-400">
									{model.blockedReason}
								</p>
							)}
							<p>
								{model.ports?.map((p) => `${p.name} (${p.type})`).join(", ") ||
									"No ports declared"}
							</p>
							{model.type === "coupled" && (
								<p>
									{model.components?.length ?? 0} components ·{" "}
									{model.connections?.length ?? 0} connections
								</p>
							)}
							<pre className="max-h-64 overflow-auto rounded-md bg-muted p-3">
								{model.code || "Coupled structure"}
							</pre>
							<p className="break-words text-muted-foreground">
								{model.evidence?.join("; ")}
							</p>
						</div>
					</details>
				))}
			</section>
			{!!job.warnings?.length && (
				<details className="rounded-xl border p-4">
					<summary className="cursor-pointer text-sm font-medium">
						Analysis notes ({job.warnings.length})
					</summary>
					<div className="mt-3 space-y-2">
						{Array.from(new Set(job.warnings)).map((w) => (
							<p className="break-words text-xs text-muted-foreground" key={w}>
								{w}
							</p>
						))}
					</div>
				</details>
			)}
			{!!job.changes?.length && (
				<details className="rounded-xl border bg-card p-4">
					<summary className="cursor-pointer text-sm font-medium">
						Changes from the original draft
					</summary>
					<div className="mt-3 space-y-2">
						{job.changes.map((change) => (
							<p className="text-xs" key={change}>
								{change}
							</p>
						))}
					</div>
				</details>
			)}
			{!!job.attempts?.length && (
				<section aria-label="Verification attempts" className="space-y-2">
					<h2 className="text-sm font-semibold">Verification history</h2>
					{job.attempts.map((attempt, i) => (
						<details
							className="rounded-lg border bg-card p-3"
							// biome-ignore lint/suspicious/noArrayIndexKey: Verification attempts are append-only.
							key={`${i}-${attempt.digest}`}
						>
							<summary className="cursor-pointer text-xs font-medium">
								Attempt {i + 1} · {attempt.status} · horizon {attempt.maxTime}
							</summary>
							<div className="mt-3 space-y-2 text-xs">
								<p>
									Root: {attempt.rootId} · Version {attempt.revision}
								</p>
								{attempt.error && (
									<p className="break-words text-destructive">
										{attempt.error}
									</p>
								)}
								<pre className="max-h-56 overflow-auto whitespace-pre-wrap break-words rounded bg-muted p-2">
									{attempt.logs ||
										"No simulator output. See the diagnostic above."}
								</pre>
							</div>
						</details>
					))}
				</section>
			)}
		</>
	);
}
