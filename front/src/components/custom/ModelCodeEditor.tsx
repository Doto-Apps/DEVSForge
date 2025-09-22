import { examplePythonCode } from "@/staticModel/examplePythonCode";
import type { WorkerResponse } from "@/types";
import { Editor, useMonaco } from "@monaco-editor/react";
import { useEffect, useRef, useState } from "react";

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
	const containerRef = useRef<HTMLDivElement>(null);
	const [height, setHeight] = useState<string>("100vsh");

	useEffect(() => {
		if (containerRef.current) {
			const { top } = containerRef.current.getBoundingClientRect();
			setHeight(`calc(100vh - ${top}px)`);
		}
	}, []);

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
		<div
			ref={containerRef}
			className="overflow-hidden flex flex-col relative max-h-full"
		>
			<Editor
				height={height}
				language="python"
				value={code}
				onChange={(newCode) => {
					if (newCode) {
						onCodeChange(newCode, modelId);
					}
				}}
				theme="vs-dark"
				options={{
					minimap: { enabled: false },
					fontSize: 14,
					automaticLayout: true,
				}}
			/>
		</div>
	);
};
