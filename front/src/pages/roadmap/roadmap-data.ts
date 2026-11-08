// Public roadmap content. Reorder items here; mark a task done only after delivery.
// This list does not schedule work or call the API.
export const projectLinks = {
	github: "https://github.com/Doto-Apps/DEVSForge",
	email: "dominici.antoine.p@gmail.com",
};

export const roadmap = [
	{
		id: "state-snapshots",
		category: "Simulation",
		title: "Inspect every model at a simulation instant",
		description:
			"Capture model state through the runner and wrapper at each transition, then inspect the state of the whole system at a selected logical time. Make the same evidence usable by people and AI debugging tools.",
		status: "planned",
		tasks: [
			{ text: "Capture state snapshots at model transitions.", done: false },
			{
				text: "Index snapshots by simulation time and model instance.",
				done: false,
			},
			{
				text: "Provide a timeline for inspecting the system at an instant.",
				done: false,
			},
		],
	},
	{
		id: "simulation-visualization",
		category: "Simulation",
		title: "Explore simulation results inside DEVSForge",
		description:
			"Improve built-in views of simulation data so users can understand runs without setting up an external Grafana instance.",
		status: "planned",
		tasks: [
			{
				text: "Add built-in views for model outputs and their evolution over time.",
				done: false,
			},
			{
				text: "Connect the visualizations to model instances and the debugging timeline.",
				done: false,
			},
		],
	},
	{
		id: "multiple-files",
		category: "Modeling",
		title: "Give a model more than one source file",
		description:
			"Support languages that require several files, such as C++ source/header pairs, and let engineers organize helper classes and utilities alongside a model in any integration.",
		status: "planned",
		tasks: [
			{
				text: "Store and edit a model’s source files and folders.",
				done: false,
			},
			{
				text: "Include those files in execution preparation and language assistance.",
				done: false,
			},
			{
				text: "Support required file pairs as well as optional helper files.",
				done: false,
			},
		],
	},
	{
		id: "document-context",
		category: "AI generation",
		title: "Use documents as generation context",
		description:
			"Attach documentation, PDF documents and text files to model generation so requirements and reference material can inform the generated system.",
		status: "planned",
		tasks: [
			{
				text: "Import PDF and text documents as generation context.",
				done: false,
			},
			{
				text: "Let users select which documents accompany a generation request.",
				done: false,
			},
		],
	},
	{
		id: "research-generation",
		category: "AI generation",
		title: "Build a more capable, research-informed generator",
		description:
			"Develop the generation approach described in the project author’s research, with better reuse of definitions, explicit instances and stronger interface context.",
		status: "planned",
		tasks: [
			{
				text: "Implement the generation workflow from the author’s paper.",
				done: false,
			},
			{
				text: "Create several instances of one definition instead of generating duplicate models.",
				done: false,
			},
			{
				text: "Describe and strongly type output payloads to improve the context available to AI.",
				done: false,
			},
		],
	},
	{
		id: "ms4me",
		category: "Frameworks & import",
		title: "Integrate MS4 Me",
		description:
			"Add the wrapper and preparation needed to execute models from this additional DEVS framework.",
		status: "planned",
		reference: { label: "MS4 Me · RTSync", url: "https://rtsync.com/ms4me/" },
		tasks: [
			{ text: "Prepare the framework integration and wrapper.", done: false },
			{
				text: "Validate execution and communication with the existing integrations.",
				done: false,
			},
		],
	},
	{
		id: "devsimpy",
		category: "Frameworks & import",
		title: "Integrate DEVSimPy",
		description:
			"Extend the available frameworks with a DEVSimPy integration and its execution requirements.",
		status: "planned",
		reference: {
			label: "DEVSimPy project",
			url: "https://github.com/capocchi/DEVSimPy",
		},
		tasks: [
			{
				text: "Implement the framework-specific preparation and wrapper.",
				done: false,
			},
			{
				text: "Verify representative models in DEVSForge simulations.",
				done: false,
			},
		],
	},
	{
		id: "model-import",
		category: "Frameworks & import",
		title: "Import existing models from other frameworks",
		description:
			"Bring existing work into DEVSForge from a folder, ZIP archive or individual file. Explore an AI agent for flexible import, alongside static adapters where useful; the approach remains to be decided.",
		status: "planned",
		tasks: [
			{
				text: "Accept model sources as folders, archives and individual files.",
				done: false,
			},
			{
				text: "Identify the framework, model structure and dependencies.",
				done: false,
			},
			{
				text: "Review an import proposal before creating the resulting models.",
				done: false,
			},
		],
	},
	{
		id: "public-and-fork",
		category: "Sharing",
		title: "Publish models and libraries, with forks",
		description:
			"Let users make a model or library public so other users can view it, simulate it and fork it into their own workspace.",
		status: "planned",
		tasks: [
			{ text: "Add public visibility to models and libraries.", done: false },
			{
				text: "Allow other users to view and simulate public content.",
				done: false,
			},
			{ text: "Create independent copies through a fork action.", done: false },
		],
	},
	{
		id: "private-sharing",
		category: "Sharing",
		title: "Share privately with view or edit access",
		description:
			"Share a private model or library with another account by email, granting either viewing or editing rights to the original content.",
		status: "planned",
		tasks: [
			{
				text: "Share with an existing account using its email address.",
				done: false,
			},
			{ text: "Enforce separate view and edit permissions.", done: false },
			{
				text: "Apply access management to both models and libraries.",
				done: false,
			},
		],
	},
	{
		id: "iso-models",
		category: "Interoperability",
		title: "Continue ISO 21175 Part 3 model representation",
		description:
			"Continue aligning model representation with the work on ISO 21175 Part 3, including model identity, interfaces and information needed for exchange.",
		status: "planned",
		tasks: [
			{
				text: "Map DEVSForge model data to the evolving model representation.",
				done: false,
			},
			{
				text: "Prepare exchangeable model descriptions for the public API.",
				done: false,
			},
		],
	},
	{
		id: "public-api",
		category: "Interoperability",
		title: "Create a separate public model API",
		description:
			"Develop an API service separate from DEVSForge, following the work on ISO 21175 Part 4, to make selected user models available to other tools and users.",
		status: "planned",
		tasks: [
			{
				text: "Define the service and its model exposure contract.",
				done: false,
			},
			{
				text: "Implement the API alongside the model representation.",
				done: false,
			},
		],
	},
	{
		id: "api-publishing",
		category: "Interoperability",
		title: "Publish from DEVSForge to the public API",
		description:
			"Add export actions and publication controls in DEVSForge so users can choose which models to expose through the separate API.",
		status: "planned",
		tasks: [
			{
				text: "Add model export and publication actions in the interface.",
				done: false,
			},
			{
				text: "Connect selected model publication to the separate public API.",
				done: false,
			},
		],
	},
	{
		id: "private-workspaces",
		category: "Sharing",
		title: "Private models and libraries",
		description:
			"The existing default: each account keeps its own models and libraries. Public visibility and sharing permissions will extend this foundation.",
		status: "done",
		tasks: [
			{
				text: "Keep models and libraries scoped to their owner’s account.",
				done: true,
			},
		],
	},
] as const;

export const roadmapStatuses = [
	{ id: "planned", label: "Planned" },
	{ id: "in-progress", label: "In progress" },
	{ id: "done", label: "Completed" },
] as const;
