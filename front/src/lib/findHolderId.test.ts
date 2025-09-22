import { describe, expect, it } from "vitest";
import { findHolderId } from "./findHolderId";

describe("findHolderId", () => {
	it("should return same direct parent", () => {
		expect(findHolderId("A/B/C", "A/B/D")).toBe("A/B");
	});
	it("should return the left side as parent", () => {
		expect(findHolderId("A/B", "A/B/D")).toBe("A/B");
	});
	it("should return right side as parent", () => {
		expect(findHolderId("A/B/C", "A/B")).toBe("A/B");
	});
	it("should return null", () => {
		expect(findHolderId("A/E/C", "A/B/D")).toBe(null);
		expect(findHolderId("A:B/C", "A/B/D")).toBe(null);
		expect(findHolderId("A", "A")).toBe(null);
		expect(findHolderId("A/B", "A/B")).toBe(null);
	});
});
