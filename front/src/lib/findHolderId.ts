export const findHolderId = (source: string, target: string) => {
	const s = source.split("/").reverse();
	const t = target.split("/").reverse();

	if (s[0] === t[0]) {
		return null;
	}
	if (s[0] === t[1]) {
		t.shift();
		return t.reverse().join("/");
	}
	if (s[1] === t[0]) {
		s.shift();
		return s.reverse().join("/");
	}
	if (s[1] === t[1]) {
		s.shift();
		return s.reverse().join("/");
	}

	return null;
};
