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
    let cursorBlinkOn = true;
    let cursorBlinkInterval = null;
    const TEXT_FONT_SIZE_FACTOR = 6; // brushSize * factor = font size

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

        // Start blinking cursor
        cursorBlinkOn = true;
        clearInterval(cursorBlinkInterval);
        cursorBlinkInterval = setInterval(() => {
            cursorBlinkOn = !cursorBlinkOn;
            redraw();
            drawTextCursor();
        }, 530);

        redraw();
        drawTextCursor();
    }

    function exitTextMode() {
        textMode = false;
        textBuffer = '';
        clearInterval(cursorBlinkInterval);
        cursorBlinkInterval = null;
        canvas.style.cursor = 'crosshair';
        redraw();
    }

    function commitTextBuffer() {
        if (textBuffer.length === 0) return;

        // Store as a text-type stroke
        const fontSize = brushSize * TEXT_FONT_SIZE_FACTOR;
        strokes.push({
            type: 'text',
            text: textBuffer,
            x: textCursorX,
            y: textCursorY,
            color: currentColor,
            size: brushSize,
            fontSize: fontSize
        });
        redoStack = [];

        // Advance cursor X past the committed text
        ctx.save();
        ctx.font = `${fontSize}px 'Inter', sans-serif`;
        textCursorX += ctx.measureText(textBuffer).width / scale;
        ctx.restore();

        textBuffer = '';
    }

    function onKeyDown(e) {
        if (!textMode) return;
        // Don't intercept if in an input/modal
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
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
            const fontSize = brushSize * TEXT_FONT_SIZE_FACTOR;
            textCursorY += fontSize * 1.3;
            // Reset X to original column? We'll use current X for newline
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
        const fontSize = brushSize * TEXT_FONT_SIZE_FACTOR;

        ctx.save();
        applyTransform();
        ctx.font = `${fontSize}px 'Inter', sans-serif`;
        ctx.fillStyle = currentColor;
        ctx.globalAlpha = 0.7; // Preview is slightly transparent
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(textBuffer, textCursorX, textCursorY);
        ctx.restore();
    }

    function drawTextCursor() {
        if (!textMode || !cursorBlinkOn) return;

        const fontSize = brushSize * TEXT_FONT_SIZE_FACTOR;
        let cursorX = textCursorX;

        // Offset cursor past the preview text
        if (textBuffer.length > 0) {
            ctx.save();
            ctx.font = `${fontSize}px 'Inter', sans-serif`;
            cursorX += ctx.measureText(textBuffer).width / scale;
            ctx.restore();
        }

        ctx.save();
        applyTransform();
        ctx.strokeStyle = currentColor;
        ctx.lineWidth = 2 / scale;
        ctx.globalAlpha = 0.9;
        ctx.beginPath();
        ctx.moveTo(cursorX, textCursorY - fontSize * 0.8);
        ctx.lineTo(cursorX, textCursorY + fontSize * 0.2);
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

    function drawTextStroke(stroke) {
        ctx.save();
        ctx.font = `${stroke.fontSize}px 'Inter', sans-serif`;
        ctx.fillStyle = stroke.color;
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(stroke.text, stroke.x, stroke.y);
        ctx.restore();
    }

    function drawStroke(stroke) {
        const pts = stroke.points;
        if (pts.length === 0) return;

        ctx.strokeStyle = stroke.color;
        ctx.lineWidth = stroke.size;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        if (pts.length === 1) {
            ctx.fillStyle = stroke.color;
            ctx.beginPath();
            ctx.arc(pts[0].x, pts[0].y, stroke.size / 2, 0, Math.PI * 2);
            ctx.fill();
            return;
        }

        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);

        if (pts.length === 2) {
            ctx.lineTo(pts[1].x, pts[1].y);
        } else {
            // Quadratic curve smoothing
            for (let i = 1; i < pts.length - 1; i++) {
                const midX = (pts[i].x + pts[i + 1].x) / 2;
                const midY = (pts[i].y + pts[i + 1].y) / 2;
                ctx.quadraticCurveTo(pts[i].x, pts[i].y, midX, midY);
            }
            // Last point
            const last = pts[pts.length - 1];
            ctx.lineTo(last.x, last.y);
        }

        ctx.stroke();
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

    function toDataURL() {
        // Export at 1:1 scale (no zoom/pan) for clean preview
        const container = document.getElementById('canvas-container');
        const dpr = window.devicePixelRatio || 1;
        const w = container.clientWidth;
        const h = container.clientHeight;

        // Temp canvas for export
        const tmp = document.createElement('canvas');
        tmp.width = w * dpr;
        tmp.height = h * dpr;
        const tctx = tmp.getContext('2d');
        tctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        for (const stroke of strokes) {
            if (stroke.type === 'text') {
                tctx.save();
                tctx.font = `${stroke.fontSize}px 'Inter', sans-serif`;
                tctx.fillStyle = stroke.color;
                tctx.textBaseline = 'alphabetic';
                tctx.fillText(stroke.text, stroke.x, stroke.y);
                tctx.restore();
                continue;
            }

            const pts = stroke.points;
            if (pts.length === 0) continue;

            tctx.strokeStyle = stroke.color;
            tctx.lineWidth = stroke.size;
            tctx.lineCap = 'round';
            tctx.lineJoin = 'round';

            if (pts.length === 1) {
                tctx.fillStyle = stroke.color;
                tctx.beginPath();
                tctx.arc(pts[0].x, pts[0].y, stroke.size / 2, 0, Math.PI * 2);
                tctx.fill();
                continue;
            }

            tctx.beginPath();
            tctx.moveTo(pts[0].x, pts[0].y);
            if (pts.length === 2) {
                tctx.lineTo(pts[1].x, pts[1].y);
            } else {
                for (let i = 1; i < pts.length - 1; i++) {
                    const midX = (pts[i].x + pts[i + 1].x) / 2;
                    const midY = (pts[i].y + pts[i + 1].y) / 2;
                    tctx.quadraticCurveTo(pts[i].x, pts[i].y, midX, midY);
                }
                tctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
            }
            tctx.stroke();
        }

        return tmp.toDataURL('image/png');
    }

    function setColor(color) {
        currentColor = color;
    }

    function setBrushSize(size) {
        brushSize = size;
    }

    function getColor() { return currentColor; }
    function getBrushSize() { return brushSize; }
    function hasStrokes() { return strokes.length > 0; }

    return {
        init, undo, redo, clear,
        getStrokes, setStrokes,
        toDataURL,
        setColor, setBrushSize,
        getColor, getBrushSize,
        hasStrokes,
        zoomIn, zoomOut, zoomReset
    };
})();
