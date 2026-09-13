/**
 * Keep the original renderer script intact and remove only the duplicated
 * horizontal RailPosition offset from renderRailDynamic2's outer transform.
 * The RailMap used by switch rendering already contains that X/Z offset.
 */
export const RAIL_RENDER_PATCH_SOURCE = `
if (typeof __SRBX_RAIL_RENDER_PATCHED__ === "undefined") {
    var __srbx_original_renderRailDynamic2 = renderRailDynamic2;
    renderRailDynamic2 = function(tileEntity, par2, par4, par6) {
        if (tileEntity == null || tileEntity.getSwitch() == null) {
            return __srbx_original_renderRailDynamic2.apply(this, arguments);
        }

        var positions = tileEntity.getRailPositions();
        var rp = positions != null && positions.length > 0 ? positions[0] : null;
        if (rp == null) {
            return __srbx_original_renderRailDynamic2.apply(this, arguments);
        }

        var offsetX = Number(rp.offsetX);
        var offsetZ = Number(rp.offsetZ);
        if (!isFinite(offsetX)) offsetX = 0.0;
        if (!isFinite(offsetZ)) offsetZ = 0.0;

        return __srbx_original_renderRailDynamic2.call(
            this,
            tileEntity,
            par2 - offsetX,
            par4,
            par6 - offsetZ
        );
    };
    var __SRBX_RAIL_RENDER_PATCHED__ = true;
}
`;
