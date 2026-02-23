/* ══════════════════════════════════════════════
   HISTORY — Save / Load / Rename / Delete
   ══════════════════════════════════════════════ */

const History = (() => {
    const STORAGE_KEY = 'sketchboard_drawings';
    let panelOpen = false;

    function init() {
        document.getElementById('btn-close-history').addEventListener('click', closePanel);

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

    // ── Render list ───────────────────────────
    function renderList() {
        const container = document.getElementById('history-list');
        const drawings = getDrawings();

        if (drawings.length === 0) {
            container.innerHTML = '<p class="empty-state">Aucun dessin sauvegardé</p>';
            return;
        }

        container.innerHTML = drawings.map(d => {
            const date = new Date(d.createdAt);
            const dateStr = date.toLocaleDateString('fr-FR', {
                day: '2-digit', month: 'short', year: 'numeric',
                hour: '2-digit', minute: '2-digit'
            });

            return `
        <div class="history-card" data-id="${d.id}">
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
              <button class="card-btn card-btn--delete" data-action="delete" data-id="${d.id}">Suppr.</button>
            </div>
          </div>
        </div>
      `;
        }).join('');

        // Event delegation
        container.querySelectorAll('[data-action]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const action = e.target.dataset.action;
                const id = e.target.dataset.id;
                if (action === 'load') loadDrawing(id);
                if (action === 'rename') renameDrawing(id);
                if (action === 'delete') deleteDrawing(id);
            });
        });
    }

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    return { init, togglePanel, saveDrawing, closePanel };
})();
