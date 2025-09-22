import { DEFAULT_NODE_SIZE } from "@/constants";
import type { ReactFlowModelData } from "@/types";
import { type Edge, type Node, Position } from "@xyflow/react";

const position = { x: 0, y: 0 };

export const initialNodes: Node<ReactFlowModelData>[] = [
	{
		id: "1",
		type: "resizer",
		data: {
			modelType: "atomic",
			label: "Generate",
			inputPorts: [{ id: "1" }, { id: "2" }],
			outputPorts: [{ id: "1" }, { id: "2" }, { id: "3" }],
			id: "test1",
			toolbarPosition: Position.Top,
			toolbarVisible: true,
		},
		style: { width: DEFAULT_NODE_SIZE, height: DEFAULT_NODE_SIZE },
		position: position,
	},
	{
		id: "2",
		type: "resizer",
		data: {
			modelType: "atomic",
			label: "Your",
			inputPorts: [{ id: "1" }],
			outputPorts: [{ id: "1" }],
			id: "test2",
			toolbarPosition: Position.Top,
			toolbarVisible: true,
		},
		style: { width: DEFAULT_NODE_SIZE, height: DEFAULT_NODE_SIZE },
		position: position,
	},
	{
		id: "3",
		type: "resizer",
		data: {
			modelType: "coupled",
			label: "Diagram",
			inputPorts: [{ id: "1" }, { id: "2" }],
			outputPorts: [{ id: "1" }, { id: "2" }],
			id: "test3",
			toolbarPosition: Position.Top,
			toolbarVisible: true,
		},
		style: { width: 500, height: 500 },
		position: position,
	},
	{
		id: "4",
		type: "resizer", // Assure-toi que ce type est enregistré dans React Flow
		position: { x: 50, y: 50 },
		style: { width: 100, height: 100 },
		data: {
			modelType: "atomic",
			label: "Atomic Model",
			inputPorts: [{ id: "1" }], // Ports d'entrée
			outputPorts: [{ id: "1" }], // Ports de sortie
			id: "test4",
			toolbarPosition: Position.Top,
			toolbarVisible: true,
		},
		parentId: "3",
		extent: "parent",
	},
	{
		id: "7",
		type: "resizer", // Assure-toi que ce type est enregistré dans React Flow
		position: position,
		style: { width: 100, height: 100 },
		data: {
			modelType: "atomic",
			label: "Atomic Model",
			inputPorts: [{ id: "1" }], // Ports d'entrée
			outputPorts: [{ id: "1" }], // Ports de sortie
			id: "test5",
			toolbarPosition: Position.Top,
			toolbarVisible: true,
		},
		parentId: "3",
		extent: "parent",
	},
];

// Définit les arêtes en spécifiant les ports pour chaque connexion
export const initialEdges: Edge[] = [
	{
		id: "e1-2",
		source: "1",
		sourceHandle: "out-1", // Connexion à partir du port de sortie 'out-1' du nœud 1
		target: "2",
		targetHandle: "in-1", // Connexion vers le port d'entrée 'in-1' du nœud 2
		type: "smoothstep",
	},
	{
		id: "e2-3",
		source: "2",
		sourceHandle: "out-1", // Connexion à partir du port de sortie 'out-1' du nœud 2
		target: "3",
		targetHandle: "in-1", // Connexion vers le port d'entrée 'in-1' du nœud 3
		type: "smoothstep",
	},
	{
		id: "e1-3",
		source: "1",
		sourceHandle: "out-2", // Connexion à partir du port de sortie 'out-2' du nœud 1
		target: "3",
		targetHandle: "in-2", // Connexion vers le port d'entrée 'in-2' du nœud 3
		type: "smoothstep",
	},
	{
		id: "e1-4",
		source: "3",
		sourceHandle: "in-internal-1", // Connexion à partir du port de sortie 'out-2' du nœud 1
		target: "4",
		targetHandle: "in-1", // Connexion vers le port d'entrée 'in-2' du nœud 3
		type: "smoothstep",
	},
	{
		id: "e1-5",
		source: "3",
		sourceHandle: "in-internal-2", // Connexion à partir du port de sortie 'out-2' du nœud 1
		target: "7",
		targetHandle: "in-1", // Connexion vers le port d'entrée 'in-2' du nœud 3
		type: "smoothstep",
	},
];
