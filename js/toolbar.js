/* ══════════════════════════════════════════════
   TOOLBAR — Buttons & brush controls
   ══════════════════════════════════════════════ */

const Toolbar = (() => {
    function init() {
        // Undo / Redo
        document.getElementById('btn-undo').addEventListener('click', () => CanvasBoard.undo());
        document.getElementById('btn-redo').addEventListener('click', () => CanvasBoard.redo());

        // Clear
        document.getElementById('btn-clear').addEventListener('click', () => {
            if (!CanvasBoard.hasStrokes()) return;
            Modal.confirm('Tout effacer ?', 'Cette action supprimera tous les traits du canvas.', () => {
                CanvasBoard.clear();
            });
        });

        // Save
        document.getElementById('btn-save').addEventListener('click', () => {
            Modal.openSave();
        });

        // History toggle
        document.getElementById('btn-history').addEventListener('click', () => {
            History.togglePanel();
        });

        // Brush size slider
        const slider = document.getElementById('brush-slider');
        const display = document.getElementById('brush-size-display');
        slider.addEventListener('input', () => {
            const size = parseInt(slider.value, 10);
            CanvasBoard.setBrushSize(size);
            display.textContent = size;
        });

        // Zoom controls
        document.getElementById('btn-zoom-in').addEventListener('click', () => CanvasBoard.zoomIn());
        document.getElementById('btn-zoom-out').addEventListener('click', () => CanvasBoard.zoomOut());
        document.getElementById('btn-zoom-reset').addEventListener('click', () => CanvasBoard.zoomReset());
        document.getElementById('zoom-level').addEventListener('dblclick', () => CanvasBoard.zoomReset());
    }

    return { init };
})();
