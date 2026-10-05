// ==UserScript==
// @name         Tripo Studio Backup Manager v6.20
// @namespace    https://studio.tripo3d.ai/
// @version      6.20
// @description  Escanea modelos de Tripo Studio y realiza backups.
// @match        https://studio.tripo3d.ai/workspace/generate*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(() => {
    'use strict';

    // ============================================================
    // CONFIGURACIÓN
    // ============================================================

    const UI_ID = 'tripo-backup-manager';

    // NO CAMBIAR: ESCÁNER QUE ESTÁ ENCONTRANDO 801 MODELOS
    const SCAN_CONFIG = {
        scrollWait: 1200,
        maxRounds: 400,
        stableRounds: 8,
        logEvery: 10
    };

    const LOAD_CONFIG = {
        modelLoadTimeout: 60000,
        dialogTimeout: 30000,
        afterModelClickWait: 1200,
        afterFormatChangeWait: 1000
    };

    const GENERATION_WAIT = 65000;
    const NEXT_EXPORT_MARGIN = 15000;

    const FORMAT_TASKS = [
        { format: 'USD', preset: null,      suffix: 'USD',         ext: 'usd' },
        { format: 'FBX', preset: 'blender', suffix: 'FBX_Blender', ext: 'fbx' },
        { format: 'FBX', preset: 'mixamo',  suffix: 'FBX_Mixamo',  ext: 'fbx' },
        { format: 'FBX', preset: '3dsmax',  suffix: 'FBX_3dsmax',  ext: 'fbx' },
        { format: 'OBJ', preset: null,      suffix: 'OBJ',         ext: 'obj' },
        { format: 'STL', preset: null,      suffix: 'STL',         ext: 'stl' },
        { format: 'GLB', preset: null,      suffix: 'GLB',         ext: 'glb' },
        { format: '3MF', preset: null,      suffix: '3MF',         ext: '3mf' }
    ];

    // ============================================================
    // ESTADO
    // ============================================================

    let models = [];
    let backupRunning = false;
    let pauseRequested = false;
    let stopRequested = false;
    let assetsPanel = null;

    // ============================================================
    // UTILIDADES
    // ============================================================

    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    function normalizeText(value) {
        return String(value || '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function visible(el) {
        if (!el) return false;

        const rect = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);

        return (
            rect.width > 0 &&
            rect.height > 0 &&
            style.display !== 'none' &&
            style.visibility !== 'hidden' &&
            style.opacity !== '0'
        );
    }

    function log(message) {
        const textarea =
            document.getElementById(UI_ID + '-log');

        const time =
            new Date().toLocaleTimeString();

        const line =
            `[${time}] ${message}`;

        if (textarea) {
            textarea.value += line + '\n';
            textarea.scrollTop = textarea.scrollHeight;
        }

        console.log(line);
    }

    function setState(text) {
        const el =
            document.getElementById(UI_ID + '-state');

        if (el) {
            el.textContent = text;
        }
    }

    function setModelCount(count) {
        const el =
            document.getElementById(UI_ID + '-models');

        if (el) {
            el.textContent = count;
        }
    }

    async function waitForElement(
        predicate,
        timeout,
        interval = 100
    ) {
        const start = Date.now();

        while (Date.now() - start < timeout) {

            const result = predicate();

            if (result) {
                return result;
            }

            await sleep(interval);
        }

        return null;
    }

    // ============================================================
    // UI
    // ============================================================

    function createUI() {

        if (document.getElementById(UI_ID)) {
            return;
        }

        const panel =
            document.createElement('div');

        panel.id = UI_ID;

        panel.innerHTML = `
            <style>
                #${UI_ID} {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    width: 460px;
                    z-index: 2147483647;
                    background: #171717;
                    color: #fff;
                    border: 1px solid #444;
                    border-radius: 10px;
                    box-shadow: 0 10px 40px rgba(0,0,0,.5);
                    font-family: Arial, sans-serif;
                    font-size: 13px;
                    overflow: hidden;
                }

                #${UI_ID}.minimized {
                    width: 260px;
                }

                #${UI_ID}.minimized .tb-body {
                    display: none;
                }

                #${UI_ID}.hidden {
                    display: none;
                }

                #${UI_ID} .tb-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 10px 12px;
                    background: #222;
                    cursor: move;
                    user-select: none;
                }

                #${UI_ID} .tb-title {
                    font-weight: bold;
                }

                #${UI_ID} .tb-version {
                    opacity: .55;
                    font-size: 11px;
                    margin-left: 5px;
                }

                #${UI_ID} .tb-header-buttons {
                    display: flex;
                    gap: 5px;
                }

                #${UI_ID} button {
                    border: 1px solid #555;
                    background: #2b2b2b;
                    color: white;
                    border-radius: 5px;
                    padding: 6px 9px;
                    cursor: pointer;
                }

                #${UI_ID} button:hover:not(:disabled) {
                    background: #3b3b3b;
                }

                #${UI_ID} button:disabled {
                    opacity: .45;
                    cursor: default;
                }

                #${UI_ID} .tb-body {
                    padding: 10px;
                }

                #${UI_ID} .tb-stats {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 8px;
                    margin-bottom: 10px;
                }

                #${UI_ID} .tb-stat {
                    background: #202020;
                    padding: 8px;
                    border-radius: 6px;
                }

                #${UI_ID} .tb-stat-label {
                    opacity: .6;
                    font-size: 11px;
                }

                #${UI_ID} .tb-stat-value {
                    font-weight: bold;
                    margin-top: 3px;
                }

                #${UI_ID} .tb-buttons {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 6px;
                    margin-bottom: 10px;
                }

                #${UI_ID} textarea {
                    width: 100%;
                    height: 280px;
                    box-sizing: border-box;
                    resize: vertical;
                    background: #0f0f0f;
                    color: #ddd;
                    border: 1px solid #444;
                    border-radius: 6px;
                    padding: 8px;
                    font-family: monospace;
                    font-size: 11px;
                }

                #${UI_ID}-restore {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    z-index: 2147483647;
                    display: none;
                }
            </style>

            <div class="tb-header" id="${UI_ID}-drag">

                <div>
                    <span class="tb-title">
                        Tripo Backup
                    </span>

                    <span class="tb-version">
                        v6.20
                    </span>
                </div>

                <div class="tb-header-buttons">

                    <button
                        id="${UI_ID}-min"
                        title="Minimizar"
                    >−</button>

                    <button
                        id="${UI_ID}-hide"
                        title="Ocultar panel"
                    >×</button>

                </div>
            </div>

            <div class="tb-body">

                <div class="tb-stats">

                    <div class="tb-stat">
                        <div class="tb-stat-label">
                            Modelos
                        </div>

                        <div
                            class="tb-stat-value"
                            id="${UI_ID}-models"
                        >
                            0
                        </div>
                    </div>

                    <div class="tb-stat">
                        <div class="tb-stat-label">
                            Estado
                        </div>

                        <div
                            class="tb-stat-value"
                            id="${UI_ID}-state"
                        >
                            Preparado
                        </div>
                    </div>

                </div>

                <div class="tb-buttons">

                    <button id="${UI_ID}-scan">
                        Escanear modelos
                    </button>

                    <button id="${UI_ID}-start">
                        Iniciar backup
                    </button>

                    <button
                        id="${UI_ID}-pause"
                        disabled
                    >
                        Pausar
                    </button>

                    <button
                        id="${UI_ID}-stop"
                        disabled
                    >
                        Detener
                    </button>

                    <button id="${UI_ID}-copy">
                        Copiar log
                    </button>

                    <button id="${UI_ID}-clear">
                        Limpiar log
                    </button>

                    <button id="${UI_ID}-reset">
                        Reset
                    </button>

                </div>

                <textarea
                    id="${UI_ID}-log"
                    readonly
                ></textarea>

            </div>
        `;

        const restore =
            document.createElement('button');

        restore.id =
            UI_ID + '-restore';

        restore.textContent =
            'Mostrar Tripo Backup';

        document.body.appendChild(panel);
        document.body.appendChild(restore);

        document
            .getElementById(UI_ID + '-min')
            .addEventListener('click', () => {
                panel.classList.toggle('minimized');
            });

        document
            .getElementById(UI_ID + '-hide')
            .addEventListener('click', () => {
                panel.classList.add('hidden');
                restore.style.display = 'block';
            });

        restore.addEventListener('click', () => {
            panel.classList.remove('hidden');
            restore.style.display = 'none';
        });

        document
            .getElementById(UI_ID + '-scan')
            .addEventListener('click', scanModels);

        document
            .getElementById(UI_ID + '-start')
            .addEventListener('click', startBackup);

        document
            .getElementById(UI_ID + '-pause')
            .addEventListener('click', () => {

                pauseRequested = !pauseRequested;

                const btn =
                    document.getElementById(
                        UI_ID + '-pause'
                    );

                if (pauseRequested) {

                    btn.textContent = 'Reanudar';
                    setState('Pausado');

                    log(
                        '⏸ Backup pausado.'
                    );

                } else {

                    btn.textContent = 'Pausar';
                    setState('Ejecutando');

                    log(
                        '▶ Backup reanudado.'
                    );
                }
            });

        document
            .getElementById(UI_ID + '-stop')
            .addEventListener('click', () => {

                stopRequested = true;
                pauseRequested = false;

                setState('Deteniendo...');

                log(
                    '⛔ Solicitud de detención recibida.'
                );
            });

        document
            .getElementById(UI_ID + '-copy')
            .addEventListener('click', async () => {

                const textarea =
                    document.getElementById(
                        UI_ID + '-log'
                    );

                try {

                    await navigator.clipboard.writeText(
                        textarea.value
                    );

                } catch {

                    textarea.select();

                    document.execCommand('copy');
                }

                log(
                    '✓ Log copiado al portapapeles.'
                );
            });

        document
            .getElementById(UI_ID + '-clear')
            .addEventListener('click', () => {

                document.getElementById(
                    UI_ID + '-log'
                ).value = '';
            });

        document
            .getElementById(UI_ID + '-reset')
            .addEventListener('click', () => {

                models = [];
                pauseRequested = false;
                stopRequested = false;
                backupRunning = false;

                setModelCount(0);
                setState('Preparado');

                setBackupButtons(false);

                const pause =
                    document.getElementById(
                        UI_ID + '-pause'
                    );

                if (pause) {
                    pause.textContent = 'Pausar';
                }

                log(
                    'Reset completado.'
                );
            });

        makeDraggable(
            panel,
            document.getElementById(
                UI_ID + '-drag'
            )
        );
    }

    function makeDraggable(
        panel,
        handle
    ) {

        let dragging = false;
        let offsetX = 0;
        let offsetY = 0;

        handle.addEventListener(
            'mousedown',
            e => {

                if (e.target.closest('button')) {
                    return;
                }

                dragging = true;

                const rect =
                    panel.getBoundingClientRect();

                offsetX =
                    e.clientX - rect.left;

                offsetY =
                    e.clientY - rect.top;

                panel.style.right = 'auto';
                panel.style.bottom = 'auto';

                panel.style.left =
                    rect.left + 'px';

                panel.style.top =
                    rect.top + 'px';
            }
        );

        document.addEventListener(
            'mousemove',
            e => {

                if (!dragging) {
                    return;
                }

                panel.style.left =
                    Math.max(
                        0,
                        Math.min(
                            window.innerWidth -
                            panel.offsetWidth,
                            e.clientX -
                            offsetX
                        )
                    ) + 'px';

                panel.style.top =
                    Math.max(
                        0,
                        Math.min(
                            window.innerHeight -
                            panel.offsetHeight,
                            e.clientY -
                            offsetY
                        )
                    ) + 'px';
            }
        );

        document.addEventListener(
            'mouseup',
            () => {
                dragging = false;
            }
        );
    }

    function setBackupButtons(running) {

        const scan =
            document.getElementById(
                UI_ID + '-scan'
            );

        const start =
            document.getElementById(
                UI_ID + '-start'
            );

        const pause =
            document.getElementById(
                UI_ID + '-pause'
            );

        const stop =
            document.getElementById(
                UI_ID + '-stop'
            );

        if (scan) scan.disabled = running;
        if (start) start.disabled = running;
        if (pause) pause.disabled = !running;
        if (stop) stop.disabled = !running;
    }

    // ============================================================
    // ESCÁNER
    // ============================================================

    function findAssetsPanel() {

        const candidates = [
            ...document.querySelectorAll(
                'div, section, aside'
            )
        ];

        let best = null;
        let bestScore = -Infinity;

        for (const el of candidates) {

            if (!visible(el)) {
                continue;
            }

            const text =
                normalizeText(el.innerText);

            if (
                !/upload\s+3d\s+model/i.test(text)
            ) {
                continue;
            }

            const rect =
                el.getBoundingClientRect();

            const scrollable =
                el.scrollHeight >
                el.clientHeight + 100;

            if (!scrollable) {
                continue;
            }

            let score = 0;

            if (
                rect.left >
                window.innerWidth * 0.45
            ) {
                score += 10;
            }

            if (
                rect.width <
                window.innerWidth * 0.55
            ) {
                score += 5;
            }

            if (
                el.scrollHeight > 1000
            ) {
                score += 10;
            }

            if (rect.height > 300) {
                score += 5;
            }

            if (score > bestScore) {
                bestScore = score;
                best = el;
            }
        }

        return best;
    }

    function getAssetsPanel() {

        if (
            assetsPanel &&
            document.contains(assetsPanel)
        ) {
            return assetsPanel;
        }

        assetsPanel = findAssetsPanel();

        return assetsPanel;
    }

    function getCardName(card) {

        if (!card) {
            return '';
        }

        const title =
            card.getAttribute('title');

        if (title) {
            return normalizeText(title);
        }

        const aria =
            card.getAttribute('aria-label');

        if (aria) {
            return normalizeText(aria);
        }

        const img =
            card.querySelector('img[alt]');

        if (img?.alt) {
            return normalizeText(img.alt);
        }

        const lines =
            String(card.innerText || '')
                .split('\n')
                .map(normalizeText)
                .filter(Boolean);

        return lines[0] || '';
    }

    function getThumbnail(card) {

        if (!card) {
            return null;
        }

        const img =
            card.querySelector('img');

        if (!img) {
            return null;
        }

        return (
            img.currentSrc ||
            img.src ||
            img.getAttribute('src') ||
            img.getAttribute('data-src') ||
            null
        );
    }

    function normalizeThumbnail(src) {

        if (!src) {
            return '';
        }

        return String(src)
            .replace(/\?.*$/, '')
            .trim();
    }

    function getCardFingerprint(card) {

        const name =
            getCardName(card);

        const thumb =
            normalizeThumbnail(
                getThumbnail(card)
            );

        return `${name}|||${thumb}`;
    }

    function getAssetCardFromElement(el) {

        let current = el;

        for (
            let i = 0;
            i < 7 && current;
            i++
        ) {

            if (current.nodeType !== 1) {
                break;
            }

            const rect =
                current.getBoundingClientRect();

            if (
                rect.width >= 80 &&
                rect.height >= 60 &&
                current.querySelector?.('img')
            ) {

                const name =
                    getCardName(current);

                if (name) {
                    return current;
                }
            }

            current =
                current.parentElement;
        }

        return null;
    }

    function collectVisibleAssets(
        panel,
        map
    ) {

        const elements =
            panel.querySelectorAll(
                'img, button, a, [role="button"], [role="option"], div'
            );

        for (const el of elements) {

            const card =
                getAssetCardFromElement(el);

            if (!card) continue;
            if (!visible(card)) continue;

            const name =
                getCardName(card);

            if (!name) continue;

            const fingerprint =
                getCardFingerprint(card);

            if (!fingerprint) continue;

            if (!map.has(fingerprint)) {

                map.set(
                    fingerprint,
                    {
                        fingerprint,
                        name,
                        thumbnail:
                            getThumbnail(card),
                        element: card
                    }
                );
            }
        }
    }

    async function scanModels() {

        if (backupRunning) {
            return;
        }

        stopRequested = false;

        setState('Escaneando...');

        log(
            'Iniciando escaneo de modelos...'
        );

        const panel =
            getAssetsPanel();

        if (!panel) {

            log(
                '✗ No se encontró el panel de Assets.'
            );

            setState('Error');

            return;
        }

        const map = new Map();

        let lastSize = 0;
        let stableRounds = 0;
        let lastScrollTop = -1;

        panel.scrollTop = 0;

        await sleep(
            SCAN_CONFIG.scrollWait
        );

        for (
            let round = 0;
            round < SCAN_CONFIG.maxRounds;
            round++
        ) {

            if (stopRequested) {

                log(
                    '⛔ Escaneo detenido.'
                );

                break;
            }

            collectVisibleAssets(
                panel,
                map
            );

            const currentSize =
                map.size;

            if (currentSize === lastSize) {
                stableRounds++;
            } else {
                stableRounds = 0;
                lastSize = currentSize;
            }

            const maxScroll =
                Math.max(
                    0,
                    panel.scrollHeight -
                    panel.clientHeight
                );

            const atBottom =
                panel.scrollTop >=
                maxScroll - 5;

            if (
                round %
                SCAN_CONFIG.logEvery === 0
            ) {

                log(
                    `Escaneo ronda ${
                        round + 1
                    }: ${
                        currentSize
                    } modelos`
                );
            }

            if (
                atBottom &&
                stableRounds >=
                SCAN_CONFIG.stableRounds
            ) {
                break;
            }

            const step =
                Math.max(
                    300,
                    Math.floor(
                        panel.clientHeight * 0.8
                    )
                );

            const before =
                panel.scrollTop;

            panel.scrollTop =
                Math.min(
                    maxScroll,
                    before + step
                );

            await sleep(
                SCAN_CONFIG.scrollWait
            );

            if (
                panel.scrollTop ===
                    lastScrollTop &&
                !atBottom
            ) {

                await sleep(
                    SCAN_CONFIG.scrollWait
                );
            }

            lastScrollTop =
                panel.scrollTop;

            collectVisibleAssets(
                panel,
                map
            );
        }

        collectVisibleAssets(
            panel,
            map
        );

        models =
            [...map.values()];

        setModelCount(
            models.length
        );

        panel.scrollTop = 0;

        setState(
            models.length
                ? 'Preparado'
                : 'Sin modelos'
        );

        log(
            `✓ Escaneo completado: ${
                models.length
            } modelos encontrados.`
        );
    }

    // ============================================================
    // PAUSA
    // ============================================================

    async function waitWhilePaused() {

        while (
            pauseRequested &&
            !stopRequested
        ) {
            await sleep(500);
        }
    }

    // ============================================================
    // MODELO
    // ============================================================

    function findModelCard(model) {

        const panel =
            getAssetsPanel();

        if (!panel) {
            return null;
        }

        const modelId =
            model?.name ||
            String(model?.fingerprint || '')
                .split('|||')[0];

        const exactHref =
            `/workspace/generate/${modelId}`;

        const exact =
            [
                ...panel.querySelectorAll('a[href]')
            ].find(
                a =>
                    a.getAttribute('href') ===
                    exactHref
            );

        if (exact) {
            return exact;
        }

        const elements =
            panel.querySelectorAll(
                'img, button, a, [role="button"], [role="option"], div'
            );

        for (const el of elements) {

            const card =
                getAssetCardFromElement(el);

            if (!card) continue;

            if (
                getCardFingerprint(card) ===
                model.fingerprint
            ) {
                return card;
            }
        }

        return null;
    }

    async function clickModelCard(model) {

        const target =
            findModelCard(model);

        if (!target) {

            throw new Error(
                'No se encontró la tarjeta real del modelo.'
            );
        }

        const href =
            target.getAttribute('href');

        log(
            `Modelo objetivo: A href=${href || '(sin href)'}`
        );

        if (
            target.tagName !== 'A' ||
            !href ||
            !href.startsWith(
                '/workspace/generate/'
            )
        ) {

            throw new Error(
                'La tarjeta localizada no es el enlace real /workspace/generate/<id>.'
            );
        }

        target.scrollIntoView({
            behavior: 'instant',
            block: 'center'
        });

        await sleep(300);

        target.click();

        await sleep(
            LOAD_CONFIG.afterModelClickWait
        );
    }

    function findMainExportButtons() {

        return [
            ...document.querySelectorAll(
                'button[data-trace-key="studio.workspace_generate.try_export_button"]'
            )
        ].filter(visible);
    }

    async function waitForModelExport(
        timeout
    ) {

        const start = Date.now();
        let lastLog = 0;

        while (
            Date.now() - start <
            timeout
        ) {

            if (stopRequested) {

                throw new Error(
                    'Backup detenido por el usuario.'
                );
            }

            await waitWhilePaused();

            const buttons =
                findMainExportButtons();

            if (buttons.length) {

                const exact =
                    buttons.find(
                        button =>
                            normalizeText(
                                button.innerText
                            ) === 'Export'
                    );

                return exact || buttons[0];
            }

            const elapsed =
                Math.floor(
                    (
                        Date.now() -
                        start
                    ) / 1000
                );

            if (
                elapsed >= lastLog + 5
            ) {

                log(
                    `Esperando Export del modelo... ${
                        elapsed
                    }s`
                );

                lastLog = elapsed;
            }

            await sleep(250);
        }

        return null;
    }

    async function openModel(
        model,
        modelIndex
    ) {

        log(
            `Abriendo modelo ${
                modelIndex + 1
            }/${models.length}...`
        );

        await clickModelCard(model);

        const first =
            await waitForModelExport(
                LOAD_CONFIG.modelLoadTimeout
            );

        if (first) {

            log(
                '✓ Modelo cargado y botón Export disponible.'
            );

            return;
        }

        log(
            '⚠ Export no apareció tras el primer intento.'
        );

        log(
            'Reintentando abrir el mismo modelo...'
        );

        await clickModelCard(model);

        const second =
            await waitForModelExport(
                LOAD_CONFIG.modelLoadTimeout
            );

        if (!second) {

            throw new Error(
                'No se encontró el botón principal Export después de dos intentos de apertura.'
            );
        }

        log(
            '✓ Modelo cargado tras el segundo intento.'
        );
    }

    // ============================================================
    // DIÁLOGO EXPORT
    // ============================================================

    function getVisibleExportDialog() {

        const dialogs =
            [
                ...document.querySelectorAll(
                    '[role="dialog"]'
                )
            ].filter(visible);

        for (const dialog of dialogs) {

            const text =
                normalizeText(
                    dialog.innerText
                );

            if (
                /\bExport\b/i.test(text) &&
                /\bFormat\b/i.test(text)
            ) {
                return dialog;
            }
        }

        return null;
    }

    async function waitForExportDialog() {

        return waitForElement(
            () =>
                getVisibleExportDialog(),
            LOAD_CONFIG.dialogTimeout,
            100
        );
    }

    async function ensureExportDialogClosed() {

        const dialog =
            getVisibleExportDialog();

        if (!dialog) {
            return;
        }

        log(
            '⚠ El diálogo Export anterior sigue abierto. Cerrándolo antes del siguiente export...'
        );

        document.dispatchEvent(
            new KeyboardEvent(
                'keydown',
                {
                    key: 'Escape',
                    code: 'Escape',
                    keyCode: 27,
                    which: 27,
                    bubbles: true,
                    cancelable: true,
                    composed: true
                }
            )
        );

        const closed =
            await waitForElement(
                () =>
                    getVisibleExportDialog()
                        ? null
                        : true,
                4000,
                100
            );

        if (!closed) {

            throw new Error(
                'El diálogo Export anterior no pudo cerrarse.'
            );
        }

        log(
            '✓ Diálogo Export anterior cerrado.'
        );
    }

    async function openExportDialog() {

        await ensureExportDialogClosed();

        log(
            'Esperando botón principal Export listo...'
        );

        const button =
            await waitForElement(
                () => {

                    const buttons =
                        findMainExportButtons();

                    if (!buttons.length) {
                        return null;
                    }

                    return (
                        buttons.find(
                            button =>
                                normalizeText(
                                    button.innerText
                                ) === 'Export'
                        ) ||
                        buttons[0]
                    );
                },
                60000,
                250
            );

        if (!button) {

            throw new Error(
                'No se encontró el botón principal Export después de esperar 60 s.'
            );
        }

        log(
            'Abriendo diálogo Export...'
        );

        button.scrollIntoView({
            behavior: 'instant',
            block: 'nearest'
        });

        button.click();

        const dialog =
            await waitForExportDialog();

        if (!dialog) {

            throw new Error(
                'No apareció el diálogo Export.'
            );
        }

        log(
            '✓ Diálogo Export confirmado.'
        );

        return dialog;
    }

    // ============================================================
    // FORMAT COMBOBOX
    // ============================================================

    function findFormatCombobox(dialog) {

        if (!dialog) {
            return null;
        }

        const combos =
            [
                ...dialog.querySelectorAll(
                    'button[role="combobox"]'
                )
            ].filter(visible);

        for (const combo of combos) {

            const parent =
                combo.parentElement;

            if (
                parent &&
                /\bFormat\b/i.test(
                    normalizeText(
                        parent.innerText
                    )
                )
            ) {
                return combo;
            }
        }

        return combos[0] || null;
    }

    function getOpenFormatListbox() {

        const listboxes =
            [
                ...document.querySelectorAll(
                    '[role="listbox"]'
                )
            ].filter(visible);

        return (
            listboxes.find(box => {

                const text =
                    normalizeText(
                        box.innerText
                    );

                return (
                    box.getAttribute(
                        'data-state'
                    ) === 'open' &&
                    text.includes('USD') &&
                    text.includes('FBX') &&
                    text.includes('OBJ') &&
                    text.includes('STL') &&
                    text.includes('GLB') &&
                    text.includes('3MF')
                );
            }) || null
        );
    }

    function getFormatOptions(listbox) {

        if (!listbox) {
            return [];
        }

        return [
            ...listbox.querySelectorAll(
                'div[data-reka-collection-item][role="option"]'
            )
        ].filter(visible);
    }

    function getFormatOption(
        listbox,
        format
    ) {

        return (
            getFormatOptions(listbox)
                .find(
                    option =>
                        normalizeText(
                            option.innerText
                        ) === format
                ) ||
            null
        );
    }

    async function openFormatDropdown(combo) {

        let listbox =
            getOpenFormatListbox();

        if (listbox) {
            return listbox;
        }

        log(
            'Abriendo dropdown Format...'
        );

        combo.focus();

        /*
         * Importante:
         * usamos la interacción del propio combobox.
         * No hacemos una cadena de pointer events
         * sobre la opción.
         */
        combo.click();

        listbox =
            await waitForElement(
                getOpenFormatListbox,
                2500,
                50
            );

        if (!listbox) {

            combo.focus();

            combo.dispatchEvent(
                new KeyboardEvent(
                    'keydown',
                    {
                        key: 'ArrowDown',
                        code: 'ArrowDown',
                        keyCode: 40,
                        which: 40,
                        bubbles: true,
                        cancelable: true,
                        composed: true
                    }
                )
            );

            listbox =
                await waitForElement(
                    getOpenFormatListbox,
                    2500,
                    50
                );
        }

        if (!listbox) {

            throw new Error(
                'No apareció el listbox real de Format.'
            );
        }

        log(
            '✓ Dropdown Format abierto.'
        );

        return listbox;
    }

    // ============================================================
    // SELECCIÓN DE FORMAT MEDIANTE EL COMBOBOX
    // ============================================================

    async function selectFormat(
        dialog,
        format
    ) {

        let combo =
            findFormatCombobox(dialog);

        if (!combo) {

            throw new Error(
                'No se encontró el combobox Format.'
            );
        }

        let current =
            normalizeText(
                combo.innerText
            );

        log(
            `Format actual: "${current}"`
        );

        if (current === format) {

            log(
                `✓ Format ya estaba seleccionado como "${format}".`
            );

            return dialog;
        }

        /*
         * El componente es un combobox real de Reka.
         *
         * No intentamos activar directamente el div
         * [role=option] con .click(), porque ya está
         * demostrado que eso no modifica el estado interno.
         *
         * Abrimos el menú y usamos el elemento combobox
         * como punto de entrada para navegación.
         */

        let listbox =
            await openFormatDropdown(combo);

        const options =
            getFormatOptions(listbox);

        if (!options.length) {

            throw new Error(
                'El listbox Format se abrió pero no contiene opciones.'
            );
        }

        const targetIndex =
            options.findIndex(
                option =>
                    normalizeText(
                        option.innerText
                    ) === format
            );

        if (targetIndex < 0) {

            throw new Error(
                `No se encontró "${format}" entre las opciones de Format.`
            );
        }

        let currentIndex =
            options.findIndex(
                option =>
                    option.getAttribute(
                        'aria-selected'
                    ) === 'true' ||
                    option.getAttribute(
                        'data-state'
                    ) === 'checked'
            );

        if (currentIndex < 0) {
            currentIndex = 0;
        }

        log(
            `Format actual en lista: ${
                normalizeText(
                    options[currentIndex]?.innerText
                )
            }`
        );

        log(
            `Formato solicitado: ${format}`
        );

        /*
         * Cerramos/reabrimos el menú antes de la navegación
         * para garantizar que el foco pertenece al combobox.
         */

        combo.focus();

        /*
         * Navegación absoluta:
         * Home -> primera opción
         * ArrowDown N veces -> posición solicitada
         * Enter -> confirmar
         *
         * Esto evita depender de .click() sobre el
         * elemento [role=option].
         */

        combo.dispatchEvent(
            new KeyboardEvent(
                'keydown',
                {
                    key: 'Home',
                    code: 'Home',
                    keyCode: 36,
                    which: 36,
                    bubbles: true,
                    cancelable: true,
                    composed: true
                }
            )
        );

        await sleep(100);

        for (
            let i = 0;
            i < targetIndex;
            i++
        ) {

            combo.dispatchEvent(
                new KeyboardEvent(
                    'keydown',
                    {
                        key: 'ArrowDown',
                        code: 'ArrowDown',
                        keyCode: 40,
                        which: 40,
                        bubbles: true,
                        cancelable: true,
                        composed: true
                    }
                )
            );

            await sleep(60);
        }

        combo.dispatchEvent(
            new KeyboardEvent(
                'keydown',
                {
                    key: 'Enter',
                    code: 'Enter',
                    keyCode: 13,
                    which: 13,
                    bubbles: true,
                    cancelable: true,
                    composed: true
                }
            )
        );

        /*
         * Esperar a que desaparezca el listbox o cambie
         * el texto del combobox.
         */

        const changed =
            await waitForElement(
                () => {

                    const newCombo =
                        findFormatCombobox(
                            dialog
                        );

                    if (!newCombo) {
                        return null;
                    }

                    const value =
                        normalizeText(
                            newCombo.innerText
                        );

                    return value === format
                        ? newCombo
                        : null;
                },
                3000,
                100
            );

        if (changed) {

            log(
                `✓ Format confirmado: ${format}`
            );

            await sleep(
                LOAD_CONFIG.afterFormatChangeWait
            );

            return dialog;
        }

        /*
         * Si no cambió, el menú puede seguir abierto.
         * Hacemos una única selección por foco directo de
         * la opción mediante teclado, sin eventos de ratón.
         */

        listbox =
            getOpenFormatListbox();

        if (listbox) {

            const option =
                getFormatOption(
                    listbox,
                    format
                );

            if (option) {

                option.focus();

                option.dispatchEvent(
                    new KeyboardEvent(
                        'keydown',
                        {
                            key: 'Enter',
                            code: 'Enter',
                            keyCode: 13,
                            which: 13,
                            bubbles: true,
                            cancelable: true,
                            composed: true
                        }
                    )
                );
            }
        }

        const changedAgain =
            await waitForElement(
                () => {

                    const finalCombo =
                        findFormatCombobox(
                            dialog
                        );

                    if (!finalCombo) {
                        return null;
                    }

                    const value =
                        normalizeText(
                            finalCombo.innerText
                        );

                    return value === format
                        ? finalCombo
                        : null;
                },
                3000,
                100
            );

        if (!changedAgain) {

            const finalCombo =
                findFormatCombobox(dialog);

            const finalValue =
                finalCombo
                    ? normalizeText(
                        finalCombo.innerText
                    )
                    : '(combobox no encontrado)';

            throw new Error(
                `El formato no quedó seleccionado como "${format}". Combobox="${finalValue}".`
            );
        }

        log(
            `✓ Format confirmado: ${format}`
        );

        return dialog;
    }

    // ============================================================
    // PRESET FBX
    // ============================================================

    async function selectFBXPreset(
        dialog,
        preset
    ) {

        if (!preset) {
            return;
        }

        const selector =
            `button[data-reka-collection-item][value="${preset}"]`;

        const button =
            await waitForElement(
                () => {

                    const candidates =
                        [
                            ...dialog.querySelectorAll(
                                selector
                            )
                        ];

                    return (
                        candidates.find(visible) ||
                        null
                    );
                },
                5000,
                100
            );

        if (!button) {

            throw new Error(
                `No se encontró el preset FBX "${preset}".`
            );
        }

        log(
            `Seleccionando preset FBX: ${preset}`
        );

        button.scrollIntoView({
            behavior: 'instant',
            block: 'nearest'
        });

        button.click();

        const confirmed =
            await waitForElement(
                () => {

                    const aria =
                        button.getAttribute(
                            'aria-pressed'
                        );

                    const state =
                        button.getAttribute(
                            'data-state'
                        );

                    return (
                        aria === 'true' ||
                        state === 'on'
                    )
                        ? button
                        : null;
                },
                3000,
                100
            );

        if (!confirmed) {

            throw new Error(
                `No se pudo seleccionar el preset FBX "${preset}".`
            );
        }

        log(
            `✓ Preset FBX confirmado: ${preset}`
        );
    }

    // ============================================================
    // BOTÓN EXPORT DEL DIÁLOGO
    // ============================================================

    function findDialogExportButton(
        dialog
    ) {

        const buttons =
            [
                ...dialog.querySelectorAll(
                    'button'
                )
            ].filter(visible);

        return (
            buttons.find(
                button =>
                    normalizeText(
                        button.innerText
                    ) === 'Export'
            ) || null
        );
    }

    async function pressDialogExport(
        dialog,
        format
    ) {

        const button =
            findDialogExportButton(dialog);

        if (!button) {

            throw new Error(
                `No se encontró el botón Export dentro del diálogo para ${format}.`
            );
        }

        log(
            `Pulsando Export para ${format}...`
        );

        button.scrollIntoView({
            behavior: 'instant',
            block: 'nearest'
        });

        button.click();

        await sleep(500);

        log(
            `✓ Export iniciado: ${format}`
        );
    }

    // ============================================================
    // TIEMPOS
    // ============================================================

    async function waitGeneration(format) {

        log(
            `${format}: esperando ${
                GENERATION_WAIT / 1000
            }s para que Tripo termine...`
        );

        let remaining =
            GENERATION_WAIT;

        let lastLogged = 0;

        while (remaining > 0) {

            if (stopRequested) {

                throw new Error(
                    'Backup detenido por el usuario.'
                );
            }

            await waitWhilePaused();

            const chunk =
                Math.min(
                    1000,
                    remaining
                );

            await sleep(chunk);

            remaining -= chunk;

            const elapsed =
                Math.floor(
                    (
                        GENERATION_WAIT -
                        remaining
                    ) / 1000
                );

            if (
                elapsed === 1 ||
                elapsed % 10 === 0 ||
                remaining <= 0
            ) {

                if (elapsed !== lastLogged) {

                    log(
                        `    ${elapsed}/${
                            GENERATION_WAIT / 1000
                        }s`
                    );

                    lastLogged = elapsed;
                }
            }
        }

        log(
            `✓ ${format}: tiempo de generación completado.`
        );

        log(
            `Esperando ${
                NEXT_EXPORT_MARGIN / 1000
            }s adicionales antes del siguiente export...`
        );

        remaining =
            NEXT_EXPORT_MARGIN;

        while (remaining > 0) {

            if (stopRequested) {

                throw new Error(
                    'Backup detenido por el usuario.'
                );
            }

            await waitWhilePaused();

            const chunk =
                Math.min(
                    1000,
                    remaining
                );

            await sleep(chunk);

            remaining -= chunk;
        }

        log(
            `✓ Margen adicional completado para ${format}.`
        );
    }

    // ============================================================
    // EXPORT
    // ============================================================

    async function exportFormat(
        task,
        taskIndex
    ) {

        log(
            '------------------------------------------------------------'
        );

        log(
            `Export ${
                taskIndex + 1
            }/${FORMAT_TASKS.length}: ${
                task.suffix
            }`
        );

        await waitWhilePaused();

        if (stopRequested) {

            throw new Error(
                'Backup detenido por el usuario.'
            );
        }

        /*
         * Cada formato vuelve al botón principal Export.
         * Nunca reutilizamos el diálogo anterior.
         */

        const dialog =
            await openExportDialog();

        await selectFormat(
            dialog,
            task.format
        );

        if (task.preset) {

            await selectFBXPreset(
                dialog,
                task.preset
            );
        }

        await pressDialogExport(
            dialog,
            task.format
        );

        await waitGeneration(
            task.suffix
        );
    }

    // ============================================================
    // BACKUP
    // ============================================================

    async function startBackup() {

        if (backupRunning) {
            return;
        }

        if (!models.length) {

            log(
                '✗ No hay modelos escaneados.'
            );

            setState(
                'Sin modelos'
            );

            return;
        }

        backupRunning = true;
        pauseRequested = false;
        stopRequested = false;

        setBackupButtons(true);
        setState('Ejecutando');

        log(
            `🚀 Iniciando backup de ${
                models.length
            } modelos.`
        );

        log(
            `📦 Orden: ${
                FORMAT_TASKS
                    .map(x => x.suffix)
                    .join(' → ')
            }`
        );

        log(
            `⏳ Espera de generación por export: ${
                GENERATION_WAIT / 1000
            }s`
        );

        log(
            `⏱ Margen entre exports: ${
                NEXT_EXPORT_MARGIN / 1000
            }s`
        );

        log(
            '============================================================'
        );

        try {

            for (
                let i = 0;
                i < models.length;
                i++
            ) {

                if (stopRequested) {
                    break;
                }

                await waitWhilePaused();

                const model =
                    models[i];

                log(
                    `MODELO ${
                        i + 1
                    }/${models.length}`
                );

                log(
                    `Nombre: ${
                        model.name || ''
                    }`
                );

                log(
                    `Fingerprint: ${
                        model.fingerprint
                    }`
                );

                try {

                    await openModel(
                        model,
                        i
                    );

                    for (
                        let j = 0;
                        j < FORMAT_TASKS.length;
                        j++
                    ) {

                        if (stopRequested) {

                            throw new Error(
                                'Backup detenido por el usuario.'
                            );
                        }

                        await waitWhilePaused();

                        await exportFormat(
                            FORMAT_TASKS[j],
                            j
                        );
                    }

                    log(
                        `✓ MODELO ${
                            i + 1
                        }/${models.length} COMPLETADO`
                    );

                } catch (error) {

                    log(
                        `✗ Error en modelo ${
                            i + 1
                        }: ${
                            error.message ||
                            error
                        }`
                    );

                    if (stopRequested) {
                        break;
                    }

                    log(
                        '⚠ Continuando con el siguiente modelo.'
                    );
                }
            }

            if (stopRequested) {

                setState('Detenido');

                log(
                    'BACKUP DETENIDO.'
                );

            } else {

                setState('Completado');

                log(
                    'BACKUP COMPLETO FINALIZADO.'
                );
            }

        } catch (error) {

            setState('Error');

            log(
                `✗ Error en backup: ${
                    error.message ||
                    error
                }`
            );

        } finally {

            backupRunning = false;

            setBackupButtons(false);

            const pause =
                document.getElementById(
                    UI_ID + '-pause'
                );

            if (pause) {
                pause.textContent = 'Pausar';
            }

            pauseRequested = false;
        }
    }

    // ============================================================
    // INICIO
    // ============================================================

    createUI();

    log(
        'Tripo Backup Manager v6.20 cargado.'
    );

})();
