import { describe, expect, it } from "vitest";
import { frame, LSPFrames } from "./framing";

describe("browser language-server stdio", () => {
	it("keeps UTF-8 content intact across byte splits and consecutive frames", () => {
		const messages = [
			{ id: 1, jsonrpc: "2.0", result: "🦊 été" },
			{ id: 2, jsonrpc: "2.0", result: { text: "模型" } },
		];
		const frames = new LSPFrames();
		const received: unknown[] = [];
		for (const message of messages)
			for (const byte of frame(message))
				frames.push(Uint8Array.of(byte), (value) => received.push(value));
		expect(received).toEqual(messages);
	});
	it("rejects invalid framing and oversized messages before parsing", () => {
		for (const header of [
			"garbage\r\n\r\n",
			"Content-Length: 999999999\r\n\r\n",
		]) {
			expect(() =>
				new LSPFrames().push(new TextEncoder().encode(header), () => {}),
			).toThrow();
		}
	});
});
