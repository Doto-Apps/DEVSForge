import { useEffect, useState } from "react";
import { client } from "@/api/client";
import type { components } from "@/api/v1";
import { Button } from "@/components/ui/button";

export function ImportDrafts({ onResume }: { onResume: (id: string) => void }) {
	const [drafts, setDrafts] = useState<
		components["schemas"]["handler.ImportDraft"][]
	>([]);
	const [error, setError] = useState(false);
	const [loading, setLoading] = useState(true);
	const [retry, setRetry] = useState(0);
	// biome-ignore lint/correctness/useExhaustiveDependencies: Retry explicitly reloads the list.
	useEffect(() => {
		let active = true;
		setLoading(true);
		setError(false);
		void client
			.GET("/imports")
			.then(({ data, error }) => {
				if (!active) return;
				if (error || !data) setError(true);
				else setDrafts(data);
			})
			.catch(() => {
				if (active) setError(true);
			})
			.finally(() => {
				if (active) setLoading(false);
			});
		return () => {
			active = false;
		};
	}, [retry]);
	if (loading)
		return (
			<p className="text-xs text-muted-foreground" role="status">
				Loading your imports…
			</p>
		);
	if (error)
		return (
			<div className="rounded-xl border p-4 text-sm" role="alert">
				Could not load your imports.{" "}
				<Button
					onClick={() => setRetry((n) => n + 1)}
					size="sm"
					variant="ghost"
				>
					Retry
				</Button>
			</div>
		);
	if (!drafts.length) return null;
	return (
		<section aria-label="Imports in progress" className="space-y-3">
			<div>
				<h2 className="font-semibold">Resume an import</h2>
				<p className="mt-1 text-xs text-muted-foreground">
					Your files, conversation and verification results are saved for 7 days
					after your last activity.
				</p>
			</div>
			<div className="divide-y overflow-hidden rounded-xl border bg-card">
				{drafts.map((draft) => (
					<div className="flex items-center gap-3 p-4" key={draft.id}>
						<div className="min-w-0 flex-1">
							<p className="truncate text-sm font-medium">{draft.title}</p>
							<p className="mt-1 text-xs text-muted-foreground">
								{draft.state === "running" ? "In progress" : "Draft"} ·{" "}
								{draft.modelCount ?? 0} models ·{" "}
								{draft.verificationStatus === "completed"
									? "Verification passed"
									: "Verification pending or needs attention"}
							</p>
							<p className="mt-1 text-xs text-muted-foreground">
								{draft.updated
									? new Date(draft.updated * 1000).toLocaleString()
									: ""}
							</p>
						</div>
						<Button
							aria-label={`Resume ${draft.title}`}
							onClick={() => {
								if (draft.id) onResume(draft.id);
							}}
							size="sm"
							variant="outline"
						>
							Resume
						</Button>
					</div>
				))}
			</div>
		</section>
	);
}
