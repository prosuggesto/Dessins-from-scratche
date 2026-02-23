/* ══════════════════════════════════════════════
   APP — Main entry point & keyboard shortcuts
   ══════════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', () => {
    // Initialize all modules
    CanvasBoard.init();
    Palette.init();
    Toolbar.init();
    Modal.init();
    History.init();

    // ── Keyboard shortcuts ────────────────────
    document.addEventListener('keydown', (e) => {
        const ctrl = e.ctrlKey || e.metaKey;

        // Escape — close any modal / panel
        if (e.key === 'Escape') {
            if (Modal.isAnyOpen()) {
                Modal.closeAll();
            } else {
                History.closePanel();
            }
            return;
        }

        // Don't intercept when typing in inputs
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

        // Ctrl + Z — Undo
        if (ctrl && !e.shiftKey && e.key === 'z') {
            e.preventDefault();
            CanvasBoard.undo();
            return;
        }

        // Ctrl + Shift + Z — Redo
        if (ctrl && e.shiftKey && (e.key === 'z' || e.key === 'Z')) {
            e.preventDefault();
            CanvasBoard.redo();
            return;
        }

        // Ctrl + S — Save
        if (ctrl && e.key === 's') {
            e.preventDefault();
            Modal.openSave();
            return;
        }

        // Ctrl + = / + — Zoom in
        if (ctrl && (e.key === '=' || e.key === '+')) {
            e.preventDefault();
            CanvasBoard.zoomIn();
            return;
        }

        // Ctrl + - — Zoom out
        if (ctrl && e.key === '-') {
            e.preventDefault();
            CanvasBoard.zoomOut();
            return;
        }

        // Ctrl + 0 — Reset zoom
        if (ctrl && e.key === '0') {
            e.preventDefault();
            CanvasBoard.zoomReset();
            return;
        }
    });
});
