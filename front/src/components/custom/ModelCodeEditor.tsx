import { Editor, useMonaco } from "@monaco-editor/react";
import { useEffect } from "react";
import { examplePythonCode } from "@/staticModel/examplePythonCode";
import type { WorkerResponse } from "@/types";

type ModelCodeEditorProps = {
	code: string;
	onCodeChange: (newCode: string, modelID: string) => void;
	modelId: string;
};

export const ModelCodeEditor = ({
	code = examplePythonCode,
	onCodeChange,
	modelId,
}: ModelCodeEditorProps) => {
	const monaco = useMonaco();

	useEffect(() => {
		if (monaco) {
			const worker = new Worker(
				new URL("../../lib/python/worker.ts", import.meta.url),
			);

			worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
				const { diagnostics } = event.data;
				const model = monaco.editor.getModels()[0];
				if (model) {
					monaco.editor.setModelMarkers(model, "pyright", diagnostics);
				}
			};

			const editor = monaco.editor.getEditors()[0];
			editor?.onDidChangeModelContent(() => {
				const code = editor.getValue();
				worker.postMessage({ code });
			});
		}
	}, [monaco]);

	return (
		<div className="h-full min-h-0 overflow-hidden">
			<Editor
				height="100%"
				language="python"
				onChange={(newCode) => {
					if (newCode !== undefined) {
						onCodeChange(newCode, modelId);
					}
				}}
				options={{
					automaticLayout: true,
					fontSize: 14,
					minimap: { enabled: false },
					scrollBeyondLastLine: false,
				}}
				theme="vs-dark"
				value={code}
			/>
		</div>
	);
};
