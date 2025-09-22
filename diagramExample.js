const diagramExample = {
	nodes: [
		{
			id: "1",
			type: "resizer",
			data: {
				modelType: "atomic",
				label: "Atomic Model 1",
				inputPorts: [],
				outputPorts: [{ id: "1" }],
			},
			style: { width: 300, height: 300 },
			position: { x: 0, y: 0 },
		},
		{
			id: "2",
			type: "resizer",
			data: {
				modelType: "atomic",
				label: "Atomic Model 2",
				inputPorts: [{ id: "1" }],
				outputPorts: [{ id: "1" }, { id: "2" }],
			},
			style: { width: 200, height: 200 },
			position: { x: 0, y: 0 },
		},
		{
			id: "3",
			type: "resizer",
			data: {
				modelType: "coupled",
				label: "Coupled Model",
				inputPorts: [{ id: "1" }, { id: "2" }],
				outputPorts: [{ id: "1" }],
			},
			style: { width: 500, height: 500 },
			position: { x: 0, y: 0 },
		},
		{
			id: "5",
			type: "resizer", // Assure-toi que ce type est enregistré dans React Flow
			position: { x: 0, y: 0 },
			style: { width: 100, height: 100 },
			data: {
				modelType: "atomic",
				label: "Atomic Model",
				inputPorts: [{ id: "1" }], // Ports d'entrée
				outputPorts: [{ id: "1" }], // Ports de sortie
			},
			parentId: "3",
			extent: "parent",
		},
		{
			id: "6",
			type: "resizer", // Assure-toi que ce type est enregistré dans React Flow
			position: { x: 0, y: 0 },
			style: { width: 100, height: 100 },
			data: {
				modelType: "atomic",
				label: "Atomic Model",
				inputPorts: [{ id: "1" }], // Ports d'entrée
				outputPorts: [{ id: "1" }], // Ports de sortie
			},
			parentId: "3",
			extent: "parent",
		},
		{
			id: "7",
			type: "resizer", // Assure-toi que ce type est enregistré dans React Flow
			position: { x: 0, y: 0 },
			style: { width: 100, height: 100 },
			data: {
				modelType: "atomic",
				label: "Atomic Model",
				inputPorts: [{ id: "1" }], // Ports d'entrée
				outputPorts: [], // Ports de sortie
			},
		},
	],
	edges: [
		{
			id: "e1-2",
			source: "1",
			sourceHandle: "out-1", // Connexion à partir du port de sortie 'out-1' du nœud 1
			target: "2",
			targetHandle: "in-1", // Connexion vers le port d'entrée 'in-1' du nœud 2
			type: "smoothstep",
		},
		{
			id: "e2-3-1",
			source: "2",
			sourceHandle: "out-1", // Connexion à partir du port de sortie 'out-1' du nœud 2
			target: "3",
			targetHandle: "in-1", // Connexion vers le port d'entrée 'in-1' du nœud 3
			type: "smoothstep",
		},
		{
			id: "e2-3-2",
			source: "2",
			sourceHandle: "out-2", // Connexion à partir du port de sortie 'out-1' du nœud 2
			target: "3",
			targetHandle: "in-2", // Connexion vers le port d'entrée 'in-1' du nœud 3
			type: "smoothstep",
		},
		{
			id: "e3-5",
			source: "3",
			sourceHandle: "in-internal-1", // Connexion à partir du port de sortie 'out-2' du nœud 1
			target: "5",
			targetHandle: "in-1", // Connexion vers le port d'entrée 'in-2' du nœud 3
			type: "smoothstep",
		},
		{
			id: "e3-6",
			source: "3",
			sourceHandle: "in-internal-2", // Connexion à partir du port de sortie 'out-2' du nœud 1
			target: "6",
			targetHandle: "in-1", // Connexion vers le port d'entrée 'in-2' du nœud 3
			type: "smoothstep",
		},
		{
			id: "e5-3",
			source: "5",
			sourceHandle: "out-1", // Connexion à partir du port de sortie 'out-2' du nœud 1
			target: "3",
			targetHandle: "out-internal-1", // Connexion vers le port d'entrée 'in-2' du nœud 3
			type: "smoothstep",
		},
		{
			id: "e6-3",
			source: "6",
			sourceHandle: "out-1", // Connexion à partir du port de sortie 'out-2' du nœud 1
			target: "3",
			targetHandle: "out-internal-1", // Connexion vers le port d'entrée 'in-2' du nœud 3
			type: "smoothstep",
		},
		{
			id: "e-3-7",
			source: "3",
			sourceHandle: "out-1", // Connexion à partir du port de sortie 'out-2' du nœud 1
			target: "7",
			targetHandle: "in-1", // Connexion vers le port d'entrée 'in-2' du nœud 3
			type: "smoothstep",
		},
	],
};

module.exports = { diagramExample };
