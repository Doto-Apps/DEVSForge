// Public roadmap content. Reorder items here; mark a task done only after delivery.
// This list does not schedule work or call the API.
export const projectLinks = {
	email: "dominici.antoine.p@gmail.com",
	github: "https://github.com/Doto-Apps/DEVSForge",
};

export const roadmap = [
	{
		category: "Simulation",
		description:
			"Capture model state through the runner and wrapper at each transition, then inspect the state of the whole system at a selected logical time. Make the same evidence usable by people and AI debugging tools.",
		id: "state-snapshots",
		status: "planned",
		tasks: [
			{ done: false, text: "Capture state snapshots at model transitions." },
			{
				done: false,
				text: "Index snapshots by simulation time and model instance.",
			},
			{
				done: false,
				text: "Provide a timeline for inspecting the system at an instant.",
			},
		],
		title: "Inspect every model at a simulation instant",
	},
	{
		category: "Simulation",
		description:
			"Improve built-in views of simulation data so users can understand runs without setting up an external Grafana instance.",
		id: "simulation-visualization",
		status: "planned",
		tasks: [
			{
				done: false,
				text: "Add built-in views for model outputs and their evolution over time.",
			},
			{
				done: false,
				text: "Connect the visualizations to model instances and the debugging timeline.",
			},
		],
		title: "Explore simulation results inside DEVSForge",
	},
	{
		category: "Modeling",
		description:
			"Support languages that require several files, such as C++ source/header pairs, and let engineers organize helper classes and utilities alongside a model in any integration.",
		id: "multiple-files",
		status: "planned",
		tasks: [
			{
				done: false,
				text: "Store and edit a model’s source files and folders.",
			},
			{
				done: false,
				text: "Include those files in execution preparation and language assistance.",
			},
			{
				done: false,
				text: "Support required file pairs as well as optional helper files.",
			},
		],
		title: "Give a model more than one source file",
	},
	{
		category: "AI generation",
		description:
			"Attach documentation, PDF documents and text files to model generation so requirements and reference material can inform the generated system.",
		id: "document-context",
		status: "planned",
		tasks: [
			{
				done: false,
				text: "Import PDF and text documents as generation context.",
			},
			{
				done: false,
				text: "Let users select which documents accompany a generation request.",
			},
		],
		title: "Use documents as generation context",
	},
	{
		category: "AI generation",
		description:
			"Develop the generation approach described in the project author’s research, with better reuse of definitions, explicit instances and stronger interface context.",
		id: "research-generation",
		status: "planned",
		tasks: [
			{
				done: false,
				text: "Implement the generation workflow from the author’s paper.",
			},
			{
				done: false,
				text: "Create several instances of one definition instead of generating duplicate models.",
			},
			{
				done: false,
				text: "Describe and strongly type output payloads to improve the context available to AI.",
			},
		],
		title: "Build a more capable, research-informed generator",
	},
	{
		category: "Frameworks & import",
		description:
			"Execute MS4 Me Java atomics in flattened assemblies, with templates, AI generation and Java language assistance.",
		id: "ms4me",
		reference: { label: "MS4 Me · RTSync", url: "https://rtsync.com/ms4me/" },
		status: "done",
		tasks: [
			{ done: true, text: "Prepare the framework integration and wrapper." },
			{
				done: true,
				text: "Validate execution and communication with the existing integrations.",
			},
		],
		title: "Integrate MS4 Me",
	},
	{
		category: "Frameworks & import",
		description:
			"Run native DEVSimPy/PyPDEVS atomics with Parallel DEVS input/output bags in flattened assemblies, with templates, AI generation and Python language assistance.",
		id: "devsimpy",
		reference: {
			label: "DEVSimPy project",
			url: "https://github.com/capocchi/DEVSimPy",
		},
		status: "done",
		tasks: [
			{
				done: true,
				text: "Implement the framework-specific preparation and wrapper.",
			},
			{
				done: true,
				text: "Verify representative models in DEVSForge simulations.",
			},
		],
		title: "Integrate DEVSimPy",
	},
	{
		category: "Frameworks & import",
		description:
			"Bring existing work into DEVSForge from a folder, ZIP archive or individual file. Explore an AI agent for flexible import, alongside static adapters where useful; the approach remains to be decided.",
		id: "model-import",
		status: "planned",
		tasks: [
			{
				done: false,
				text: "Accept model sources as folders, archives and individual files.",
			},
			{
				done: false,
				text: "Identify the framework, model structure and dependencies.",
			},
			{
				done: false,
				text: "Review an import proposal before creating the resulting models.",
			},
		],
		title: "Import existing models from other frameworks",
	},
	{
		category: "Sharing",
		description:
			"Let users make a model or library public so other users can view it, simulate it and fork it into their own workspace.",
		id: "public-and-fork",
		status: "planned",
		tasks: [
			{ done: false, text: "Add public visibility to models and libraries." },
			{
				done: false,
				text: "Allow other users to view and simulate public content.",
			},
			{ done: false, text: "Create independent copies through a fork action." },
		],
		title: "Publish models and libraries, with forks",
	},
	{
		category: "Sharing",
		description:
			"Share a private model or library with another account by email, granting either viewing or editing rights to the original content.",
		id: "private-sharing",
		status: "planned",
		tasks: [
			{
				done: false,
				text: "Share with an existing account using its email address.",
			},
			{ done: false, text: "Enforce separate view and edit permissions." },
			{
				done: false,
				text: "Apply access management to both models and libraries.",
			},
		],
		title: "Share privately with view or edit access",
	},
	{
		category: "Interoperability",
		description:
			"Continue aligning model representation with the work on ISO 21175 Part 3, including model identity, interfaces and information needed for exchange.",
		id: "iso-models",
		status: "planned",
		tasks: [
			{
				done: false,
				text: "Map DEVSForge model data to the evolving model representation.",
			},
			{
				done: false,
				text: "Prepare exchangeable model descriptions for the public API.",
			},
		],
		title: "Continue ISO 21175 Part 3 model representation",
	},
	{
		category: "Interoperability",
		description:
			"Develop an API service separate from DEVSForge, following the work on ISO 21175 Part 4, to make selected user models available to other tools and users.",
		id: "public-api",
		status: "planned",
		tasks: [
			{
				done: false,
				text: "Define the service and its model exposure contract.",
			},
			{
				done: false,
				text: "Implement the API alongside the model representation.",
			},
		],
		title: "Create a separate public model API",
	},
	{
		category: "Interoperability",
		description:
			"Add export actions and publication controls in DEVSForge so users can choose which models to expose through the separate API.",
		id: "api-publishing",
		status: "planned",
		tasks: [
			{
				done: false,
				text: "Add model export and publication actions in the interface.",
			},
			{
				done: false,
				text: "Connect selected model publication to the separate public API.",
			},
		],
		title: "Publish from DEVSForge to the public API",
	},
	{
		category: "Sharing",
		description:
			"The existing default: each account keeps its own models and libraries. Public visibility and sharing permissions will extend this foundation.",
		id: "private-workspaces",
		status: "done",
		tasks: [
			{
				done: true,
				text: "Keep models and libraries scoped to their owner’s account.",
			},
		],
		title: "Private models and libraries",
	},
] as const;

export const roadmapStatuses = [
	{ id: "planned", label: "Planned" },
	{ id: "in-progress", label: "In progress" },
	{ id: "done", label: "Completed" },
] as const;
