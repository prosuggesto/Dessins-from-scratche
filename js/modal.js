/* ══════════════════════════════════════════════
   MODAL — Save, Confirm, Rename dialogs
   ══════════════════════════════════════════════ */

const Modal = (() => {
    let confirmCallback = null;
    let renameCallback = null;

    function init() {
        // Save modal
        document.getElementById('modal-cancel').addEventListener('click', closeSave);
        document.getElementById('modal-confirm').addEventListener('click', handleSave);
        document.getElementById('save-modal').addEventListener('click', (e) => {
            if (e.target.id === 'save-modal') closeSave();
        });
        document.getElementById('save-name-input').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') handleSave();
        });

        // Confirm modal
        document.getElementById('confirm-cancel').addEventListener('click', closeConfirm);
        document.getElementById('confirm-ok').addEventListener('click', () => {
            if (confirmCallback) confirmCallback();
            closeConfirm();
        });
        document.getElementById('confirm-modal').addEventListener('click', (e) => {
            if (e.target.id === 'confirm-modal') closeConfirm();
        });

        // Rename modal
        document.getElementById('rename-cancel').addEventListener('click', closeRename);
        document.getElementById('rename-confirm').addEventListener('click', handleRename);
        document.getElementById('rename-modal').addEventListener('click', (e) => {
            if (e.target.id === 'rename-modal') closeRename();
        });
        document.getElementById('rename-input').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') handleRename();
        });
    }

    // ── Save ──────────────────────────────────
    function openSave() {
        const input = document.getElementById('save-name-input');
        input.value = '';
        document.getElementById('save-modal').classList.remove('modal-hidden');
        setTimeout(() => input.focus(), 100);
    }

    function closeSave() {
        document.getElementById('save-modal').classList.add('modal-hidden');
    }

    function handleSave() {
        const input = document.getElementById('save-name-input');
        const name = input.value.trim();
        if (!name) {
            input.style.borderColor = 'var(--danger)';
            input.focus();
            setTimeout(() => input.style.borderColor = '', 1500);
            return;
        }
        History.saveDrawing(name);
        closeSave();
    }

    // ── Confirm ───────────────────────────────
    function confirm(title, message, callback) {
        document.getElementById('confirm-title').textContent = title;
        document.getElementById('confirm-message').textContent = message;
        confirmCallback = callback;
        document.getElementById('confirm-modal').classList.remove('modal-hidden');
    }

    function closeConfirm() {
        document.getElementById('confirm-modal').classList.add('modal-hidden');
        confirmCallback = null;
    }

    // ── Rename ────────────────────────────────
    function openRename(currentName, callback) {
        const input = document.getElementById('rename-input');
        input.value = currentName;
        renameCallback = callback;
        document.getElementById('rename-modal').classList.remove('modal-hidden');
        setTimeout(() => { input.focus(); input.select(); }, 100);
    }

    function closeRename() {
        document.getElementById('rename-modal').classList.add('modal-hidden');
        renameCallback = null;
    }

    function handleRename() {
        const input = document.getElementById('rename-input');
        const name = input.value.trim();
        if (!name) {
            input.style.borderColor = 'var(--danger)';
            input.focus();
            setTimeout(() => input.style.borderColor = '', 1500);
            return;
        }
        if (renameCallback) renameCallback(name);
        closeRename();
    }

    // ── Close any open modal ──────────────────
    function closeAll() {
        closeSave();
        closeConfirm();
        closeRename();
    }

    function isAnyOpen() {
        return !document.getElementById('save-modal').classList.contains('modal-hidden') ||
            !document.getElementById('confirm-modal').classList.contains('modal-hidden') ||
            !document.getElementById('rename-modal').classList.contains('modal-hidden');
    }

    return { init, openSave, closeSave, confirm, openRename, closeAll, isAnyOpen };
})();
