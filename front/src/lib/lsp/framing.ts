/** UTF-8 stdio framing used by the native Go and Java language servers. */
export class LSPFrames {
	private bytes = new Uint8Array(0);
	private decoder = new TextDecoder();

	push(chunk: Uint8Array, emit: (message: unknown) => void) {
		const next = new Uint8Array(this.bytes.length + chunk.length);
		next.set(this.bytes);
		next.set(chunk, this.bytes.length);
		this.bytes = next;
		while (this.bytes.length) {
			let end = -1;
			for (let i = 0; i + 3 < this.bytes.length; i++) {
				if (
					this.bytes[i] === 13 &&
					this.bytes[i + 1] === 10 &&
					this.bytes[i + 2] === 13 &&
					this.bytes[i + 3] === 10
				) {
					end = i;
					break;
				}
			}
			if (end < 0) {
				if (this.bytes.length > 8192)
					throw new Error("Invalid language-server header");
				return;
			}
			const header = this.decoder.decode(this.bytes.subarray(0, end));
			const match = /^Content-Length:\s*(\d+)\s*$/im.exec(header);
			const length = match ? Number(match[1]) : -1;
			if (length < 0 || length > 16 * 1024 * 1024)
				throw new Error("Invalid language-server message length");
			if (this.bytes.length < end + 4 + length) return;
			emit(
				JSON.parse(
					this.decoder.decode(this.bytes.subarray(end + 4, end + 4 + length)),
				),
			);
			this.bytes = this.bytes.slice(end + 4 + length);
		}
	}
}

export function frame(message: unknown) {
	const encoder = new TextEncoder();
	const body = encoder.encode(JSON.stringify(message));
	const header = encoder.encode(`Content-Length: ${body.length}\r\n\r\n`);
	const bytes = new Uint8Array(header.length + body.length);
	bytes.set(header);
	bytes.set(body, header.length);
	return bytes;
}
