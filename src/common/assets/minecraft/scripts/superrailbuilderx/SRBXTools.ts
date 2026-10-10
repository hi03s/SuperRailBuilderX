/** Clockwise order, starting at twelve o'clock. No client-only dependencies. */
const tools = [
	{
		name: "レール生成A",
		model: "SuperRailBuilderX_builder1",
		icon: "icon_builder1.png",
	},
	{
		name: "線路分割",
		model: "SuperRailBuilderX_RailSplitter",
		icon: "icon_rail_splitter.png",
	},
	{
		name: "線路移動",
		model: "SuperRailBuilderX_RailMover",
		icon: "icon_rail_mover.png",
	},
	{
		name: "複線コピー",
		model: "SuperRailBuilderX_DoubleTrackCopy",
		icon: "icon_double_track_copy.png",
	},
	{
		name: "カント整形",
		model: "SuperRailBuilderX_CantFormatter",
		icon: "icon_cant_formatter.png",
	},
	{
		name: "分岐生成",
		model: "SuperRailBuilderX_BranchBuilder",
		icon: "icon_branch_builder.png",
	},
];
export const SRBX_TOOLS = tools;
export const SRBX_TOOL_REQUESTS = [
	"builder1Request",
	"railSplitterRequest",
	"railPositionMove",
	"doubleTrackCopyRequest",
	"cantFormatterRequest",
	"branchBuilderRequest",
];

export function toolIndex(model: string): number {
	for (let i = 0; i < tools.length; i++)
		if (tools[i].model === model) return i;
	return -1;
}

export function wheelIndex(dx: number, dy: number, current: number): number {
	if (dx * dx + dy * dy < 12 * 12) return current;
	const angle = Math.atan2(dx, -dy);
	return (Math.round(angle / (Math.PI / 3)) + 6) % 6;
}
