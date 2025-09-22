import starlight from "@astrojs/starlight";
// @ts-check
import { defineConfig } from "astro/config";

// https://astro.build/config
export default defineConfig({
	integrations: [
		starlight({
			title: "EasyDEVS",
			description:
				"EasyDEVS is a library for the development of discrete event simulation models in JavaScript.",
			social: {
				github: "https://github.com/DominiciAntoine/EasyDEVS",
			},
			sidebar: [
				{
					label: "Guides",
					autogenerate: { directory: "guides" },
				},
				{
					label: "Reference",
					autogenerate: { directory: "reference" },
				},
				{
					label: "ADR",
					autogenerate: { directory: "adr" },
				},
				{
					label: "Projects",
					autogenerate: { directory: "project" },
				},
			],
		}),
	],
});
