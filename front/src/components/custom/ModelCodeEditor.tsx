import { Editor, useMonaco } from "@monaco-editor/react";
import { useEffect } from "react";
import type { components } from "@/api/v1";
import { examplePythonCode } from "@/staticModel/examplePythonCode";
import type { WorkerResponse } from "@/types";

type ModelCodeEditorProps = {
	code: string;
	onCodeChange: (newCode: string, modelID: string) => void;
	modelId: string;
	language?: components["schemas"]["enum.ModelLanguage"];
};

export const ModelCodeEditor = ({
	code = examplePythonCode,
	onCodeChange,
	modelId,
	language = "python",
}: ModelCodeEditorProps) => {
	const monaco = useMonaco();

	useEffect(() => {
		if (monaco && language === "python") {
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
			const subscription = editor?.onDidChangeModelContent(() => {
				const code = editor.getValue();
				worker.postMessage({ code });
			});

			return () => {
				subscription?.dispose();
				worker.terminate();
				const model = editor?.getModel();
				if (model) {
					monaco.editor.setModelMarkers(model, "pyright", []);
				}
			};
		}
	}, [monaco, language]);

	return (
		<div className="h-full min-h-0 overflow-hidden">
			<Editor
				height="100%"
				language={language}
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
