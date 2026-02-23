/* ══════════════════════════════════════════════
   CANVAS ENGINE — Freehand drawing with smoothing + zoom/pan + text input
   ══════════════════════════════════════════════ */

const CanvasBoard = (() => {
    /** @type {HTMLCanvasElement} */
    let canvas;
    /** @type {CanvasRenderingContext2D} */
    let ctx;

    let strokes = [];      // completed strokes
    let redoStack = [];    // undone strokes for redo
    let currentStroke = null;

    let currentColor = '#ffffff';
    let brushSize = 4;
    let isDrawing = false;

    // ── Text input state ────────────────────
    let textMode = false;
    let textCursorX = 0;
    let textCursorY = 0;
    let textBuffer = '';     // current line being typed
    let textFontFamily = 'Inter';
    let textFontSize = 24;
    const FONT_OPTIONS = [
        'Inter', 'Arial', 'Georgia', 'Courier New', 'Comic Sans MS',
        'Verdana', 'Times New Roman', 'Trebuchet MS', 'Impact', 'Palatino'
    ];

    // ── Zoom & Pan state ────────────────────
    let scale = 1;
    let offsetX = 0;
    let offsetY = 0;
    let isPanning = false;
    let panStartX = 0;
    let panStartY = 0;
    let spaceDown = false;

    const MIN_ZOOM = 0.2;
    const MAX_ZOOM = 5;
    const ZOOM_STEP = 0.15;

    // ── Init ──────────────────────────────────
    function init() {
        canvas = document.getElementById('draw-canvas');
        ctx = canvas.getContext('2d');
        resize();

        // Sync initial text state from DOM
        const fontSelect = document.getElementById('text-font-select');
        const sizeInput = document.getElementById('text-size-input');
        if (fontSelect) textFontFamily = fontSelect.value;
        if (sizeInput) textFontSize = parseInt(sizeInput.value, 10) || 24;

        // Pointer events for mouse + touch
        canvas.addEventListener('pointerdown', onPointerDown);
        canvas.addEventListener('pointermove', onPointerMove);
        canvas.addEventListener('pointerup', onPointerUp);
        canvas.addEventListener('pointerleave', onPointerUp);
        canvas.addEventListener('pointercancel', onPointerUp);

        // Right-click → text mode
        canvas.addEventListener('contextmenu', onContextMenu);

        // Keyboard input for text mode
        window.addEventListener('keydown', onKeyDown);

        // Wheel zoom
        canvas.addEventListener('wheel', onWheel, { passive: false });

        // Space key for pan mode
        window.addEventListener('keydown', (e) => {
            if (e.code === 'Space' && !e.target.matches('input,textarea') && !textMode) {
                e.preventDefault();
                spaceDown = true;
                canvas.style.cursor = 'grab';
            }
        });
        window.addEventListener('keyup', (e) => {
            if (e.code === 'Space') {
                spaceDown = false;
                if (!isPanning && !textMode) canvas.style.cursor = 'crosshair';
            }
        });

        window.addEventListener('resize', resize);
    }

    // ── Resize ────────────────────────────────
    function resize() {
        const container = document.getElementById('canvas-container');
        const dpr = window.devicePixelRatio || 1;
        const w = container.clientWidth;
        const h = container.clientHeight;

        canvas.width = w * dpr;
        canvas.height = h * dpr;
        canvas.style.width = w + 'px';
        canvas.style.height = h + 'px';

        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        redraw();
    }

    // ── Coordinate transforms ───────────────
    // Screen coords → world (drawing) coords
    function screenToWorld(sx, sy) {
        return {
            x: (sx - offsetX) / scale,
            y: (sy - offsetY) / scale
        };
    }

    // ── Pointer handlers ──────────────────────
    function onPointerDown(e) {
        // Close edit popup if open and clicking elsewhere
        if (isEditPopupOpen()) {
            hideEditPopup();
        }

        // Left-click while in text mode (without Ctrl) → commit text and exit
        if (textMode && e.button === 0 && !e.ctrlKey && !e.metaKey) {
            commitTextBuffer();
            exitTextMode();
        }

        const rect = canvas.getBoundingClientRect();
        const sx = e.clientX - rect.left;
        const sy = e.clientY - rect.top;

        // Middle-click, space+click, or Ctrl+click → start panning
        if (e.button === 1 || (e.button === 0 && spaceDown) || (e.button === 0 && (e.ctrlKey || e.metaKey))) {
            isPanning = true;
            panStartX = sx - offsetX;
            panStartY = sy - offsetY;
            canvas.setPointerCapture(e.pointerId);
            canvas.style.cursor = 'grabbing';
            e.preventDefault();
            return;
        }

        if (e.button !== 0 && e.pointerType === 'mouse') return;

        // Check if clicking on existing text → open edit popup
        const { x: wx, y: wy } = screenToWorld(sx, sy);
        const hitIndex = hitTestText(wx, wy);
        if (hitIndex >= 0 && !textMode) {
            showEditPopup(hitIndex);
            return;
        }

        canvas.setPointerCapture(e.pointerId);
        isDrawing = true;

        const { x, y } = screenToWorld(sx, sy);
        currentStroke = {
            color: currentColor,
            size: brushSize,
            points: [{ x, y }]
        };

        // Draw a dot for single clicks
        redraw();
        ctx.save();
        applyTransform();
        ctx.fillStyle = currentColor;
        ctx.beginPath();
        ctx.arc(x, y, brushSize / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    function onPointerMove(e) {
        const rect = canvas.getBoundingClientRect();
        const sx = e.clientX - rect.left;
        const sy = e.clientY - rect.top;

        if (isPanning) {
            offsetX = sx - panStartX;
            offsetY = sy - panStartY;
            redraw();
            return;
        }

        if (!isDrawing || !currentStroke) return;
        const { x, y } = screenToWorld(sx, sy);
        currentStroke.points.push({ x, y });
        drawCurrentStroke();
    }

    function onPointerUp(e) {
        if (isPanning) {
            isPanning = false;
            canvas.style.cursor = spaceDown ? 'grab' : 'crosshair';
            return;
        }

        if (!isDrawing) return;
        isDrawing = false;
        if (currentStroke && currentStroke.points.length > 0) {
            strokes.push(currentStroke);
            redoStack = []; // new stroke clears redo
        }
        currentStroke = null;
        redraw();
    }

    // ── Wheel zoom ──────────────────────────
    function onWheel(e) {
        e.preventDefault();
        const rect = canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;

        const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
        zoomAt(mx, my, delta);
    }

    function zoomAt(mx, my, delta) {
        const oldScale = scale;
        scale = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, scale + delta));

        // Zoom towards the mouse/center point
        const ratio = scale / oldScale;
        offsetX = mx - (mx - offsetX) * ratio;
        offsetY = my - (my - offsetY) * ratio;

        redraw();
        updateZoomDisplay();
    }

    // ── Public zoom controls ────────────────
    function zoomIn() {
        const container = document.getElementById('canvas-container');
        const cx = container.clientWidth / 2;
        const cy = container.clientHeight / 2;
        zoomAt(cx, cy, ZOOM_STEP);
    }

    function zoomOut() {
        const container = document.getElementById('canvas-container');
        const cx = container.clientWidth / 2;
        const cy = container.clientHeight / 2;
        zoomAt(cx, cy, -ZOOM_STEP);
    }

    function zoomReset() {
        scale = 1;
        offsetX = 0;
        offsetY = 0;
        redraw();
        updateZoomDisplay();
    }

    // ── Right-click → Text Mode ─────────────
    function onContextMenu(e) {
        e.preventDefault();
        const rect = canvas.getBoundingClientRect();
        const sx = e.clientX - rect.left;
        const sy = e.clientY - rect.top;
        const { x, y } = screenToWorld(sx, sy);

        // If already in text mode, commit current buffer first
        if (textMode) {
            commitTextBuffer();
        }

        enterTextMode(x, y);
    }

    function enterTextMode(x, y) {
        textMode = true;
        textCursorX = x;
        textCursorY = y;
        textBuffer = '';
        canvas.style.cursor = 'text';

        redraw();
        drawTextCursor();
    }

    function exitTextMode() {
        textMode = false;
        textBuffer = '';
        canvas.style.cursor = 'crosshair';
        redraw();
    }

    // ── Click-to-edit text strokes ───────────
    let editingStrokeIndex = -1;

    function hitTestText(wx, wy) {
        // Walk backwards so top-most text wins
        for (let i = strokes.length - 1; i >= 0; i--) {
            const s = strokes[i];
            if (s.type !== 'text') continue;

            const family = s.fontFamily || 'Inter';
            ctx.save();
            ctx.font = `${s.fontSize}px '${family}', sans-serif`;
            const w = ctx.measureText(s.text).width;
            ctx.restore();

            const left = s.x;
            const right = s.x + w;
            const top = s.y - s.fontSize * 0.8;
            const bottom = s.y + s.fontSize * 0.25;

            if (wx >= left && wx <= right && wy >= top && wy <= bottom) {
                return i;
            }
        }
        return -1;
    }

    function showEditPopup(strokeIndex) {
        editingStrokeIndex = strokeIndex;
        const s = strokes[strokeIndex];
        const popup = document.getElementById('text-edit-popup');
        if (!popup) return;

        // Fill controls with stroke values
        document.getElementById('text-edit-value').value = s.text;
        document.getElementById('text-edit-font').value = s.fontFamily || 'Inter';
        document.getElementById('text-edit-size').value = s.fontSize;
        document.getElementById('text-edit-color').value = s.color;

        // Position popup near the text (screen coords)
        const rect = canvas.getBoundingClientRect();
        const sx = s.x * scale + offsetX + rect.left;
        const sy = s.y * scale + offsetY + rect.top;

        popup.style.left = Math.max(8, Math.min(sx, window.innerWidth - 300)) + 'px';
        popup.style.top = Math.max(8, sy - 140) + 'px';
        popup.classList.remove('text-edit-popup-hidden');

        // Highlight the selected stroke
        redraw();
        highlightStroke(strokeIndex);

        setTimeout(() => document.getElementById('text-edit-value').focus(), 50);
    }

    function hideEditPopup() {
        editingStrokeIndex = -1;
        const popup = document.getElementById('text-edit-popup');
        if (popup) popup.classList.add('text-edit-popup-hidden');
        redraw();
    }

    function applyEdit() {
        if (editingStrokeIndex < 0 || editingStrokeIndex >= strokes.length) return;
        const s = strokes[editingStrokeIndex];
        s.text = document.getElementById('text-edit-value').value || s.text;
        s.fontFamily = document.getElementById('text-edit-font').value;
        s.fontSize = parseInt(document.getElementById('text-edit-size').value, 10) || s.fontSize;
        s.color = document.getElementById('text-edit-color').value;
        hideEditPopup();
    }

    function deleteEditStroke() {
        if (editingStrokeIndex < 0 || editingStrokeIndex >= strokes.length) return;
        strokes.splice(editingStrokeIndex, 1);
        hideEditPopup();
    }

    function highlightStroke(index) {
        const s = strokes[index];
        if (!s || s.type !== 'text') return;

        const family = s.fontFamily || 'Inter';
        ctx.save();
        applyTransform();
        ctx.font = `${s.fontSize}px '${family}', sans-serif`;
        const w = ctx.measureText(s.text).width;
        const pad = 4;

        ctx.strokeStyle = 'var(--accent, #6366f1)';
        ctx.strokeStyle = '#6366f1';
        ctx.lineWidth = 1.5 / scale;
        ctx.setLineDash([4 / scale, 3 / scale]);
        ctx.strokeRect(
            s.x - pad, s.y - s.fontSize * 0.8 - pad,
            w + pad * 2, s.fontSize * 1.05 + pad * 2
        );
        ctx.restore();
    }

    function isEditPopupOpen() {
        return editingStrokeIndex >= 0;
    }

    function commitTextBuffer() {
        if (textBuffer.length === 0) return;

        // Store as a text-type stroke
        strokes.push({
            type: 'text',
            text: textBuffer,
            x: textCursorX,
            y: textCursorY,
            color: currentColor,
            size: brushSize,
            fontSize: textFontSize,
            fontFamily: textFontFamily
        });
        redoStack = [];

        // Advance cursor X past the committed text
        ctx.save();
        ctx.font = `${textFontSize}px '${textFontFamily}', sans-serif`;
        textCursorX += ctx.measureText(textBuffer).width / scale;
        ctx.restore();

        textBuffer = '';
    }

    function onKeyDown(e) {
        if (!textMode) return;
        // Don't intercept if in an input/modal
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
        // Don't intercept Ctrl/Cmd shortcuts
        if (e.ctrlKey || e.metaKey) return;

        if (e.key === 'Escape') {
            commitTextBuffer();
            exitTextMode();
            e.preventDefault();
            e.stopPropagation();
            return;
        }

        if (e.key === 'Enter') {
            // Commit current line and move cursor down
            commitTextBuffer();
            textCursorY += textFontSize * 1.3;
            redraw();
            drawTextCursor();
            e.preventDefault();
            return;
        }

        if (e.key === 'Backspace') {
            if (textBuffer.length > 0) {
                textBuffer = textBuffer.slice(0, -1);
                redraw();
                drawTextPreview();
                drawTextCursor();
            }
            e.preventDefault();
            return;
        }

        // Only accept printable characters
        if (e.key.length === 1) {
            textBuffer += e.key;
            redraw();
            drawTextPreview();
            drawTextCursor();
            e.preventDefault();
        }
    }

    function drawTextPreview() {
        if (textBuffer.length === 0) return;

        ctx.save();
        applyTransform();
        ctx.font = `${textFontSize}px '${textFontFamily}', sans-serif`;
        ctx.fillStyle = currentColor;
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(textBuffer, textCursorX, textCursorY);
        ctx.restore();
    }

    function drawTextCursor() {
        if (!textMode) return;

        let cursorX = textCursorX;

        // Offset cursor past the preview text
        if (textBuffer.length > 0) {
            ctx.save();
            ctx.font = `${textFontSize}px '${textFontFamily}', sans-serif`;
            cursorX += ctx.measureText(textBuffer).width / scale;
            ctx.restore();
        }

        ctx.save();
        applyTransform();
        ctx.strokeStyle = currentColor;
        ctx.lineWidth = 1.5 / scale;
        ctx.globalAlpha = 0.6;
        ctx.beginPath();
        ctx.moveTo(cursorX, textCursorY - textFontSize * 0.8);
        ctx.lineTo(cursorX, textCursorY + textFontSize * 0.2);
        ctx.stroke();
        ctx.restore();
    }

    function updateZoomDisplay() {
        const el = document.getElementById('zoom-level');
        if (el) el.textContent = Math.round(scale * 100) + '%';
    }

    // ── Drawing ───────────────────────────────
    function applyTransform() {
        ctx.translate(offsetX, offsetY);
        ctx.scale(scale, scale);
    }

    function clearCanvas() {
        const container = document.getElementById('canvas-container');
        ctx.save();
        ctx.setTransform(window.devicePixelRatio || 1, 0, 0, window.devicePixelRatio || 1, 0, 0);
        ctx.clearRect(0, 0, container.clientWidth, container.clientHeight);
        ctx.restore();
    }

    function redraw() {
        clearCanvas();
        ctx.save();
        applyTransform();
        for (const stroke of strokes) {
            if (stroke.type === 'text') {
                drawTextStroke(stroke);
            } else {
                drawStroke(stroke);
            }
        }
        ctx.restore();
    }

    function drawCurrentStroke() {
        // Redraw everything + current stroke for smoothing
        clearCanvas();
        ctx.save();
        applyTransform();
        for (const stroke of strokes) {
            if (stroke.type === 'text') {
                drawTextStroke(stroke);
            } else {
                drawStroke(stroke);
            }
        }
        if (currentStroke) drawStroke(currentStroke);
        ctx.restore();
    }

    function drawTextStroke(stroke, targetCtx = ctx) {
        targetCtx.save();
        const family = stroke.fontFamily || 'Inter';
        targetCtx.font = `${stroke.fontSize}px '${family}', sans-serif`;
        targetCtx.fillStyle = stroke.color;
        targetCtx.textBaseline = 'alphabetic';
        targetCtx.fillText(stroke.text, stroke.x, stroke.y);
        targetCtx.restore();
    }

    function drawStroke(stroke, targetCtx = ctx) {
        const pts = stroke.points;
        if (pts.length === 0) return;

        targetCtx.strokeStyle = stroke.color;
        targetCtx.lineWidth = stroke.size;
        targetCtx.lineCap = 'round';
        targetCtx.lineJoin = 'round';

        if (pts.length === 1) {
            targetCtx.fillStyle = stroke.color;
            targetCtx.beginPath();
            targetCtx.arc(pts[0].x, pts[0].y, stroke.size / 2, 0, Math.PI * 2);
            targetCtx.fill();
            return;
        }

        targetCtx.beginPath();
        targetCtx.moveTo(pts[0].x, pts[0].y);

        if (pts.length === 2) {
            targetCtx.lineTo(pts[1].x, pts[1].y);
        } else {
            // Quadratic curve smoothing
            for (let i = 1; i < pts.length - 1; i++) {
                const midX = (pts[i].x + pts[i + 1].x) / 2;
                const midY = (pts[i].y + pts[i + 1].y) / 2;
                targetCtx.quadraticCurveTo(pts[i].x, pts[i].y, midX, midY);
            }
            // Last point
            const last = pts[pts.length - 1];
            targetCtx.lineTo(last.x, last.y);
        }

        targetCtx.stroke();
    }

    /**
     * Renders a list of strokes to a specific context at 1:1 scale (no zoom/pan applied).
     */
    function renderStrokesToContext(strokeList, targetCtx) {
        for (const stroke of strokeList) {
            if (stroke.type === 'text') {
                drawTextStroke(stroke, targetCtx);
            } else {
                drawStroke(stroke, targetCtx);
            }
        }
    }

    // ── Public API ────────────────────────────
    function undo() {
        if (strokes.length === 0) return;
        redoStack.push(strokes.pop());
        redraw();
    }

    function redo() {
        if (redoStack.length === 0) return;
        strokes.push(redoStack.pop());
        redraw();
    }

    function clear() {
        strokes = [];
        redoStack = [];
        redraw();
    }

    function getStrokes() {
        return JSON.parse(JSON.stringify(strokes));
    }

    function setStrokes(newStrokes) {
        strokes = JSON.parse(JSON.stringify(newStrokes));
        redoStack = [];
        redraw();
    }

    function toDataURL(options = {}) {
        const {
            quality = 1,
            pixelRatio = window.devicePixelRatio || 1,
            strokeList = strokes
        } = options;

        const container = document.getElementById('canvas-container');
        const w = container.clientWidth;
        const h = container.clientHeight;

        // Temp canvas for export
        const tmp = document.createElement('canvas');
        tmp.width = w * pixelRatio;
        tmp.height = h * pixelRatio;
        const tctx = tmp.getContext('2d');
        tctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

        renderStrokesToContext(strokeList, tctx);

        return tmp.toDataURL('image/png', quality);
    }

    function setColor(color) {
        currentColor = color;
        if (textMode) redraw(); // Update typing preview
    }

    function setBrushSize(size) {
        brushSize = size;
    }

    function getColor() { return currentColor; }
    function getBrushSize() { return brushSize; }
    function hasStrokes() { return strokes.length > 0; }

    // ── Text toolbar API ─────────────────────
    function setTextFont(font) {
        textFontFamily = font;
        if (textMode) redraw(); // Update typing preview
    }
    function setTextSize(size) {
        textFontSize = Math.max(8, Math.min(200, size));
        if (textMode) redraw(); // Update typing preview
    }
    function getTextFont() { return textFontFamily; }
    function getTextSize() { return textFontSize; }
    function getFontOptions() { return FONT_OPTIONS; }
    function isTextMode() { return textMode; }

    return {
        init, undo, redo, clear,
        getStrokes, setStrokes,
        toDataURL,
        renderStrokesToContext,
        setColor, setBrushSize,
        getColor, getBrushSize,
        hasStrokes,
        zoomIn, zoomOut, zoomReset,
        setTextFont, setTextSize,
        getTextFont, getTextSize,
        getFontOptions, isTextMode,
        showEditPopup, hideEditPopup,
        applyEdit, deleteEditStroke,
        isEditPopupOpen
    };
})();
