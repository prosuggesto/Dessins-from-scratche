/* ══════════════════════════════════════════════
   EXPORT — High quality single & vertical stacking
   ══════════════════════════════════════════════ */

const ExportEngine = (() => {

    /**
     * Triggers a browser download of a dataURL
     */
    function download(dataUrl, filename) {
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = filename;
        link.click();
    }

    /**
     * Exports a single drawing in high quality
     */
    function exportSingle(drawing) {
        const pixelRatio = 3; // 3x quality
        const dataUrl = CanvasBoard.toDataURL({
            pixelRatio: pixelRatio,
            strokeList: drawing.strokes,
            quality: 1
        });

        const safeName = drawing.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        download(dataUrl, `sketch_${safeName}.png`);
    }

    /**
     * Exports multiple drawings stacked vertically
     */
    async function exportVertical(selectedDrawings) {
        if (selectedDrawings.length === 0) return;

        const container = document.getElementById('canvas-container');
        const baseWidth = container.clientWidth;
        const baseHeight = container.clientHeight;
        const pixelRatio = 2; // 2x for multi-export to avoid massive file sizes but keep it crisp

        const canvasWidth = baseWidth * pixelRatio;
        const canvasHeightPerDrawing = baseHeight * pixelRatio;
        const titleHeight = 80 * pixelRatio; // Space for title/date

        const totalHeight = (canvasHeightPerDrawing + titleHeight) * selectedDrawings.length;

        const exportCanvas = document.createElement('canvas');
        exportCanvas.width = canvasWidth;
        exportCanvas.height = totalHeight;
        const ctx = exportCanvas.getContext('2d');

        // Dark background
        ctx.fillStyle = '#111116';
        ctx.fillRect(0, 0, canvasWidth, totalHeight);

        for (let i = 0; i < selectedDrawings.length; i++) {
            const drawing = selectedDrawings[i];
            const yOffset = i * (canvasHeightPerDrawing + titleHeight);

            // Draw Header (Title & Date)
            ctx.save();
            ctx.fillStyle = '#ffffff';
            ctx.font = `bold ${24 * pixelRatio}px 'Inter', sans-serif`;
            ctx.fillText(drawing.name, 40 * pixelRatio, yOffset + 40 * pixelRatio);

            const date = new Date(drawing.createdAt).toLocaleDateString('fr-FR', {
                day: '2-digit', month: 'short', year: 'numeric'
            });
            ctx.fillStyle = '#71717a';
            ctx.font = `${14 * pixelRatio}px 'Inter', sans-serif`;
            ctx.fillText(date, 40 * pixelRatio, yOffset + 65 * pixelRatio);
            ctx.restore();

            // Draw Strokes
            ctx.save();
            ctx.translate(0, yOffset + titleHeight);
            ctx.scale(pixelRatio, pixelRatio);
            CanvasBoard.renderStrokesToContext(drawing.strokes, ctx);
            ctx.restore();

            // Optional Divider
            if (i < selectedDrawings.length - 1) {
                ctx.strokeStyle = '#2a2a35';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(0, yOffset + titleHeight + canvasHeightPerDrawing + (titleHeight / 2));
                ctx.lineTo(canvasWidth, yOffset + titleHeight + canvasHeightPerDrawing + (titleHeight / 2));
                // ctx.stroke(); // commenting out for cleaner look unless asked
            }
        }

        const dataUrl = exportCanvas.toDataURL('image/png', 1);
        download(dataUrl, `sketch_bundle_${Date.now()}.png`);
    }

    return { exportSingle, exportVertical };
})();
