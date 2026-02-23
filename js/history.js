/* ══════════════════════════════════════════════
   HISTORY — Save / Load / Rename / Delete
   ══════════════════════════════════════════════ */

const History = (() => {
    const STORAGE_KEY = 'sketchboard_drawings';
    let panelOpen = false;
    let selectedIds = new Set();
    let isExportMode = false;

    function init() {
        document.getElementById('btn-close-history').addEventListener('click', closePanel);
        document.getElementById('btn-bulk-export').addEventListener('click', handleBulkExport);
        document.getElementById('btn-export-mode').addEventListener('click', toggleExportMode);

        // Create backdrop element
        const backdrop = document.createElement('div');
        backdrop.id = 'history-backdrop';
        backdrop.className = 'backdrop-hidden';
        backdrop.addEventListener('click', closePanel);
        document.body.appendChild(backdrop);

        renderList();
    }

    // ── Panel toggle ──────────────────────────
    function togglePanel() {
        panelOpen ? closePanel() : openPanel();
    }

    function openPanel() {
        panelOpen = true;
        document.getElementById('history-panel').classList.remove('panel-hidden');
        document.getElementById('history-backdrop').classList.remove('backdrop-hidden');
        renderList();
    }

    function closePanel() {
        panelOpen = false;
        document.getElementById('history-panel').classList.add('panel-hidden');
        document.getElementById('history-backdrop').classList.add('backdrop-hidden');
        isExportMode = false;
        selectedIds.clear();
    }

    function toggleExportMode() {
        isExportMode = !isExportMode;
        const btn = document.getElementById('btn-export-mode');
        btn.classList.toggle('tool-btn--accent', isExportMode);

        if (!isExportMode) {
            selectedIds.clear();
            updateBulkExportVisibility();
        }
        renderList();
    }

    // ── Storage ───────────────────────────────
    function getDrawings() {
        try {
            return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
        } catch { return []; }
    }

    function setDrawings(drawings) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(drawings));
    }

    // ── Save ──────────────────────────────────
    function saveDrawing(name) {
        const drawings = getDrawings();
        const drawing = {
            id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
            name: name,
            createdAt: new Date().toISOString(),
            strokes: CanvasBoard.getStrokes(),
            previewDataUrl: CanvasBoard.toDataURL()
        };
        drawings.unshift(drawing);
        setDrawings(drawings);
        renderList();
    }

    // ── Load ──────────────────────────────────
    function loadDrawing(id) {
        const drawings = getDrawings();
        const drawing = drawings.find(d => d.id === id);
        if (!drawing) return;
        CanvasBoard.setStrokes(drawing.strokes);
        closePanel();
    }

    // ── Rename ────────────────────────────────
    function renameDrawing(id) {
        const drawings = getDrawings();
        const drawing = drawings.find(d => d.id === id);
        if (!drawing) return;

        Modal.openRename(drawing.name, (newName) => {
            drawing.name = newName;
            setDrawings(drawings);
            renderList();
        });
    }

    // ── Delete ────────────────────────────────
    function deleteDrawing(id) {
        Modal.confirm('Supprimer ?', 'Ce dessin sera supprimé définitivement.', () => {
            let drawings = getDrawings();
            drawings = drawings.filter(d => d.id !== id);
            setDrawings(drawings);
            renderList();
        });
    }

    function handleBulkExport() {
        const drawings = getDrawings();
        const selected = drawings.filter(d => selectedIds.has(d.id));
        if (selected.length === 0) return;

        ExportEngine.exportVertical(selected).then(() => {
            selectedIds.clear();
            isExportMode = false;
            document.getElementById('btn-export-mode').classList.remove('tool-btn--accent');
            updateBulkExportVisibility();
            renderList();
        });
    }

    function toggleSelection(id) {
        if (selectedIds.has(id)) {
            selectedIds.delete(id);
        } else {
            selectedIds.add(id);
            if (!isExportMode) toggleExportMode();
        }
        updateBulkExportVisibility();
        renderList(false);
    }

    function updateBulkExportVisibility() {
        const btn = document.getElementById('btn-bulk-export');
        if (selectedIds.size > 0) {
            btn.classList.remove('btn-hidden');
        } else {
            btn.classList.add('btn-hidden');
        }
    }

    // ── Render list ───────────────────────────
    function renderList(full = true) {
        const container = document.getElementById('history-list');
        const drawings = getDrawings();

        if (drawings.length === 0) {
            container.innerHTML = '<p class="empty-state">Aucun dessin sauvegardé</p>';
            return;
        }

        if (full) {
            container.innerHTML = drawings.map(d => {
                const date = new Date(d.createdAt);
                const dateStr = date.toLocaleDateString('fr-FR', {
                    day: '2-digit', month: 'short', year: 'numeric',
                    hour: '2-digit', minute: '2-digit'
                });

                const isSelected = selectedIds.has(d.id);

                return `
        <div class="history-card ${isSelected ? 'selected' : ''}" data-id="${d.id}">
          <div class="history-card-selection ${isExportMode || isSelected ? '' : 'btn-hidden'}">
            <input type="checkbox" class="history-card-checkbox" ${isSelected ? 'checked' : ''} data-select-id="${d.id}">
          </div>
          <img class="history-card-thumb"
               src="${d.previewDataUrl}"
               alt="${d.name}"
               loading="lazy">
          <div class="history-card-info">
            <div class="history-card-name">${escapeHtml(d.name)}</div>
            <div class="history-card-date">${dateStr}</div>
            <div class="history-card-actions">
              <button class="card-btn card-btn--load" data-action="load" data-id="${d.id}">Charger</button>
              <button class="card-btn" data-action="rename" data-id="${d.id}">Renommer</button>
              <button class="card-btn card-btn--export" data-action="export-single" data-id="${d.id}" title="Exporter PNG">PNG</button>
              <button class="card-btn card-btn--delete" data-action="delete" data-id="${d.id}">Suppr.</button>
            </div>
          </div>
        </div>
      `;
            }).join('');
        } else {
            container.querySelectorAll('.history-card').forEach(card => {
                const id = card.dataset.id;
                const isSelected = selectedIds.has(id);
                card.classList.toggle('selected', isSelected);
                const cb = card.querySelector('.history-card-checkbox');
                if (cb) cb.checked = isSelected;

                const selectionArea = card.querySelector('.history-card-selection');
                if (selectionArea) {
                    if (isExportMode || isSelected) selectionArea.classList.remove('btn-hidden');
                    else selectionArea.classList.add('btn-hidden');
                }
            });
        }

        // Re-bind listeners
        container.querySelectorAll('[data-action]').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                const action = btn.dataset.action;
                const id = btn.dataset.id;
                if (action === 'load') loadDrawing(id);
                if (action === 'rename') renameDrawing(id);
                if (action === 'delete') deleteDrawing(id);
                if (action === 'export-single') {
                    const d = getDrawings().find(draw => draw.id === id);
                    if (d) ExportEngine.exportSingle(d);
                }
            };
        });

        container.querySelectorAll('.history-card').forEach(card => {
            card.onclick = (e) => {
                if (e.target.closest('button') || e.target.closest('input')) return;
                toggleSelection(card.dataset.id);
            };
        });

        container.querySelectorAll('.history-card-checkbox').forEach(cb => {
            cb.onchange = (e) => {
                toggleSelection(cb.dataset.selectId);
            };
        });
    }

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    return { init, togglePanel, saveDrawing, closePanel };
})();
