import "dotenv/config";
import express, { type Request, type Response } from "express";
import type jwt from "jsonwebtoken";
import OpenAI from "openai";
import { LengthFinishReasonError } from "openai/error.mjs";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";
import authenticateToken from "../middlewares/auth";
import { modelPrompt } from "../prompt/ModelPrompt";
import { systemDiagramPrompt } from "../prompt/diagram_prompt";
import { diagramExample1 } from "../prompt/test";
import { convertDevsToReactFlow } from "../utils/dataConversion";

const router = express.Router();

const PortSchema = z.object({
	in: z.array(z.string()).optional(),
	out: z.array(z.string()).optional(),
});

const ModelSchema = z.object({
	id: z.string(),
	type: z.enum(["atomic", "coupled"]),
	ports: PortSchema.optional(),
	components: z.array(z.string()).optional(),
});

const ConnectionSchema = z.object({
	from: z.object({
		model: z.string(),
		port: z.string(),
	}),
	to: z.object({
		model: z.string(),
		port: z.string(),
	}),
});

const DevsSchema = z.object({
	models: z.array(ModelSchema),
	connections: z.array(ConnectionSchema),
});

const DevsModelSchema = z.object({
	code: z.string(),
});

// ✅ Vérifier que l'API OpenAI est bien configurée
if (!process.env.AI_API_KEY || !process.env.AI_API_URL) {
	console.error("❌ ERREUR : Clé API OpenAI ou URL non définie !");
	process.exit(1);
}

// ✅ Configuration OpenAI
const openai = new OpenAI({
	apiKey: process.env.AI_API_KEY as string,
	baseURL: process.env.AI_API_URL as string,
});

// ✅ Définition des interfaces
interface AuthenticatedRequest extends Request {
	user?: jwt.JwtPayload & { id?: string };
}

interface GenerateDiagramRequest extends AuthenticatedRequest {
	body: {
		diagramName: string;
		userPrompt: string;
	};
}

interface GenerateModelRequest extends AuthenticatedRequest {
	body: {
		modelName: string;
		modelType: string;
		previousModelsCode: string;
		userPrompt: string;
	};
}

// **Route : Générer un diagramme**
router.post(
	"/generate-diagram",
	authenticateToken,
	async (req: GenerateDiagramRequest, res: Response): Promise<void> => {
		const { diagramName, userPrompt } = req.body;

		if (!diagramName || diagramName.trim() === "") {
			res.status(400).json({
				error:
					"Le champ 'diagramName' est requis et doit être une chaîne non vide.",
			});
			return;
		}
		if (!userPrompt || userPrompt.trim() === "") {
			res.status(400).json({
				error:
					"Le champ 'userPrompt' est requis et doit être une chaîne non vide.",
			});
			return;
		}
		try {
			const debug = false;
			if (!debug) {
				const completion = await openai.beta.chat.completions.parse({
					model: "gpt-5-mini",
					messages: [
						{ role: "system", content: systemDiagramPrompt.trim() },
						{ role: "user", content: userPrompt },
					],
					response_format: zodResponseFormat(DevsSchema, "DEVSSchema"),
					max_token: 4000,
					temperature: 0.9,
					top_p: 0.7,
				});

				const rawContent = completion.choices[0]?.message?.parsed;
				console.log(JSON.stringify(rawContent));
				if (!rawContent) {
					res.status(500).json({
						error: "Erreur lors de la génération du diagramme avec l’IA.",
					});
					return;
				}

				if (!rawContent || !rawContent.models || !rawContent.connections) {
					res.status(500).json({
						error: "Erreur lors de la génération du diagramme avec l’IA.",
					});
					return;
				}

				const postTreatment = convertDevsToReactFlow(
					structuredClone(rawContent),
				);

				console.log(JSON.stringify(postTreatment));

				res.json(postTreatment);
				return;
			}
			const postTreatment = convertDevsToReactFlow(
				structuredClone(diagramExample1),
			);
			res.json(postTreatment);
			console.log(JSON.stringify(postTreatment));
			return;
		} catch (error) {
			console.error("Erreur lors de l’appel à vLLM :", error);
			res.status(500).json({
				error: "Erreur lors de la génération du diagramme avec l’IA.",
			});
			return;
		}
	},
);

// **Route : Générer un modèle**
router.post(
	"/generate-model",
	authenticateToken,
	async (req: GenerateModelRequest, res: Response): Promise<void> => {
		const { modelName, modelType, previousModelsCode, userPrompt } = req.body;

		if (!modelName || modelName.trim() === "") {
			res.status(400).json({
				error:
					"Le champ 'modelName' est requis et doit être une chaîne non vide.",
			});
			return;
		}
		if (!modelType || modelType.trim() === "") {
			res.status(400).json({
				error:
					"Le champ 'modelType' est requis et doit être une chaîne non vide.",
			});
			return;
		}
		if (!previousModelsCode) {
			res.status(400).json({
				error:
					"Le champ 'previousModelsCode' est requis et doit être une chaîne.",
			});
			return;
		}
		if (!userPrompt || userPrompt.trim() === "") {
			res.status(400).json({
				error:
					"Le champ 'userPrompt' est requis et doit être une chaîne non vide.",
			});
			return;
		}

		const fullPrompt = `
		Model Name: ${modelName}
		Model Type: ${modelType}

		Previous Models Code:
		${previousModelsCode}

		User Description: ${userPrompt.trim()}
		`;

		try {
			const completion = await openai.chat.completions.create({
				model: "llama-3.3-70b-instruct",
				messages: [
					{ role: "system", content: modelPrompt.trim() },
					{ role: "user", content: fullPrompt },
				],
				max_tokens: 1000,
				temperature: 0.9,
				top_p: 0.7,
			});

			const rawContent = completion.choices[0]?.message?.content;

			if (!rawContent) {
				res.status(500).json({
					error: "Erreur lors de la génération du diagramme avec l’IA.",
				});
				return;
			}

			if (!rawContent || !rawContent) {
				res.status(500).json({
					error: "Erreur lors de la génération du diagramme avec l’IA.",
				});
				return;
			}

			res.json(rawContent);
			return;
		} catch (error) {
			console.error("Erreur lors de l’appel à vLLM :", error);
			res.status(500).json({ error: "Erreur lors de l'appel au modèle AI." });
			return;
		}
	},
);

export default router;
