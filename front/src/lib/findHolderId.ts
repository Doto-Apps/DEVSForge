export const findHolderId = (source: string, target: string) => {
	const parent = (id: string) =>
		id.includes("/") ? id.slice(0, id.lastIndexOf("/")) : null;
	const sourceParent = parent(source),
		targetParent = parent(target);
	if (source === target) return sourceParent;
	if (source === targetParent) return source;
	if (target === sourceParent) return target;
	return sourceParent && sourceParent === targetParent ? sourceParent : null;
};
