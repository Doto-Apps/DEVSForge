import { Link } from "react-router-dom";

export function ExecutionUnavailable({
	reason,
	libraryId,
	modelId,
}: {
	reason: string;
	libraryId?: string;
	modelId?: string;
}) {
	return (
		<div className="p-8 space-y-4">
			<h1 className="text-xl font-semibold">Execution unavailable</h1>
			<p role="status">{reason}</p>
			<p>You can still inspect and edit the imported model.</p>
			<Link className="underline" to={`/library/${libraryId}/model/${modelId}`}>
				Return to model
			</Link>
		</div>
	);
}
