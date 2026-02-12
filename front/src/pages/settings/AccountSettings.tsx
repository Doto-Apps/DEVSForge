import type { components } from "@/api/v1";
import { client } from "@/api/client";
import NavHeader from "@/components/nav/nav-header";
import { Badge } from "@/components/ui/badge";
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
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

type UserAISettingsResponse =
	components["schemas"]["response.UserAISettingsResponse"];

const DEFAULT_SETTINGS: UserAISettingsResponse = {
	apiUrl: "",
	apiModel: "",
	hasApiKey: false,
	apiKeyMasked: "",
};

export function AccountSettings() {
	const { toast } = useToast();

	const [isLoading, setIsLoading] = useState(true);
	const [isSaving, setIsSaving] = useState(false);
	const [settings, setSettings] = useState<UserAISettingsResponse>(
		DEFAULT_SETTINGS,
	);
	const [apiUrl, setApiUrl] = useState("");
	const [apiModel, setApiModel] = useState("");
	const [apiKey, setApiKey] = useState("");

	const applySettings = useCallback((nextSettings: UserAISettingsResponse) => {
		setSettings(nextSettings);
		setApiUrl(nextSettings.apiUrl ?? "");
		setApiModel(nextSettings.apiModel ?? "");
		setApiKey("");
	}, []);

	const loadSettings = useCallback(async () => {
		try {
			setIsLoading(true);
			const { data, error } = await client.GET("/user/settings/ai");
			if (error || !data) {
				throw new Error("Failed to load AI settings.");
			}
			applySettings(data);
		} catch (error) {
			toast({
				title: "Failed to load settings",
				description: (error as Error).message,
				variant: "destructive",
			});
		} finally {
			setIsLoading(false);
		}
	}, [applySettings, toast]);

	useEffect(() => {
		void loadSettings();
	}, [loadSettings]);

	const onSave = async () => {
		try {
			setIsSaving(true);
			const body: components["schemas"]["request.UpdateUserAISettingsRequest"] =
				{
					apiUrl: apiUrl.trim(),
					apiModel: apiModel.trim(),
				};
			if (apiKey.trim()) {
				body.apiKey = apiKey.trim();
			}

			const { data, error } = await client.PATCH("/user/settings/ai", {
				body,
			});
			if (error || !data) {
				throw new Error("Failed to save AI settings.");
			}

			applySettings(data);
			toast({
				title: "Settings saved",
				description: "Your AI provider settings have been updated.",
			});
		} catch (error) {
			toast({
				title: "Failed to save settings",
				description: (error as Error).message,
				variant: "destructive",
			});
		} finally {
			setIsSaving(false);
		}
	};

	return (
		<div className="flex flex-col h-screen w-full">
			<NavHeader
				breadcrumbs={[{ label: "Home", href: "/" }, { label: "Settings" }]}
				showNavActions={false}
				showModeToggle
			/>
			<div className="flex-1 overflow-y-auto">
				<div className="mx-auto w-full max-w-3xl p-6">
					<Card>
						<CardHeader>
							<CardTitle>AI Provider Settings</CardTitle>
							<CardDescription>
								Configure the API endpoint, key, and model used for your AI
								generation requests.
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-6">
							<div className="space-y-2">
								<Label htmlFor="ai-api-url">API URL</Label>
								<Input
									id="ai-api-url"
									value={apiUrl}
									onChange={(event) => setApiUrl(event.target.value)}
									placeholder="https://api.openai.com/v1"
									disabled={isLoading || isSaving}
								/>
							</div>

							<div className="space-y-2">
								<Label htmlFor="ai-api-model">API Model</Label>
								<Input
									id="ai-api-model"
									value={apiModel}
									onChange={(event) => setApiModel(event.target.value)}
									placeholder="gpt-4.1-mini"
									disabled={isLoading || isSaving}
								/>
							</div>

							<div className="space-y-2">
								<Label htmlFor="ai-api-key">API Key</Label>
								<Input
									id="ai-api-key"
									type="password"
									value={apiKey}
									onChange={(event) => setApiKey(event.target.value)}
									placeholder={
										settings.hasApiKey
											? "Enter a new key to replace the current one"
											: "sk-..."
									}
									disabled={isLoading || isSaving}
								/>
								{settings.hasApiKey ? (
									<div className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
										<Badge variant="secondary" className="shrink-0">
											Stored key
										</Badge>
										<span
											className="min-w-0 truncate font-mono"
											title={settings.apiKeyMasked || "Configured"}
										>
											{settings.apiKeyMasked || "Configured"}
										</span>
									</div>
								) : (
									<div className="text-xs text-muted-foreground">
										No key stored yet.
									</div>
								)}
							</div>

							<div className="flex justify-end">
								<Button onClick={onSave} disabled={isLoading || isSaving}>
									{isSaving ? (
										<>
											<Loader2 className="h-4 w-4 animate-spin" />
											Saving...
										</>
									) : (
										"Save settings"
									)}
								</Button>
							</div>
						</CardContent>
					</Card>
				</div>
			</div>
		</div>
	);
}
