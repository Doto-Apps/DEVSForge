import { Loader2, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { client } from "@/api/client";
import type { components } from "@/api/v1";
import NavHeader from "@/components/nav/nav-header";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

type Settings = components["schemas"]["response.UserAISettingsResponse"];
type Connection = {
	url: string;
	model: string;
	key: string;
	clearKey: boolean;
};
const empty: Connection = { url: "", model: "", key: "", clearKey: false };

function ProviderFields({
	purpose,
	value,
	onChange,
	hasKey,
	masked,
	savedURL,
	disabled,
}: {
	purpose: "generation" | "transcription";
	value: Connection;
	onChange: (value: Connection) => void;
	hasKey?: boolean;
	masked?: string;
	savedURL?: string;
	disabled: boolean;
}) {
	const [models, setModels] = useState<string[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");
	const [loaded, setLoaded] = useState(false);
	const [discoveredFor, setDiscoveredFor] = useState("");
	const prefix = purpose === "generation" ? "ai" : "transcription";
	const credentialIdentity = JSON.stringify([
		value.url,
		value.key,
		value.clearKey,
	]);
	const currentModels = discoveredFor === credentialIdentity ? models : [];
	const load = async () => {
		setLoading(true);
		setError("");
		setLoaded(false);
		setModels([]);
		setDiscoveredFor("");
		try {
			const { data, error: apiError } = await client.POST(
				"/user/settings/ai/models",
				{
					body: {
						purpose,
						apiUrl: value.url.trim(),
						...(value.clearKey
							? { apiKey: "" }
							: value.key.trim()
								? { apiKey: value.key.trim() }
								: {}),
					},
				},
			);
			if (apiError || !data)
				throw new Error(
					(apiError as { error?: string })?.error ||
						"Could not load models. You can still enter an ID manually.",
				);
			setModels(
				(data.models ?? []).flatMap((model) => (model.id ? [model.id] : [])),
			);
			setDiscoveredFor(credentialIdentity);
			setLoaded(true);
		} catch (e) {
			setError(e instanceof Error ? e.message : "Could not load models.");
		} finally {
			setLoading(false);
		}
	};
	return (
		<div className="space-y-4">
			<div className="space-y-2">
				<Label htmlFor={`${prefix}-api-url`}>API URL</Label>
				<Input
					id={`${prefix}-api-url`}
					disabled={disabled || loading}
					placeholder="https://your-provider.example/v1"
					value={value.url}
					onChange={(e) => onChange({ ...value, url: e.target.value })}
				/>
			</div>
			<div className="space-y-2">
				<Label htmlFor={`${prefix}-api-key`}>API key</Label>
				<Input
					id={`${prefix}-api-key`}
					type="password"
					autoComplete="new-password"
					disabled={disabled || loading}
					placeholder={
						hasKey
							? "Leave blank to keep the stored key"
							: "Enter your provider key (if required)"
					}
					value={value.key}
					onChange={(e) =>
						onChange({ ...value, key: e.target.value, clearKey: false })
					}
				/>
				<div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
					<span>
						{value.clearKey
							? "Stored key will be removed."
							: hasKey
								? `Stored key: ${masked || "configured"}`
								: "No key stored."}
					</span>
					{hasKey && (
						<button
							type="button"
							disabled={disabled || loading}
							className="underline underline-offset-2"
							onClick={() =>
								onChange({ ...value, key: "", clearKey: !value.clearKey })
							}
						>
							{value.clearKey ? "Keep stored key" : "Remove stored key"}
						</button>
					)}
				</div>
				{hasKey &&
					savedURL?.replace(/\/+$/, "") !==
						value.url.trim().replace(/\/+$/, "") &&
					!value.key &&
					!value.clearKey && (
						<p className="text-xs text-muted-foreground">
							Enter the key for this new URL, or remove the stored key.
						</p>
					)}
			</div>
			<div className="flex flex-wrap items-center gap-3">
				<Button
					type="button"
					size="sm"
					variant="outline"
					disabled={disabled || loading || !value.url.trim()}
					onClick={load}
				>
					{loading ? (
						<Loader2 className="animate-spin" size={14} />
					) : (
						<RefreshCw size={14} />
					)}
					Load models
				</Button>
				<span className="text-xs text-muted-foreground">
					Uses the URL and key above, including unsaved changes.
				</span>
			</div>
			{error && (
				<p role="alert" className="text-xs leading-5 text-destructive">
					{error}
				</p>
			)}
			{loaded &&
				discoveredFor === credentialIdentity &&
				!currentModels.length && (
					<p role="status" className="text-xs text-muted-foreground">
						No model IDs returned. Enter an ID manually below.
					</p>
				)}
			{currentModels.length > 0 && (
				<Select
					value={currentModels.includes(value.model) ? value.model : undefined}
					onValueChange={(model) => onChange({ ...value, model })}
					disabled={disabled || loading}
				>
					<SelectTrigger aria-label={`Choose a ${purpose} model`}>
						<SelectValue placeholder="Select a discovered model" />
					</SelectTrigger>
					<SelectContent>
						{currentModels.map((id) => (
							<SelectItem key={id} value={id}>
								{id}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			)}
			<div className="space-y-2">
				<Label htmlFor={`${prefix}-api-model`}>Model ID</Label>
				<Input
					id={`${prefix}-api-model`}
					disabled={disabled || loading}
					value={value.model}
					placeholder="Select above or enter an exact model ID"
					onChange={(e) => onChange({ ...value, model: e.target.value })}
				/>
				<p className="text-xs leading-5 text-muted-foreground">
					The provider’s list may contain models for other uses. Choose one that
					supports{" "}
					{purpose === "generation"
						? "chat generation and structured JSON output"
						: "audio transcription"}
					.
				</p>
			</div>
		</div>
	);
}

export function AccountSettings() {
	const { toast } = useToast();
	const [settings, setSettings] = useState<Settings>();
	const [generation, setGeneration] = useState<Connection>(empty);
	const [transcription, setTranscription] = useState<Connection>(empty);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [loadError, setLoadError] = useState("");
	const apply = useCallback((data: Settings) => {
		setSettings(data);
		setGeneration({
			...empty,
			url: data.apiUrl ?? "",
			model: data.apiModel ?? "",
		});
		setTranscription({
			...empty,
			url: data.transcriptionApiUrl ?? "",
			model: data.transcriptionApiModel ?? "",
		});
	}, []);
	const load = useCallback(async () => {
		setLoading(true);
		setLoadError("");
		try {
			const { data, error } = await client.GET("/user/settings/ai");
			if (error || !data) throw new Error("Could not load provider settings.");
			apply(data);
		} catch (e) {
			setLoadError(e instanceof Error ? e.message : "Could not load settings.");
		} finally {
			setLoading(false);
		}
	}, [apply]);
	useEffect(() => {
		void load();
	}, [load]);
	const save = async () => {
		setSaving(true);
		try {
			const body: components["schemas"]["request.UpdateUserAISettingsRequest"] =
				{
					apiUrl: generation.url.trim(),
					apiModel: generation.model.trim(),
					transcriptionApiUrl: transcription.url.trim(),
					transcriptionApiModel: transcription.model.trim(),
					...(generation.clearKey
						? { apiKey: "" }
						: generation.key.trim()
							? { apiKey: generation.key.trim() }
							: {}),
					...(transcription.clearKey
						? { transcriptionApiKey: "" }
						: transcription.key.trim()
							? { transcriptionApiKey: transcription.key.trim() }
							: {}),
				};
			const { data, error } = await client.PATCH("/user/settings/ai", { body });
			if (error || !data)
				throw new Error(
					(error as { error?: string })?.error || "Could not save settings.",
				);
			apply(data);
			toast({
				title: "Settings saved",
				description: "Generation and dictation connections updated.",
			});
		} catch (e) {
			toast({
				title: "Could not save settings",
				description: e instanceof Error ? e.message : "Please try again.",
				variant: "destructive",
			});
		} finally {
			setSaving(false);
		}
	};
	const disabled = loading || saving || !!loadError;
	return (
		<div className="flex h-screen min-w-0 w-full flex-col">
			<NavHeader
				breadcrumbs={[{ href: "/", label: "Home" }, { label: "Settings" }]}
				showModeToggle
				showNavActions={false}
			/>
			<main className="flex-1 overflow-y-auto p-4 lg:p-6">
				<header className="mb-6 flex flex-wrap items-center justify-between gap-4">
					<div>
						<h1 className="text-2xl font-semibold tracking-tight">
							AI providers
						</h1>
						<p className="mt-2 text-sm text-muted-foreground">
							Configure generation and dictation independently, using compatible
							API endpoints.
						</p>
					</div>
					<Button onClick={save} disabled={disabled}>
						{saving && <Loader2 className="animate-spin" />}Save settings
					</Button>
				</header>
				{loadError && (
					<p role="alert" className="mb-4 text-sm text-destructive">
						{loadError}{" "}
						<Button variant="outline" size="sm" onClick={load}>
							Retry
						</Button>
					</p>
				)}
				<div className="grid items-start gap-5 xl:grid-cols-2">
					<Card>
						<CardHeader>
							<CardTitle className="text-lg">Model generation</CardTitle>
							<CardDescription>
								Used for structures, behavior code and AI corrections. The API
								must support compatible chat completions.
							</CardDescription>
						</CardHeader>
						<CardContent>
							<ProviderFields
								purpose="generation"
								value={generation}
								onChange={setGeneration}
								hasKey={settings?.hasApiKey}
								masked={settings?.apiKeyMasked}
								savedURL={settings?.apiUrl}
								disabled={disabled}
							/>
						</CardContent>
					</Card>
					<Card>
						<CardHeader>
							<CardTitle className="text-lg">Voice dictation</CardTitle>
							<CardDescription>
								Used only when you request transcription of a recording. The API
								must support compatible audio transcriptions; it can be a
								different provider.
							</CardDescription>
						</CardHeader>
						<CardContent>
							<ProviderFields
								purpose="transcription"
								value={transcription}
								onChange={setTranscription}
								hasKey={settings?.hasTranscriptionApiKey}
								masked={settings?.transcriptionApiKeyMasked}
								savedURL={settings?.transcriptionApiUrl}
								disabled={disabled}
							/>
							<p className="mt-4 text-xs leading-5 text-muted-foreground">
								Use the API base URL (including its version prefix, if
								required). Save the voice configuration before dictating.
								Stopping a recording automatically sends it to your configured
								provider for transcription.
							</p>
						</CardContent>
					</Card>
				</div>
			</main>
		</div>
	);
}
