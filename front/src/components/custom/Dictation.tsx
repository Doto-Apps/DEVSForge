import { Loader2, Mic, Square, Trash2, RefreshCw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { client } from "@/api/client";
import { Button } from "@/components/ui/button";

const MAX_BYTES = 3 * 1024 * 1024;
const MAX_SECONDS = 120;

// Stopping a recording transcribes it; discarded recordings are never sent.
export function Dictation({
	value,
	onChange,
	disabled = false,
}: {
	value: string;
	onChange: (value: string) => void;
	disabled?: boolean;
}) {
	const [phase, setPhase] = useState<
		"idle" | "permission" | "recording" | "recorded" | "transcribing"
	>("idle");
	const [error, setError] = useState("");
	const [seconds, setSeconds] = useState(0);
	const [audioURL, setAudioURL] = useState("");
	const [notice, setNotice] = useState("");
	const recorder = useRef<MediaRecorder>();
	const stream = useRef<MediaStream>();
	const audio = useRef<Blob>();
	const chunks = useRef<Blob[]>([]);
	const size = useRef(0);
	const timer = useRef<ReturnType<typeof setInterval>>();
	const request = useRef<AbortController>();
	const alive = useRef(false);
	const epoch = useRef(0);
	const latest = useRef({ value, onChange });
	latest.current = { value, onChange };
	const preview = useRef("");
	const stopTracks = () => {
		stream.current?.getTracks().forEach((track) => {
			track.stop();
		});
		stream.current = undefined;
	};
	const clearTimer = () => {
		if (timer.current) clearInterval(timer.current);
		timer.current = undefined;
	};
	const discard = () => {
		epoch.current += 1;
		request.current?.abort();
		if (recorder.current?.state === "recording") recorder.current.stop();
		stopTracks();
		clearTimer();
		chunks.current = [];
		audio.current = undefined;
		if (preview.current) URL.revokeObjectURL(preview.current);
		preview.current = "";
		if (alive.current) {
			setAudioURL("");
			setPhase("idle");
			setSeconds(0);
		}
	};
	// biome-ignore lint/correctness/useExhaustiveDependencies: Resource cleanup runs on unmount, not on each recorder state update.
	useEffect(() => {
		alive.current = true;
		return () => {
			alive.current = false;
			discard();
		};
	}, []);
	const start = async () => {
		if (disabled || phase !== "idle") return;
		setError("");
		setNotice("");
		if (
			!window.isSecureContext ||
			!navigator.mediaDevices?.getUserMedia ||
			!window.MediaRecorder
		) {
			setError(
				"Microphone recording requires HTTPS (or localhost) and a supported browser.",
			);
			return;
		}
		const generation = ++epoch.current;
		setPhase("permission");
		try {
			const media = await navigator.mediaDevices.getUserMedia({
				audio: { channelCount: 1 },
				video: false,
			});
			if (!alive.current || generation !== epoch.current) {
				media.getTracks().forEach((track) => {
					track.stop();
				});
				return;
			}
			stream.current = media;
			const mime = [
				"audio/webm;codecs=opus",
				"audio/mp4",
				"audio/ogg;codecs=opus",
				"audio/webm",
			].find((type) => MediaRecorder.isTypeSupported(type));
			const recording = new MediaRecorder(media, {
				...(mime ? { mimeType: mime } : {}),
				audioBitsPerSecond: 64000,
			});
			recorder.current = recording;
			chunks.current = [];
			size.current = 0;
			recording.ondataavailable = (event) => {
				if (!alive.current || generation !== epoch.current || !event.data.size)
					return;
				size.current += event.data.size;
				chunks.current.push(event.data);
				if (size.current > MAX_BYTES) {
					discard();
					setError(
						"The recording exceeded 3 MiB. Please record a shorter dictation.",
					);
				}
			};
			recording.onerror = () => {
				if (alive.current && generation === epoch.current) {
					discard();
					setError("Microphone recording failed. Try again.");
				}
			};
			recording.onstop = () => {
				if (!alive.current || generation !== epoch.current) return;
				stopTracks();
				clearTimer();
				const blob = new Blob(chunks.current, {
					type: recording.mimeType || chunks.current[0]?.type || "audio/webm",
				});
				chunks.current = [];
				if (!blob.size || blob.size > MAX_BYTES) {
					setError("No usable recording. Please try again.");
					setPhase("idle");
					return;
				}
				audio.current = blob;
				preview.current = URL.createObjectURL(blob);
				setAudioURL(preview.current);
				void transcribe();
			};
			recording.start(1000);
			setSeconds(0);
			setPhase("recording");
			const started = Date.now();
			timer.current = setInterval(() => {
				const elapsed = Math.floor((Date.now() - started) / 1000);
				setSeconds(elapsed);
				if (elapsed >= MAX_SECONDS && recording.state === "recording")
					recording.stop();
			}, 250);
		} catch (e) {
			if (!alive.current || generation !== epoch.current) return;
			stopTracks();
			setPhase("idle");
			setError(
				e instanceof DOMException && e.name === "NotAllowedError"
					? "Microphone permission was denied. Allow it in your browser settings."
					: "Could not open the microphone. Check that it is connected and available.",
			);
		}
	};
	const transcribe = async () => {
		if (!audio.current) return;
		const generation = epoch.current;
		setPhase("transcribing");
		setError("");
		const controller = new AbortController();
		request.current = controller;
		const timeout = setTimeout(() => controller.abort(), 100000);
		const mime = audio.current.type;
		const ext = mime.includes("mp4")
			? "mp4"
			: mime.includes("ogg")
				? "ogg"
				: mime.includes("wav")
					? "wav"
					: mime.includes("mpeg")
						? "mp3"
						: "webm";
		try {
			const form = new FormData();
			form.append("file", audio.current, `dictation.${ext}`);
			const { data, error: apiError } = await client.POST(
				"/user/settings/ai/transcriptions",
				{
					body: form as unknown as { file: string },
					bodySerializer: (body) => body as unknown as FormData,
					signal: controller.signal,
				},
			);
			if (!alive.current || generation !== epoch.current) return;
			if (apiError || !data?.text?.trim())
				throw new Error(
					(apiError as { error?: string })?.error ||
						"No transcript was returned. Check the voice provider in Settings.",
				);
			const current = latest.current;
			current.onChange(
				`${current.value.trimEnd()}${current.value.trim() ? "\n" : ""}${data.text.trim()}`,
			);
			discard();
			setNotice("Transcript added. Review it before generating.");
		} catch (e) {
			if (alive.current && generation === epoch.current) {
				setPhase("recorded");
				setError(
					controller.signal.aborted
						? "Request cancelled or timed out. Your recording is still available."
						: e instanceof Error
							? e.message
							: "Transcription failed.",
				);
			}
		} finally {
			clearTimeout(timeout);
		}
	};
	return (
		<div className="mt-2 space-y-2">
			<div className="flex flex-wrap items-center gap-2">
				{phase === "idle" && (
					<Button
						type="button"
						size="sm"
						variant="ghost"
						className="h-7 px-2 text-xs"
						disabled={disabled}
						onClick={start}
					>
						<Mic size={13} />
						Dictate
					</Button>
				)}
				{phase === "permission" && (
					<Button type="button" variant="ghost" size="sm" onClick={discard}>
						<Loader2 className="animate-spin" size={13} />
						Cancel microphone request
					</Button>
				)}
				{phase === "recording" && (
					<>
						<Button
							type="button"
							size="sm"
							variant="secondary"
							onClick={() => recorder.current?.stop()}
						>
							<Square size={13} />
							Stop recording
						</Button>
						<span
							role="status"
							className="text-xs tabular-nums text-muted-foreground"
						>
							{seconds}s / {MAX_SECONDS}s
						</span>
					</>
				)}
				{phase === "recorded" && (
					<Button
						type="button"
						size="sm"
						variant="secondary"
						disabled={disabled}
						onClick={transcribe}
					>
						<RefreshCw size={13} />
						Retry transcription
					</Button>
				)}
				{phase === "transcribing" && (
					<Button
						type="button"
						size="sm"
						variant="ghost"
						onClick={() => request.current?.abort()}
					>
						<Loader2 className="animate-spin" size={13} />
						Cancel transcription
					</Button>
				)}
				{(phase === "recorded" || phase === "recording") && (
					<Button
						type="button"
						size="sm"
						variant="ghost"
						onClick={discard}
						aria-label="Discard recording"
					>
						<Trash2 size={13} />
					</Button>
				)}
			</div>
			{audioURL && phase === "recorded" && (
				<audio controls src={audioURL} className="h-8 w-full max-w-sm">
					<track kind="captions" />
				</audio>
			)}
			{phase !== "idle" && (
				<p className="text-[11px] leading-5 text-muted-foreground">
					Recording stops trigger transcription with your configured provider.
					Up to 2 minutes / 3 MiB.
				</p>
			)}
			{error && (
				<p role="alert" className="text-xs leading-5 text-destructive">
					{error}{" "}
					<Link className="underline" to="/settings">
						Voice settings
					</Link>
				</p>
			)}
			{notice && (
				<p role="status" className="text-xs text-muted-foreground">
					{notice}
				</p>
			)}
		</div>
	);
}
