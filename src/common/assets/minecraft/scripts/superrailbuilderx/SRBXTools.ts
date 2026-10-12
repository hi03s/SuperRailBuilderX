/** Clockwise order, starting at twelve o'clock. No client-only dependencies. */
// AE's include expansion strips Unicode escape backslashes. Build names at runtime.
function toolName(hex: string): string {
	return String.fromCharCode.apply(
		null,
		hex.split(" ").map((unit) => parseInt(unit, 16)),
	);
}
const tools = [
	{
		// レール生成A
		name: toolName("30ec 30fc 30eb 751f 6210 41"),
		model: "SuperRailBuilderX_builder1",
		icon: "icon_builder1.png",
	},
	{
		// レール生成B
		name: toolName("30ec 30fc 30eb 751f 6210 42"),
		model: "SuperRailBuilderX_builder2",
		icon: "icon_builder2.png",
	},
	{
		// 線路分割
		name: toolName("7dda 8def 5206 5272"),
		model: "SuperRailBuilderX_RailSplitter",
		icon: "icon_rail_splitter.png",
	},
	{
		// 線路移動
		name: toolName("7dda 8def 79fb 52d5"),
		model: "SuperRailBuilderX_RailMover",
		icon: "icon_rail_mover.png",
	},
	{
		// 複線コピー
		name: toolName("8907 7dda 30b3 30d4 30fc"),
		model: "SuperRailBuilderX_DoubleTrackCopy",
		icon: "icon_double_track_copy.png",
	},
	{
		// カント整形
		name: toolName("30ab 30f3 30c8 6574 5f62"),
		model: "SuperRailBuilderX_CantFormatter",
		icon: "icon_cant_formatter.png",
	},
	{
		// 分岐生成
		name: toolName("5206 5c90 751f 6210"),
		model: "SuperRailBuilderX_BranchBuilder",
		icon: "icon_branch_builder.png",
	},
	{
		// 組ホーム
		name: toolName("7d44 30db 30fc 30e0"),
		model: "SuperRailBuilderX_PlatformBuilder",
		icon: "icon_platform_builder.png",
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
	"platformBuilderRequest",
];

export function toolIndex(model: string): number {
	model = String(model);
	for (let i = 0; i < tools.length; i++)
		if (tools[i].model === model) return i;
	return -1;
}

export function wheelLayout(
	width: number,
	height: number,
): { outer: number; inner: number; label: number } {
	const outer = Math.max(48, Math.min(132, width / 2 - 12, height / 2 - 24));
	return { outer, inner: outer * 0.32, label: outer * 0.72 };
}

export function wheelIndex(
	dx: number,
	dy: number,
	current: number,
	inner: number = 32,
): number {
	if (dx * dx + dy * dy <= inner * inner) return current;
	const angle = Math.atan2(dx, -dy);
	const count = tools.length;
	return (Math.round(angle / ((Math.PI * 2) / count)) + count) % count;
}
