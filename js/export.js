/* ══════════════════════════════════════════════
   EXPORT — High quality single & vertical stacking
   ══════════════════════════════════════════════ */

const ExportEngine = (() => {

    const LOGO_PATH = 'assets/logo.png';
    const BG_COLOR = '#111116';
    const ACCENT_COLOR = '#ffffff';
    const SUBTEXT_COLOR = '#71717a';

    /**
     * Loads an image from a path
     */
    function loadImage(src) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => {
                console.warn(`Failed to load logo from ${src}`);
                resolve(null); // Resolve with null so export can proceed without logo
            };
            img.src = src;
        });
    }

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
     * Renders a drawing section to a context
     */
    async function renderDrawingToContext(drawing, ctx, width, heightPerDrawing, yOffset, pixelRatio, logoImg) {
        const titleHeight = 120 * pixelRatio;
        const padding = 50 * pixelRatio;

        // Section Background (Uniform dark)
        ctx.fillStyle = BG_COLOR;
        ctx.fillRect(0, yOffset, width, heightPerDrawing + titleHeight);

        // Draw Logo (Suggesto) - Premium sizing
        if (logoImg) {
            const logoSize = 60 * pixelRatio;
            ctx.drawImage(logoImg, padding, yOffset + 30 * pixelRatio, logoSize, logoSize);
        }

        // Draw Header (Title & Date)
        ctx.save();
        ctx.fillStyle = ACCENT_COLOR;
        ctx.font = `600 ${28 * pixelRatio}px 'Inter', sans-serif`;
        const textX = padding + (logoImg ? 80 * pixelRatio : 0);
        ctx.fillText(drawing.name, textX, yOffset + 55 * pixelRatio);

        const date = new Date(drawing.createdAt).toLocaleDateString('fr-FR', {
            day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
        });
        ctx.fillStyle = SUBTEXT_COLOR;
        ctx.font = `${14 * pixelRatio}px 'Inter', sans-serif`;
        ctx.fillText(date, textX, yOffset + 85 * pixelRatio);
        ctx.restore();

        // Draw Strokes with auto-centering and fitting
        const strokeSpaceWidth = width;
        const strokeSpaceHeight = heightPerDrawing;

        ctx.save();
        ctx.translate(0, yOffset + titleHeight);
        // We use the pixelRatio to ensure crispness, but renderStrokesToContext handles the internal scaling to fit
        ctx.scale(pixelRatio, pixelRatio);
        CanvasBoard.renderStrokesToContext(drawing.strokes, ctx, strokeSpaceWidth / pixelRatio, strokeSpaceHeight / pixelRatio, 40);
        ctx.restore();
    }

    /**
     * Exports drawings (single or bundle)
     */
    async function exportDrawings(selectedDrawings) {
        if (!selectedDrawings || selectedDrawings.length === 0) return;

        const container = document.getElementById('canvas-container');
        const baseWidth = container.clientWidth;
        const baseHeight = container.clientHeight;
        const pixelRatio = selectedDrawings.length > 1 ? 2 : 3; // 3x for single, 2x for bundle to save memory

        const canvasWidth = baseWidth * pixelRatio;
        const canvasHeightPerDrawing = baseHeight * pixelRatio;
        const titleHeight = 120 * pixelRatio;

        const totalHeight = (canvasHeightPerDrawing + titleHeight) * selectedDrawings.length;

        const exportCanvas = document.createElement('canvas');
        exportCanvas.width = canvasWidth;
        exportCanvas.height = totalHeight;
        const ctx = exportCanvas.getContext('2d');

        const logoImg = await loadImage(LOGO_PATH);

        for (let i = 0; i < selectedDrawings.length; i++) {
            const yOffset = i * (canvasHeightPerDrawing + titleHeight);
            await renderDrawingToContext(selectedDrawings[i], ctx, canvasWidth, canvasHeightPerDrawing, yOffset, pixelRatio, logoImg);

            // Divider
            if (i < selectedDrawings.length - 1) {
                ctx.strokeStyle = '#2a2a35';
                ctx.lineWidth = 1 * pixelRatio;
                ctx.beginPath();
                ctx.moveTo(0, yOffset + titleHeight + canvasHeightPerDrawing);
                ctx.lineTo(canvasWidth, yOffset + titleHeight + canvasHeightPerDrawing);
                ctx.stroke();
            }
        }

        const dataUrl = exportCanvas.toDataURL('image/png', 1);
        const fileName = selectedDrawings.length > 1
            ? `sketch_bundle_${Date.now()}.png`
            : `sketch_${selectedDrawings[0].name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.png`;

        download(dataUrl, fileName);
    }

    return { exportDrawings, exportSingle: (d) => exportDrawings([d]), exportVertical: (ds) => exportDrawings(ds) };
})();
