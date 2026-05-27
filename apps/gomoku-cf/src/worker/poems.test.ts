import { describe, expect, it } from "vitest";
import { pickRandomPoem } from "./poems";

describe("pickRandomPoem", () => {
	it("returns a poem with non-empty text", () => {
		const p = pickRandomPoem(() => 0);
		expect(p.text.length).toBeGreaterThan(0);
	});

	it("uses the rng to pick — first poem at rng=0", () => {
		const a = pickRandomPoem(() => 0);
		const b = pickRandomPoem(() => 0);
		expect(a.text).toBe(b.text);
	});

	it("returns different poems for different rng values", () => {
		// 0.0 picks index 0; 0.99 picks the last index. With at least
		// two poems in the bank those will differ.
		const first = pickRandomPoem(() => 0);
		const last = pickRandomPoem(() => 0.999);
		expect(first.text).not.toBe(last.text);
	});

	it("always returns a poem with author metadata", () => {
		for (let i = 0; i < 10; i++) {
			const p = pickRandomPoem(() => i / 10);
			expect(p.author).toBeTruthy();
		}
	});
});
