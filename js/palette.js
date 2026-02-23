/* ══════════════════════════════════════════════
   PALETTE — Color picker strip
   ══════════════════════════════════════════════ */

const Palette = (() => {
    const COLORS = [
        { name: 'Blanc', hex: '#ffffff' },
        { name: 'Gris clair', hex: '#a1a1aa' },
        { name: 'Bleu', hex: '#3b82f6' },
        { name: 'Vert néon', hex: '#22d3ee' },
        { name: 'Rouge', hex: '#ef4444' },
        { name: 'Jaune', hex: '#facc15' },
        { name: 'Violet', hex: '#a855f7' },
        { name: 'Orange', hex: '#f97316' },
        { name: 'Cyan', hex: '#06b6d4' },
    ];

    let activeIndex = 0;

    function init() {
        const container = document.getElementById('palette-colors');
        container.innerHTML = '';

        COLORS.forEach((c, i) => {
            const swatch = document.createElement('button');
            swatch.className = 'color-swatch' + (i === 0 ? ' active' : '');
            swatch.style.background = c.hex;
            swatch.title = c.name;
            swatch.dataset.index = i;
            swatch.addEventListener('click', () => selectColor(i));
            container.appendChild(swatch);
        });

        updateIndicator();
    }

    function selectColor(index) {
        activeIndex = index;
        CanvasBoard.setColor(COLORS[index].hex);

        // Update swatch highlights
        document.querySelectorAll('.color-swatch').forEach((s, i) => {
            s.classList.toggle('active', i === index);
        });

        updateIndicator();
    }

    function updateIndicator() {
        const dot = document.getElementById('active-color-dot');
        if (dot) {
            dot.style.background = COLORS[activeIndex].hex;
            dot.style.boxShadow = `0 0 8px ${COLORS[activeIndex].hex}44`;
        }
    }

    return { init };
})();
