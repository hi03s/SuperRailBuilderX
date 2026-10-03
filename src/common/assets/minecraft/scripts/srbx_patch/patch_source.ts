/** Target-engine globals used only when the serialized function is evaluated. */
declare let __SRBX_RAIL_RENDER_PATCHED__: boolean;
declare let renderRailDynamic2: any;
declare let renderRailMapDynamic: any;
declare const GL11: any;

/**
 * AE's include loader treats script text as a Java regex replacement, stripping
 * backslashes. Serialize a function instead of embedding escaped source text.
 * Keep the outer transform for the non-branching half of the switch.
 */
export const RAIL_RENDER_PATCH_SOURCE =
	"(" +
	function () {
		if (typeof __SRBX_RAIL_RENDER_PATCHED__ === "undefined") {
			var __srbx_original_renderRailDynamic2 = renderRailDynamic2;
			renderRailDynamic2 = function (tileEntity, par2, par4, par6) {
				if (
					tileEntity == null ||
					tileEntity.getSwitch() == null ||
					typeof renderRailMapDynamic !== "function"
				) {
					return __srbx_original_renderRailDynamic2.apply(
						this,
						arguments,
					);
				}

				var positions = tileEntity.getRailPositions();
				var rp =
					positions != null && positions.length > 0
						? positions[0]
						: null;
				if (rp == null) {
					return __srbx_original_renderRailDynamic2.apply(
						this,
						arguments,
					);
				}

				var offsetX = Number(rp.offsetX);
				var offsetZ = Number(rp.offsetZ);
				if (!isFinite(offsetX)) offsetX = 0.0;
				if (!isFinite(offsetZ)) offsetZ = 0.0;
				if (offsetX === 0.0 && offsetZ === 0.0) {
					return __srbx_original_renderRailDynamic2.apply(
						this,
						arguments,
					);
				}

				var __srbx_active_renderRailMapDynamic = renderRailMapDynamic;
				renderRailMapDynamic = function () {
					GL11.glPushMatrix();
					GL11.glTranslatef(-offsetX, 0.0, -offsetZ);
					try {
						return __srbx_active_renderRailMapDynamic.apply(
							this,
							arguments,
						);
					} finally {
						GL11.glPopMatrix();
					}
				};

				try {
					return __srbx_original_renderRailDynamic2.apply(
						this,
						arguments,
					);
				} finally {
					renderRailMapDynamic = __srbx_active_renderRailMapDynamic;
				}
			};
			__SRBX_RAIL_RENDER_PATCHED__ = true;
		}
	}.toString() +
	")();";
