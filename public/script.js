/* script.js - Container Packing Pro v7.0 - Đầy đủ tính năng */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

(function() {
    document.addEventListener('DOMContentLoaded', function() {
        // ==================== VERSION ====================
        const VERSION = '7.0.0';
        
        // ==================== CONTAINER TYPES ====================
        const CONTAINER_TYPES = {
            '20dc': { name: '20\' Standard', w: 235, h: 239, d: 590, maxLoad: 28200, tare: 2200, price: 500, color: 0x3b82f6 },
            '40dc': { name: '40\' Standard', w: 235, h: 239, d: 1203, maxLoad: 28700, tare: 3800, price: 800, color: 0x3b82f6 },
            '40hc': { name: '40\' High Cube', w: 235, h: 269, d: 1203, maxLoad: 29500, tare: 3900, price: 900, color: 0x60a5fa },
            '45hc': { name: '45\' High Cube', w: 235, h: 269, d: 1350, maxLoad: 30000, tare: 4800, price: 1100, color: 0x818cf8 },
            '20rf': { name: '20\' Reefer', w: 229, h: 227, d: 544, maxLoad: 28000, tare: 2800, price: 1200, color: 0x10b981 },
            '40rf': { name: '40\' Reefer', w: 229, h: 227, d: 1158, maxLoad: 29000, tare: 4400, price: 2000, color: 0x34d399 },
            'flatbed2': { name: 'Xe flatbed 2 trục', w: 245, h: 260, d: 1200, maxLoad: 30000, tare: 8000, price: 1200, color: 0xf97316, axlePositions: [200, 900], axleLimits: [13000, 17000], allowOverhangPercent: 10 },
            'flatbed3': { name: 'Xe flatbed 3 trục', w: 245, h: 300, d: 1350, maxLoad: 36000, tare: 9500, price: 1400, color: 0xf59e0b, axlePositions: [200, 700, 1200], axleLimits: [12000, 14000, 14000], allowOverhangPercent: 8 },
            'truck20': { name: 'Xe tải 20ft', w: 240, h: 260, d: 600, maxLoad: 16000, tare: 6500, price: 900, color: 0x3b82f6, axlePositions: [120, 500], axleLimits: [7000, 10000], allowOverhangPercent: 5 },
            'truck40': { name: 'Xe tải 40ft', w: 240, h: 280, d: 1200, maxLoad: 28000, tare: 10000, price: 1400, color: 0x2563eb, axlePositions: [150, 600, 1100], axleLimits: [9000, 11000, 11000], allowOverhangPercent: 5 }
        };
        
        // ==================== PACKING MATERIALS ====================
        const PACKING_MATERIALS = {
            'air_bag': { name: 'Túi khí cao áp', unit: 'cái', cost: 50000, usage: 'Khoảng trống lớn' },
            'foam_sheet': { name: 'Tấm xốp', unit: 'm²', cost: 25000, usage: 'Chèn giữa các lớp' },
            'corner_protector': { name: 'Ke góc', unit: 'm', cost: 5000, usage: 'Bảo vệ góc cạnh' },
            'stretch_film': { name: 'Màng co', unit: 'cuộn', cost: 50000, usage: 'Cố định hàng' },
            'wood_pallet': { name: 'Pallet gỗ', unit: 'cái', cost: 150000, usage: 'Kê hàng' },
            'anti_slip_mat': { name: 'Tấm chống trượt', unit: 'tấm', cost: 35000, usage: 'Chống trượt' },
            'edge_protector': { name: 'Bảo vệ cạnh', unit: 'm', cost: 8000, usage: 'Bảo vệ cạnh sắc' }
        };
        
        // ==================== GLOBAL STATE ====================
        let scene, camera, renderer, labelRenderer, orbitControls;
        let boxes = [];
        let selectedBox = null;
        let containerGroup = null;
        let currentContainer = { ...CONTAINER_TYPES['40hc'], code: '40hc', category: 'container' };
        let boxTypes = [];
        let history = [];
        let historyIndex = -1;
        const BOX_HISTORY_KEY = 'box_usage_history_v1';
        const CUSTOM_CARGO_SPACE_KEY = 'cpp_custom_cargo_spaces_v1';
        const FAVORITE_CARGO_SPACE_KEY = 'cpp_favorite_cargo_spaces_v1';
        const MANUAL_LOAD_SETTINGS_KEY = 'cpp_manual_load_settings_v1';
        const CUSTOM_CARGO_SPACE_PREFIX = 'custom:';
        let boxUsageHistory = [];
        let lastStepPlan = [];
        let cogMarker = null;
        let raycaster, mouse;
        let isDragging = false;
        let dragPlane = null;
        let rotationMode = false;
        let autoSaveInterval = null;
        let currentUser = null;
        let showLabels = true;
        let stepPlaybackTimer = null;
        const queueDragState = { activeKey: null };
        const manualDragState = { activeIndex: null };
        let customCargoSpaces = {};
        let favoriteCargoSpaces = [];
        let cargoSpaceFilter = 'all';
        let manualLoadSettings = { snapMagnet: true, autoRotate: true, grid: 10 };
        let easyActiveGroupKey = 'all';
        let easyItemModalIndex = -1;
        let easyHintDismissed = false;
        let easyWorkspaceMode = 'planner';
        let easyLegacyMode = false;
        let easyVehicleWorkspaceFavoritesOnly = false;
        let manualPlacementSession = null;
        let manualPlacementGuide = null;
        let manualPlacementGhost = null;
        let lastMultiCargoSpacePlan = [];
        let lastMultiCargoSpaceRemaining = 0;
        const ORIENTATION_MAPPINGS = [
            ['width', 'height', 'depth'],
            ['width', 'depth', 'height'],
            ['height', 'width', 'depth'],
            ['height', 'depth', 'width'],
            ['depth', 'width', 'height'],
            ['depth', 'height', 'width']
        ];
        const WORKFLOW_STEPS = [
            { id: 'setup', label: 'Khai bao', title: 'Khai báo chuyến' },
            { id: 'group', label: 'Group', title: 'Gom nhóm cargo' },
            { id: 'draft', label: 'Draft', title: 'Dựng layout' },
            { id: 'verify', label: 'Check', title: 'Kiểm tra cân tải' },
            { id: 'release', label: 'Release', title: 'Phát hành load plan' }
        ];
        const CARGO_TEMPLATE_LIBRARY = [
            { id: 'retail-carton', name: 'Retail Carton', width: 60, height: 40, depth: 45, weight: 18, quantity: 18, destination: 'Da Nang', group: 'Retail', priority: 2, category: 'normal', stackable: true, tiltable: true, rotatable: true, tags: ['Carton', 'Fast move'], sku: 'RTL-CTN' },
            { id: 'beverage-pallet', name: 'Beverage Pallet', width: 100, height: 130, depth: 120, weight: 480, quantity: 8, destination: 'Hai Phong', group: 'Beverage', priority: 4, category: 'heavy', stackable: true, tiltable: false, rotatable: false, tags: ['Pallet', 'Heavy'], sku: 'BVG-PLT' },
            { id: 'fragile-glass', name: 'Fragile Glass', width: 70, height: 90, depth: 60, weight: 65, quantity: 6, destination: 'Hai Phong', group: 'Glass', priority: 3, category: 'fragile', fragile: true, stackable: false, tiltable: false, rotatable: true, tags: ['Fragile', 'Keep up'], sku: 'GLS-FRG' },
            { id: 'electronics-rack', name: 'Electronics Rack', width: 80, height: 160, depth: 100, weight: 210, quantity: 5, destination: 'Da Nang', group: 'Electronics', priority: 1, category: 'normal', fragile: true, stackable: false, tiltable: false, rotatable: false, tags: ['High value', 'Door first'], sku: 'ELC-RCK' },
            { id: 'reefer-bin', name: 'Reefer Bin', width: 120, height: 110, depth: 100, weight: 320, quantity: 4, destination: 'Hai Phong', group: 'Cold chain', priority: 2, category: 'liquid', stackable: true, tiltable: false, rotatable: false, tags: ['Cold', 'Stable'], sku: 'RFR-BIN' },
            { id: 'machinery-crate', name: 'Machinery Crate', width: 140, height: 120, depth: 180, weight: 760, quantity: 2, destination: 'Da Nang', group: 'Machinery', priority: 3, category: 'heavy', hazardous: false, stackable: false, tiltable: false, rotatable: true, tags: ['Oversize', 'Anchor'], sku: 'MCH-CRT' }
        ];
        const QUICK_SCENARIOS = [
            {
                shipment: {
                    name: 'Tuyen HCM - Da Nang - Hai Phong',
                    ref: 'EXP-0402-40HC',
                    mode: 'export',
                    objective: 'balanced',
                    route: 'HCM -> Da Nang -> Hai Phong',
                    notes: 'Uu tien hang gia tri cao gan cua, dong thoi can tai deu giua cac truc.'
                },
                cargoIds: ['electronics-rack', 'retail-carton', 'fragile-glass', 'beverage-pallet']
            },
            {
                shipment: {
                    name: 'Tuyen reefer mien Trung',
                    ref: 'RFR-0402-TRK',
                    mode: 'reefer',
                    objective: 'door',
                    route: 'HCM -> Quy Nhon -> Da Nang',
                    notes: 'Giu khoang thoang gan cua cho thao tac do hang nhanh tai diem giua.'
                },
                cargoIds: ['reefer-bin', 'retail-carton', 'fragile-glass']
            }
        ];
        let shipmentState = {
            name: 'Tuyen HCM - Da Nang - Hai Phong',
            ref: 'EXP-0402-40HC',
            mode: 'export',
            objective: 'balanced',
            route: 'HCM -> Da Nang -> Hai Phong',
            notes: 'Uu tien hang gia tri cao gan cua, dong thoi can tai deu giua cac truc.'
        };
        const stepPlaybackState = {
            steps: [],
            index: -1,
            playing: false,
            timer: null
        };

        function getOrientationDims(baseDims, index = 0) {
            const map = ORIENTATION_MAPPINGS[index % ORIENTATION_MAPPINGS.length];
            return {
                width: baseDims[map[0]],
                height: baseDims[map[1]],
                depth: baseDims[map[2]]
            };
        }

        function parseRouteStops(route = '') {
            return String(route)
                .split(/->|,|;|\|/g)
                .map(stop => stop.trim())
                .filter(Boolean);
        }

        function escapeHTML(value = '') {
            return String(value)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
        }

        function inferCargoSpaceCategory(key = '', cargoSpace = {}) {
            const token = `${key} ${cargoSpace.name || ''}`.toLowerCase();
            if (token.includes('rf') || token.includes('reefer')) return 'reefer';
            if (token.includes('flatbed')) return 'flatbed';
            if (token.includes('truck') || token.includes('xe tai')) return 'truck';
            if (String(key).startsWith(CUSTOM_CARGO_SPACE_PREFIX)) return 'custom';
            return 'container';
        }

        function normalizeCargoSpace(space = {}, key = '') {
            return {
                name: space.name || 'Cargo Space',
                w: Number(space.w) || 235,
                h: Number(space.h) || 239,
                d: Number(space.d) || 590,
                maxLoad: Number(space.maxLoad) || 29500,
                tare: Number(space.tare) || 0,
                price: Number(space.price) || 0,
                color: Number(space.color) || 0x3b82f6,
                axlePositions: Array.isArray(space.axlePositions) ? [...space.axlePositions] : [],
                axleLimits: Array.isArray(space.axleLimits) ? [...space.axleLimits] : [],
                allowOverhangPercent: Number(space.allowOverhangPercent) || 0,
                code: key || space.code || '40hc',
                category: space.category || inferCargoSpaceCategory(key, space)
            };
        }

        function getCargoSpaceCatalog() {
            const builtin = Object.entries(CONTAINER_TYPES).map(([key, value]) => normalizeCargoSpace(value, key));
            const custom = Object.entries(customCargoSpaces).map(([key, value]) => normalizeCargoSpace({ ...value, category: 'custom' }, key));
            return [...builtin, ...custom];
        }

        function getCargoSpaceByKey(key = '') {
            return getCargoSpaceCatalog().find(space => space.code === key) || null;
        }

        function getActiveCargoSpaceKey() {
            return currentContainer.code || document.getElementById('contType')?.value || '40hc';
        }

        function slugifyCargoSpaceName(name = '') {
            return String(name)
                .toLowerCase()
                .trim()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-+|-+$/g, '') || `cargo-space-${Date.now()}`;
        }

        function saveCustomCargoSpaces() {
            localStorage.setItem(CUSTOM_CARGO_SPACE_KEY, JSON.stringify(customCargoSpaces));
        }

        function saveFavoriteCargoSpaces() {
            localStorage.setItem(FAVORITE_CARGO_SPACE_KEY, JSON.stringify(favoriteCargoSpaces));
        }

        function saveManualLoadSettings() {
            localStorage.setItem(MANUAL_LOAD_SETTINGS_KEY, JSON.stringify(manualLoadSettings));
        }

        function loadOperationalPreferences() {
            try {
                customCargoSpaces = JSON.parse(localStorage.getItem(CUSTOM_CARGO_SPACE_KEY) || '{}') || {};
            } catch (error) {
                customCargoSpaces = {};
            }
            try {
                favoriteCargoSpaces = JSON.parse(localStorage.getItem(FAVORITE_CARGO_SPACE_KEY) || '[]') || [];
            } catch (error) {
                favoriteCargoSpaces = [];
            }
            try {
                manualLoadSettings = {
                    ...manualLoadSettings,
                    ...(JSON.parse(localStorage.getItem(MANUAL_LOAD_SETTINGS_KEY) || '{}') || {})
                };
            } catch (error) {
                manualLoadSettings = { snapMagnet: true, autoRotate: true, grid: 10 };
            }
            manualLoadSettings.grid = Number(manualLoadSettings.grid) || 10;
            manualLoadSettings.snapMagnet = manualLoadSettings.snapMagnet !== false;
            manualLoadSettings.autoRotate = manualLoadSettings.autoRotate !== false;
        }

        function getFilteredCargoSpaces(activeKey = getActiveCargoSpaceKey()) {
            const catalog = getCargoSpaceCatalog();
            const filtered = catalog.filter(space => {
                if (cargoSpaceFilter === 'all') return true;
                if (cargoSpaceFilter === 'favorites') return favoriteCargoSpaces.includes(space.code);
                return space.category === cargoSpaceFilter;
            });
            if (activeKey && !filtered.some(space => space.code === activeKey)) {
                const activeSpace = getCargoSpaceByKey(activeKey);
                if (activeSpace) filtered.unshift(activeSpace);
            }
            return filtered;
        }

        function updateManualLoadControls() {
            const snapBtn = document.getElementById('btnSnapMagnet');
            const rotateBtn = document.getElementById('btnAutoRotateManual');
            const gridSelect = document.getElementById('manualGridSize');
            if (snapBtn) {
                snapBtn.classList.toggle('active', manualLoadSettings.snapMagnet);
                snapBtn.textContent = manualLoadSettings.snapMagnet ? 'Magnet snap ON' : 'Magnet snap OFF';
            }
            if (rotateBtn) {
                rotateBtn.classList.toggle('active', manualLoadSettings.autoRotate);
                rotateBtn.textContent = manualLoadSettings.autoRotate ? 'Auto rotate ON' : 'Auto rotate OFF';
            }
            if (gridSelect) gridSelect.value = String(Number(manualLoadSettings.grid) || 10);
        }

        function renderCargoSpaceFavorites(activeKey = getActiveCargoSpaceKey()) {
            const container = document.getElementById('cargoSpaceFavorites');
            if (!container) return;
            const favorites = favoriteCargoSpaces
                .map(code => getCargoSpaceByKey(code))
                .filter(Boolean);

            if (!favorites.length) {
                container.innerHTML = '<span class="cargo-space-chip empty">Chưa có favorite cargo space</span>';
                return;
            }

            container.innerHTML = favorites.map(space => `
                <button class="cargo-space-chip ${space.code === activeKey ? 'active' : ''}" data-space-key="${escapeHTML(space.code)}" type="button">
                    <span>★</span>${escapeHTML(space.name)}
                </button>
            `).join('');

            container.querySelectorAll('[data-space-key]').forEach(button => {
                button.addEventListener('click', () => applyCargoSpaceToState(button.dataset.spaceKey));
            });
        }

        function syncCargoSpaceActions(activeKey = getActiveCargoSpaceKey()) {
            const favoriteBtn = document.getElementById('btnFavoriteCargoSpace');
            const active = getCargoSpaceByKey(activeKey);
            const isFavorite = favoriteCargoSpaces.includes(activeKey);
            if (favoriteBtn) {
                favoriteBtn.textContent = isFavorite ? '★ Bỏ favorite' : '☆ Favorite';
                favoriteBtn.classList.toggle('active-chip', isFavorite);
                favoriteBtn.disabled = !active;
            }
        }

        function renderCargoSpaceSelector(preferredKey = getActiveCargoSpaceKey()) {
            const contSelect = document.getElementById('contType');
            if (!contSelect) return;
            const filteredSpaces = getFilteredCargoSpaces(preferredKey);
            const spaces = filteredSpaces.length ? filteredSpaces : getCargoSpaceCatalog();
            const activeKey = spaces.some(space => space.code === preferredKey)
                ? preferredKey
                : (spaces[0]?.code || preferredKey || '40hc');

            contSelect.innerHTML = spaces.map(space => `
                <option value="${escapeHTML(space.code)}">${space.name} (${space.w}x${space.h}x${space.d} cm)</option>
            `).join('');
            contSelect.value = activeKey;

            const filterInput = document.getElementById('cargoSpaceFilter');
            if (filterInput) filterInput.value = cargoSpaceFilter;

            renderCargoSpaceFavorites(activeKey);
            syncCargoSpaceActions(activeKey);
        }

function syncContainerInputs() {
            const cw = document.getElementById('cw');
            const ch = document.getElementById('ch');
            const cd = document.getElementById('cd');
            const maxLoadInput = document.getElementById('maxLoadWeight');
            const maxLoadDisplay = document.getElementById('maxLoad');
            const contSelect = document.getElementById('contType');
            if (cw) cw.value = currentContainer.w;
            if (ch) ch.value = currentContainer.h;
            if (cd) cd.value = currentContainer.d;
            if (maxLoadInput) {
                maxLoadInput.value = currentContainer.maxLoad;
                maxLoadInput.onchange = (e) => {
                    currentContainer.maxLoad = Number(e.target.value) || 29500;
                    maxLoadDisplay.textContent = currentContainer.maxLoad.toLocaleString();
                    updateStats();
                };
            }
            if (maxLoadDisplay) maxLoadDisplay.textContent = currentContainer.maxLoad.toLocaleString();
            if (contSelect && currentContainer.code) contSelect.value = currentContainer.code;
            updateContainerVolume();
        }

function updateContainerVolume() {
            const volumeCm3 = currentContainer.w * currentContainer.h * currentContainer.d;
            const volumeM3 = (volumeCm3 / 1000000).toFixed(2);
            const elem = document.getElementById('containerVolume');
            if (elem) elem.textContent = volumeM3;
            return volumeM3;
        }

        // Thêm event listener cho dimension inputs
        function setupDimensionListeners() {
            const dims = ['cw', 'ch', 'cd'];
            dims.forEach(id => {
                const input = document.getElementById(id);
                if (input) {
                    input.onchange = input.oninput = (e) => {
                        currentContainer[id[0] === 'c' ? id.slice(1) : id] = Number(e.target.value) || 0;
                        updateContainerVolume();
                        updateContainerVisual();
                        updateStats();
                    };
                }
            });
        }

function applyCargoSpaceToState(spaceKey, options = {}) {
            const { silent = false, skipVisuals = false } = options;
            const space = getCargoSpaceByKey(spaceKey);
            if (!space) return;
            currentContainer = normalizeCargoSpace(space, space.code);
            currentContainer.code = space.code;
            syncContainerInputs();
            renderCargoSpaceSelector(space.code);
            if (!skipVisuals) {
                updateContainerVisual();
                updateStats();
                updateCOG();
                updateContainerVolume();
            }
            if (!silent) {
                showNotification(`Đã chuyển cargo space sang ${space.name}`, 'info', 1300);
            }
        }

        function applyOptimizerContainerState(containerInput = {}, options = {}) {
            const { silent = true } = options;
            if (!containerInput) return;

            const containerKey = containerInput.id || containerInput.code || '';
            const knownSpace = containerKey ? getCargoSpaceByKey(containerKey) : null;
            const baseContainer = knownSpace || currentContainer;

            currentContainer = normalizeCargoSpace({
                ...baseContainer,
                ...containerInput,
                name: containerInput.name || baseContainer.name,
                w: containerInput.width ?? containerInput.w ?? baseContainer.w,
                h: containerInput.height ?? containerInput.h ?? baseContainer.h,
                d: containerInput.depth ?? containerInput.d ?? baseContainer.d,
                maxLoad: containerInput.maxLoad ?? baseContainer.maxLoad,
                tare: containerInput.tare ?? baseContainer.tare,
                price: containerInput.price ?? baseContainer.price,
                color: containerInput.color ?? baseContainer.color,
                axlePositions: Array.isArray(containerInput.axlePositions) ? containerInput.axlePositions : baseContainer.axlePositions,
                axleLimits: Array.isArray(containerInput.axleLimits) ? containerInput.axleLimits : baseContainer.axleLimits,
                allowOverhangPercent: containerInput.allowOverhangPercent ?? baseContainer.allowOverhangPercent,
                category: containerInput.category || baseContainer.category
            }, containerKey || currentContainer.code || '40hc');

            syncContainerInputs();
            renderCargoSpaceSelector(currentContainer.code || '40hc');
            updateContainerVisual();
            updateStats();
            updateCOG();
            if (!silent) {
                showNotification(`Da chon cargo space ${currentContainer.name}`, 'info', 1300);
            }
        }

        function toggleFavoriteCargoSpace() {
            const activeKey = currentContainer.code;
            if (!activeKey || !getCargoSpaceByKey(activeKey)) {
                showNotification('Hay luu cargo space custom truoc khi danh dau favorite', 'warning', 1500);
                return;
            }
            if (favoriteCargoSpaces.includes(activeKey)) {
                favoriteCargoSpaces = favoriteCargoSpaces.filter(code => code !== activeKey);
                showNotification('Da bo cargo space khoi favorites', 'info', 1200);
            } else {
                favoriteCargoSpaces = [...favoriteCargoSpaces, activeKey];
                showNotification('Da them cargo space vao favorites', 'success', 1200);
            }
            saveFavoriteCargoSpaces();
            renderCargoSpaceSelector(activeKey);
            renderEasyVehicleBrowser();
            renderEasyVehicleCatalogTable();
        }

        function saveCurrentCargoSpaceAsCustom() {
            const name = window.prompt('Ten cargo space custom', `${currentContainer.name || 'Cargo Space'} Custom`);
            if (!name) return;
            const key = `${CUSTOM_CARGO_SPACE_PREFIX}${slugifyCargoSpaceName(name)}`;
            customCargoSpaces[key] = normalizeCargoSpace({
                name: name.trim(),
                w: Number(document.getElementById('cw')?.value) || currentContainer.w,
                h: Number(document.getElementById('ch')?.value) || currentContainer.h,
                d: Number(document.getElementById('cd')?.value) || currentContainer.d,
                maxLoad: Number(currentContainer.maxLoad) || 29500,
                tare: Number(currentContainer.tare) || 0,
                price: Number(currentContainer.price) || 0,
                color: currentContainer.color || 0x3b82f6,
                axlePositions: currentContainer.axlePositions || [],
                axleLimits: currentContainer.axleLimits || [],
                allowOverhangPercent: currentContainer.allowOverhangPercent || 0,
                category: 'custom'
            }, key);
            saveCustomCargoSpaces();
            cargoSpaceFilter = 'custom';
            renderCargoSpaceSelector(key);
            applyCargoSpaceToState(key, { silent: true });
            renderEasyVehicleCatalogTable();
            showNotification(`Da luu cargo space ${name.trim()}`, 'success', 1500);
        }

        function captureShipmentState() {
            const nameInput = document.getElementById('shipmentName');
            const refInput = document.getElementById('shipmentRef');
            const modeInput = document.getElementById('shipmentMode');
            const objectiveInput = document.getElementById('shipmentObjective');
            const routeInput = document.getElementById('shipmentRoute');
            const notesInput = document.getElementById('shipmentNotes');

            if (nameInput) shipmentState.name = nameInput.value.trim() || shipmentState.name;
            if (refInput) shipmentState.ref = refInput.value.trim() || shipmentState.ref;
            if (modeInput) shipmentState.mode = modeInput.value || shipmentState.mode;
            if (objectiveInput) shipmentState.objective = objectiveInput.value || shipmentState.objective;
            if (routeInput) shipmentState.route = routeInput.value.trim() || shipmentState.route;
            if (notesInput) shipmentState.notes = notesInput.value.trim() || shipmentState.notes;

            return { ...shipmentState };
        }

        function applyShipmentStateToInputs(nextState = {}) {
            shipmentState = { ...shipmentState, ...nextState };
            const mapping = {
                shipmentName: shipmentState.name,
                shipmentRef: shipmentState.ref,
                shipmentMode: shipmentState.mode,
                shipmentObjective: shipmentState.objective,
                shipmentRoute: shipmentState.route,
                shipmentNotes: shipmentState.notes
            };
            Object.entries(mapping).forEach(([id, value]) => {
                const input = document.getElementById(id);
                if (input) input.value = value || '';
            });
        }

        function capturePlanningRules() {
            const getChecked = (id, fallback = false) => {
                const input = document.getElementById(id);
                return input ? !!input.checked : fallback;
            };

            const ignoreGroupSeparation = getChecked('ruleIgnoreGroupSeparation', false);
            const respectPrioritySeparation = ignoreGroupSeparation ? false : getChecked('ruleRespectPrioritySeparation', true);

            return {
                priority: {
                    respectSeparation: respectPrioritySeparation,
                    ignoreSeparation: ignoreGroupSeparation,
                    noGroupStacking: ignoreGroupSeparation ? false : getChecked('ruleNoGroupStacking', false),
                    splitByWall: ignoreGroupSeparation ? false : getChecked('ruleSplitByWall', false)
                },
                weight: {
                    respectLimits: getChecked('ruleRespectWeightLimits', true),
                    shiftToMassCenter: getChecked('ruleShiftToMassCenter', false)
                }
            };
        }

        function updateRuleStatusPanel() {
            const panel = document.getElementById('ruleStatusPanel');
            if (!panel) return;
            const rules = capturePlanningRules();
            const activeRules = [];
            if (rules.priority.ignoreSeparation) activeRules.push('Ignore separation into priority groups');
            else if (rules.priority.respectSeparation) activeRules.push('Respect separation into priority groups');
            if (rules.priority.noGroupStacking) activeRules.push('No stacking of priority groups allowed');
            if (rules.priority.splitByWall) activeRules.push('Split of priority groups with an invisible wall');
            if (rules.weight.respectLimits) activeRules.push('Respect weight limits');
            else activeRules.push('Ignore weight limits when loading');
            if (rules.weight.shiftToMassCenter) activeRules.push('Shift loaded items to mass center');
            const groupOrder = getQueueGroups().slice(0, 4).map(group => `P${group.priority} ${group.group}`).join(' -> ');

            panel.innerHTML = `
                <strong>Rule Engine</strong>
                <div>${activeRules.join(' · ')}</div>
                <div style="margin-top:6px; color:rgba(255,255,255,0.72);">${groupOrder || 'Chua co group order'}</div>
            `;
        }

        function buildTemplateDraft(template, overrides = {}) {
            return {
                name: template.name,
                width: template.width,
                height: template.height,
                depth: template.depth,
                weight: template.weight,
                quantity: template.quantity || 1,
                destination: template.destination || '',
                group: template.group || template.destination || 'General',
                priority: Number(template.priority) || 3,
                category: template.category || 'normal',
                fragile: !!template.fragile,
                hazardous: !!template.hazardous,
                fixedOrientation: template.fixedOrientation || false,
                stackable: template.stackable !== false,
                tiltable: template.tiltable !== false,
                rotatable: template.rotatable !== false,
                sku: template.sku || '',
                tags: [...(template.tags || [])],
                excluded: !!template.excluded,
                ...overrides
            };
        }

        function getEntryQueueKey(entry) {
            const destination = entry.destination || 'Kho chinh';
            const group = entry.group || 'General';
            const priority = Number(entry.priority) || 3;
            return `${priority}__${destination}__${group}`;
        }

        function populateCargoTemplateForm(template) {
            if (!template) return;
            const fields = {
                boxTypeName: template.name,
                boxWidth: template.width,
                boxHeight: template.height,
                boxDepth: template.depth,
                boxWeight: template.weight,
                boxQuantity: template.quantity || 1,
                boxDestination: template.destination || '',
                boxGroup: template.group || '',
                boxPriority: Number(template.priority) || 3,
                boxSku: template.sku || ''
            };
            Object.entries(fields).forEach(([id, value]) => {
                const input = document.getElementById(id);
                if (input) input.value = value;
            });
            const checkboxMap = {
                fixedOrientation: !!template.fixedOrientation,
                stackable: template.stackable !== false,
                tiltable: template.tiltable !== false,
                rotatable: template.rotatable !== false,
                fragile: !!template.fragile,
                hazardous: !!template.hazardous
            };
            Object.entries(checkboxMap).forEach(([id, value]) => {
                const input = document.getElementById(id);
                if (input) input.checked = value;
            });
            const excludeInput = document.getElementById('excludeFromShipment');
            if (excludeInput) excludeInput.checked = !!template.excluded;
            const categoryInput = document.getElementById('boxCategory');
            if (categoryInput) categoryInput.value = template.category || 'normal';
        }

        function getActiveBoxTypes() {
            return boxTypes.filter(boxType => boxType.excluded !== true);
        }

        function getPlanningEntries() {
            const activeBoxTypes = getActiveBoxTypes();
            if (activeBoxTypes.length > 0 || (boxTypes.length > 0 && boxes.length === 0)) {
                return activeBoxTypes.map(bt => {
                    const quantity = Number(bt.quantity) || 1;
                    const volumeEach = ((Number(bt.width) || 0) * (Number(bt.height) || 0) * (Number(bt.depth) || 0)) / 1000000;
                    return {
                        name: bt.name || 'Cargo',
                        quantity,
                        width: Number(bt.width) || 0,
                        height: Number(bt.height) || 0,
                        depth: Number(bt.depth) || 0,
                        weight: Number(bt.weight) || 0,
                        totalWeight: (Number(bt.weight) || 0) * quantity,
                        volumeEach,
                        totalVolume: volumeEach * quantity,
                        destination: bt.destination || '',
                        group: bt.group || bt.destination || 'General',
                        priority: Number(bt.priority) || 3,
                        category: bt.category || 'normal',
                        sku: bt.sku || '',
                        excluded: !!bt.excluded,
                        source: 'planned'
                    };
                });
            }

            return boxes.map(box => ({
                name: box.userData.name || `Box ${box.userData.id}`,
                quantity: 1,
                width: Number(box.userData.width) || 0,
                height: Number(box.userData.height) || 0,
                depth: Number(box.userData.depth) || 0,
                weight: Number(box.userData.weight) || 0,
                totalWeight: Number(box.userData.weight) || 0,
                volumeEach: ((Number(box.userData.width) || 0) * (Number(box.userData.height) || 0) * (Number(box.userData.depth) || 0)) / 1000000,
                totalVolume: ((Number(box.userData.width) || 0) * (Number(box.userData.height) || 0) * (Number(box.userData.depth) || 0)) / 1000000,
                destination: box.userData.destination || '',
                group: box.userData.group || box.userData.destination || 'General',
                priority: Number(box.userData.priority) || 3,
                category: box.userData.category || 'normal',
                sku: box.userData.sku || '',
                excluded: !!box.userData.excluded,
                source: 'placed'
            }));
        }

        function getPlacedMetrics() {
            let totalVolumeCm3 = 0;
            let totalWeight = 0;
            boxes.forEach(box => {
                totalVolumeCm3 += (Number(box.userData.width) || 0) * (Number(box.userData.height) || 0) * (Number(box.userData.depth) || 0);
                totalWeight += Number(box.userData.weight) || 0;
            });
            const containerVolumeCm3 = currentContainer.w * currentContainer.h * currentContainer.d;
            return {
                boxCount: boxes.length,
                totalVolumeM3: totalVolumeCm3 / 1000000,
                totalWeight,
                volumePercent: containerVolumeCm3 > 0 ? (totalVolumeCm3 / containerVolumeCm3) * 100 : 0,
                weightPercent: currentContainer.maxLoad > 0 ? (totalWeight / currentContainer.maxLoad) * 100 : 0
            };
        }

        function getAxleHealth() {
            const axle = computeAxleLoads();
            const ratios = (axle.loads || []).map((load, idx) => {
                const limit = axle.limits?.[idx] || 1;
                return limit ? load / limit : 0;
            });
            const maxRatio = ratios.length ? Math.max(...ratios) : 0;
            return {
                maxRatio,
                safe: maxRatio <= 1,
                label: maxRatio > 1 ? 'Vuot nguong' : (maxRatio > 0.85 ? 'Can theo doi' : 'An toan')
            };
        }

        function getDoorAccessScore() {
            const planningEntries = getPlanningEntries();
            if (boxes.length === 0) {
                const totalQty = planningEntries.reduce((sum, entry) => sum + entry.quantity, 0);
                if (!totalQty) return 0;
                const nearDoorQty = planningEntries.reduce((sum, entry) => sum + ((Number(entry.priority) || 3) >= 3 ? entry.quantity : 0), 0);
                return (nearDoorQty / totalQty) * 100;
            }

            let weighted = 0;
            let totalWeight = 0;
            boxes.forEach(box => {
                const weight = Number(box.userData.weight) || 1;
                totalWeight += weight;
                const priority = Number(box.userData.priority) || 3;
                const doorDistance = Math.max(0, currentContainer.d / 2 - (box.position.z + box.userData.depth / 2));
                const normalizedDoor = 1 - Math.min(doorDistance / Math.max(currentContainer.d, 1), 1);
                const priorityBoost = Math.min(Math.max(priority, 1), 4) / 4;
                weighted += normalizedDoor * (0.65 + priorityBoost * 0.35) * weight;
            });
            return totalWeight ? (weighted / totalWeight) * 100 : 0;
        }

        function collectPlanningInsights() {
            const state = captureShipmentState();
            const rules = capturePlanningRules();
            const entries = getPlanningEntries();
            const plannedQty = entries.reduce((sum, entry) => sum + entry.quantity, 0);
            const plannedVolume = entries.reduce((sum, entry) => sum + entry.totalVolume, 0);
            const plannedWeight = entries.reduce((sum, entry) => sum + entry.totalWeight, 0);
            const routeStops = parseRouteStops(state.route);
            const destinationStops = [...new Set(entries.map(entry => entry.destination).filter(Boolean))];
            const groups = [...new Set(entries.map(entry => entry.group).filter(Boolean))];
            const avgDensity = plannedVolume > 0 ? plannedWeight / plannedVolume : 0;
            const nearDoorQty = entries.reduce((sum, entry) => sum + ((Number(entry.priority) || 3) >= 3 ? entry.quantity : 0), 0);
            const placedMetrics = getPlacedMetrics();
            const axleHealth = getAxleHealth();

            let balanceScore = 0;
            if (boxes.length > 0) {
                let leftWeight = 0;
                let rightWeight = 0;
                let frontWeight = 0;
                let rearWeight = 0;
                boxes.forEach(box => {
                    const weight = Number(box.userData.weight) || 0;
                    if (box.position.x < 0) leftWeight += weight;
                    else rightWeight += weight;
                    if (box.position.z < 0) rearWeight += weight;
                    else frontWeight += weight;
                });
                const totalWeight = leftWeight + rightWeight || 1;
                const lrScore = 1 - Math.abs(leftWeight - rightWeight) / totalWeight;
                const fbScore = 1 - Math.abs(frontWeight - rearWeight) / totalWeight;
                balanceScore = Math.max(0, Math.min(1, (lrScore + fbScore) / 2));
            }

            const stage = (() => {
                if (!entries.length && !boxes.length) return 0;
                if (entries.length && !boxes.length) return 1;
                if (boxes.length && !lastStepPlan.length) return 2;
                if (lastStepPlan.length && balanceScore < 0.82) return 3;
                if (lastStepPlan.length) return 4;
                return 2;
            })();

            return {
                state,
                entries,
                rules,
                plannedQty,
                plannedVolume,
                plannedWeight,
                routeStops,
                routeStopCount: routeStops.length || destinationStops.length,
                destinationStops,
                groups,
                avgDensity,
                nearDoorPercent: plannedQty ? (nearDoorQty / plannedQty) * 100 : 0,
                placedMetrics,
                balanceScore,
                axleHealth,
                doorScore: getDoorAccessScore(),
                stage
            };
        }

        function getActiveRuleLabels(rules = capturePlanningRules()) {
            const activeRules = [];
            if (rules.priority.ignoreSeparation) activeRules.push('Ignore separation into priority groups');
            else if (rules.priority.respectSeparation) activeRules.push('Respect separation into priority groups');
            if (rules.priority.noGroupStacking) activeRules.push('No stacking between groups');
            if (rules.priority.splitByWall) activeRules.push('Split groups with virtual wall');
            activeRules.push(rules.weight.respectLimits ? 'Respect weight limits' : 'Ignore weight limits');
            if (rules.weight.shiftToMassCenter) activeRules.push('Shift to mass center');
            return activeRules;
        }

        function roundMetric(value, digits = 2) {
            const factor = 10 ** digits;
            return Math.round((Number(value) || 0) * factor) / factor;
        }

        function buildShareSnapshot() {
            const metrics = collectPlanningInsights();
            const rules = capturePlanningRules();
            const axleData = computeAxleLoads();
            const containerCode = currentContainer.code || '';
            const queueGroups = getQueueGroups(metrics).map(group => ({
                queueKey: group.queueKey,
                destination: group.destination,
                group: group.group,
                priority: Number(group.priority) || 3,
                totalQty: Number(group.totalQty) || 0,
                totalWeight: roundMetric(group.totalWeight, 2),
                totalVolume: roundMetric(group.totalVolume, 3),
                items: (group.items || []).map(item => ({
                    name: item.name || 'Cargo',
                    quantity: Number(item.quantity) || 0,
                    width: Number(item.width) || 0,
                    height: Number(item.height) || 0,
                    depth: Number(item.depth) || 0,
                    weight: Number(item.weight) || 0,
                    totalWeight: roundMetric(item.totalWeight, 2),
                    totalVolume: roundMetric(item.totalVolume, 3),
                    destination: item.destination || '',
                    group: item.group || item.destination || 'General',
                    priority: Number(item.priority) || 3,
                    category: item.category || 'normal',
                    sku: item.sku || '',
                    excluded: !!item.excluded
                }))
            }));

            const plannedEntries = metrics.entries.map(entry => ({
                name: entry.name || 'Cargo',
                quantity: Number(entry.quantity) || 0,
                width: Number(entry.width) || 0,
                height: Number(entry.height) || 0,
                depth: Number(entry.depth) || 0,
                weight: Number(entry.weight) || 0,
                totalWeight: roundMetric(entry.totalWeight, 2),
                totalVolume: roundMetric(entry.totalVolume, 3),
                destination: entry.destination || '',
                group: entry.group || entry.destination || 'General',
                priority: Number(entry.priority) || 3,
                category: entry.category || 'normal',
                sku: entry.sku || '',
                excluded: !!entry.excluded,
                source: entry.source || 'planned'
            }));

            const placedBoxes = boxes.map(box => ({
                id: box.userData.id,
                name: box.userData.name || `Box ${box.userData.id}`,
                width: Number(box.userData.width) || 0,
                height: Number(box.userData.height) || 0,
                depth: Number(box.userData.depth) || 0,
                weight: Number(box.userData.weight) || 0,
                category: box.userData.category || 'normal',
                fragile: !!box.userData.fragile,
                hazardous: !!box.userData.hazardous,
                destination: box.userData.destination || '',
                group: box.userData.group || box.userData.destination || 'General',
                priority: Number(box.userData.priority) || 3,
                sku: box.userData.sku || '',
                excluded: !!box.userData.excluded,
                stackable: box.userData.stackable !== false,
                tiltable: box.userData.tiltable !== false,
                rotatable: box.userData.rotatable !== false,
                orientationIndex: box.userData.orientationIndex || 0,
                baseDims: box.userData.baseDims || {
                    width: Number(box.userData.width) || 0,
                    height: Number(box.userData.height) || 0,
                    depth: Number(box.userData.depth) || 0
                },
                position: {
                    x: roundMetric(box.position.x, 2),
                    y: roundMetric(box.position.y, 2),
                    z: roundMetric(box.position.z, 2)
                },
                rotation: {
                    x: roundMetric(box.rotation.x, 4),
                    y: roundMetric(box.rotation.y, 4),
                    z: roundMetric(box.rotation.z, 4)
                }
            }));

            const stepPlan = (lastStepPlan || []).map((step, index) => ({
                id: index + 1,
                name: step.name || `Buoc ${index + 1}`,
                destination: step.destination || '',
                group: step.group || step.destination || 'General',
                priority: Number(step.priority) || 3,
                sku: step.sku || '',
                weight: Number(step.weight) || 0,
                width: Number(step.width) || 0,
                height: Number(step.height) || 0,
                depth: Number(step.depth) || 0,
                position: step.position ? {
                    x: roundMetric(step.position.x, 2),
                    y: roundMetric(step.position.y, 2),
                    z: roundMetric(step.position.z, 2)
                } : null
            }));

            return {
                version: VERSION,
                source: 'live-snapshot',
                exportedAt: new Date().toISOString(),
                shipment: {
                    ...metrics.state,
                    routeStops: [...metrics.routeStops]
                },
                container: {
                    code: containerCode,
                    type: currentContainer.name,
                    name: currentContainer.name,
                    width: Number(currentContainer.w) || 0,
                    height: Number(currentContainer.h) || 0,
                    depth: Number(currentContainer.d) || 0,
                    maxLoad: Number(currentContainer.maxLoad) || 0,
                    tare: Number(currentContainer.tare) || 0,
                    allowOverhangPercent: Number(currentContainer.allowOverhangPercent) || 0,
                    axlePositions: [...(currentContainer.axlePositions || [])],
                    axleLimits: [...(currentContainer.axleLimits || [])],
                    color: currentContainer.color || 0x3b82f6,
                    category: currentContainer.category || inferCargoSpaceCategory(containerCode, currentContainer),
                    custom: String(containerCode).startsWith(CUSTOM_CARGO_SPACE_PREFIX)
                },
                rules,
                activeRules: getActiveRuleLabels(rules),
                manualLoad: { ...manualLoadSettings },
                metrics: {
                    stage: metrics.stage,
                    plannedQty: Number(metrics.plannedQty) || 0,
                    plannedVolume: roundMetric(metrics.plannedVolume, 3),
                    plannedWeight: roundMetric(metrics.plannedWeight, 2),
                    routeStops: [...metrics.routeStops],
                    routeStopCount: Number(metrics.routeStopCount) || 0,
                    destinationStops: [...metrics.destinationStops],
                    groups: [...metrics.groups],
                    avgDensity: roundMetric(metrics.avgDensity, 2),
                    nearDoorPercent: roundMetric(metrics.nearDoorPercent, 2),
                    balanceScore: roundMetric(metrics.balanceScore, 3),
                    doorScore: roundMetric(metrics.doorScore, 3),
                    placed: {
                        boxCount: Number(metrics.placedMetrics.boxCount) || 0,
                        totalVolumeM3: roundMetric(metrics.placedMetrics.totalVolumeM3, 3),
                        totalWeight: roundMetric(metrics.placedMetrics.totalWeight, 2),
                        volumePercent: roundMetric(metrics.placedMetrics.volumePercent, 2),
                        weightPercent: roundMetric(metrics.placedMetrics.weightPercent, 2)
                    },
                    axleHealth: {
                        maxRatio: roundMetric(metrics.axleHealth.maxRatio, 3),
                        safe: !!metrics.axleHealth.safe,
                        label: metrics.axleHealth.label || 'Unknown'
                    },
                    axleData: {
                        loads: (axleData.loads || []).map(load => roundMetric(load, 2)),
                        limits: [...(axleData.limits || [])]
                    }
                },
                queueGroups,
                plannedEntries,
                boxes: placedBoxes,
                stepPlan
            };
        }

        function renderWorkflowStrip(metrics = collectPlanningInsights()) {
            const strip = document.getElementById('workflowStrip');
            if (!strip) return;
            strip.innerHTML = WORKFLOW_STEPS.map((step, idx) => {
                const classes = ['workflow-chip'];
                if (idx < metrics.stage) classes.push('done');
                if (idx === metrics.stage) classes.push('active');
                return `
                    <div class="${classes.join(' ')}">
                        <span class="workflow-chip-step">${String(idx + 1).padStart(2, '0')} ${step.label}</span>
                        <span class="workflow-chip-title">${step.title}</span>
                    </div>
                `;
            }).join('');
        }

        function renderCargoTemplateLibrary() {
            const library = document.getElementById('cargoTemplateLibrary');
            if (!library) return;
            library.innerHTML = CARGO_TEMPLATE_LIBRARY.map(template => `
                <div class="cargo-template-card" data-template-id="${template.id}">
                    <div class="cargo-template-name">${template.name}</div>
                    <div class="cargo-template-meta">${template.width}x${template.height}x${template.depth} cm · ${template.weight} kg · SL ${template.quantity}</div>
                    <div class="cargo-template-meta">${template.destination} · Group ${template.group}</div>
                    <div class="cargo-template-tags">
                        ${(template.tags || []).slice(0, 2).map(tag => `<span class="cargo-template-tag">${tag}</span>`).join('')}
                    </div>
                </div>
            `).join('');
            library.querySelectorAll('.cargo-template-card').forEach(card => {
                card.addEventListener('click', () => {
                    const template = CARGO_TEMPLATE_LIBRARY.find(item => item.id === card.dataset.templateId);
                    populateCargoTemplateForm(template);
                    showNotification(`Da nap template ${template?.name || ''} vao form`, 'info', 1200);
                });
            });
        }

        function loadQuickScenario(index = 0) {
            const scenario = QUICK_SCENARIOS[index % QUICK_SCENARIOS.length];
            if (!scenario) return;

            applyShipmentStateToInputs(scenario.shipment);
            clearSceneBoxes();
            boxTypes = scenario.cargoIds
                .map(id => CARGO_TEMPLATE_LIBRARY.find(template => template.id === id))
                .filter(Boolean)
                .map(template => buildTemplateDraft(template));
            lastStepPlan = [];
            updateBoxTypeList();
            updateStats();
            refreshProfessionalPanels();
            showNotification(`Da nap kich ban ${scenario.shipment.name}`, 'success', 1800);
        }

        function renderCargoQueueBoard(metrics = collectPlanningInsights()) {
            const board = document.getElementById('cargoQueueBoard');
            const caption = document.getElementById('cargoQueueCaption');
            if (!board) return;

            if (!metrics.entries.length) {
                board.innerHTML = '<div class="report-empty">Chua co cargo nao trong queue</div>';
                if (caption) caption.textContent = '0 nhom';
                return;
            }

            const orderedGroups = getQueueGroups(metrics);
            if (caption) caption.textContent = `${orderedGroups.length} nhom`;
            board.innerHTML = orderedGroups.map((group, index) => `
                <div class="queue-group" draggable="true" data-key="${escapeHTML(group.queueKey)}" data-index="${index}">
                    <div class="queue-group-head">
                        <div class="queue-group-title">
                            <strong>${escapeHTML(group.destination)}</strong>
                            <span>${escapeHTML(group.group)} · Uu tien ${group.priority}</span>
                        </div>
                        <div class="queue-group-actions">
                            <span class="queue-pill">P${group.priority}</span>
                            <span class="queue-drag-hint" title="Keo tha de doi uu tien">Drag</span>
                            <button class="queue-action-btn" data-action="up" data-key="${escapeHTML(group.queueKey)}" title="Đẩy nhóm sâu hơn">↑</button>
                            <button class="queue-action-btn" data-action="down" data-key="${escapeHTML(group.queueKey)}" title="Đưa nhóm gần cửa hơn">↓</button>
                            <button class="queue-action-btn wide" data-action="load-form" data-key="${escapeHTML(group.queueKey)}" title="Nạp vào form">Form</button>
                        </div>
                    </div>
                    <div class="queue-group-summary">${group.totalQty} pcs · ${group.totalWeight.toLocaleString()} kg · ${group.totalVolume.toFixed(2)} m3</div>
                    <div class="queue-item-list">
                        ${group.items.slice(0, 4).map(item => `
                            <div class="queue-item">
                                <strong>${escapeHTML(item.name)}</strong>
                                <span>${item.width}x${item.height}x${item.depth} cm · ${item.quantity} pcs</span>
                                <span>${item.totalVolume.toFixed(2)} m3 · ${escapeHTML(item.sku || 'No SKU')}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `).join('');

            board.querySelectorAll('.queue-action-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const key = btn.dataset.key;
                    const action = btn.dataset.action;
                    if (action === 'up') moveQueueGroup(key, -1);
                    if (action === 'down') moveQueueGroup(key, 1);
                    if (action === 'load-form') loadQueueGroupIntoForm(key);
                });
            });

            setupQueueDragAndDrop(board);
        }

        function getQueueGroups(metrics = collectPlanningInsights()) {
            const grouped = new Map();
            metrics.entries.forEach(entry => {
                const destination = entry.destination || 'Kho chinh';
                const group = entry.group || 'General';
                const key = getEntryQueueKey(entry);
                if (!grouped.has(key)) {
                    grouped.set(key, {
                        queueKey: key,
                        destination,
                        group,
                        priority: Number(entry.priority) || 3,
                        totalQty: 0,
                        totalWeight: 0,
                        totalVolume: 0,
                        items: []
                    });
                }
                const bucket = grouped.get(key);
                bucket.totalQty += entry.quantity;
                bucket.totalWeight += entry.totalWeight;
                bucket.totalVolume += entry.totalVolume;
                bucket.items.push(entry);
            });

            return [...grouped.values()].sort((a, b) => a.priority - b.priority || a.destination.localeCompare(b.destination));
        }

        function updateQueuePriorities(queueOrder = []) {
            if (!queueOrder.length) return;
            const queueMap = new Map(queueOrder.map((group, index) => [group.queueKey, index + 1]));

            if (boxTypes.length > 0) {
                boxTypes = boxTypes.map(item => {
                    const nextPriority = queueMap.get(getEntryQueueKey(item));
                    return nextPriority ? { ...item, priority: nextPriority } : item;
                });
                updateBoxTypeList();
                return;
            }

            boxes.forEach(box => {
                const nextPriority = queueMap.get(getEntryQueueKey(box.userData));
                if (nextPriority) box.userData.priority = nextPriority;
            });
            updateStats();
        }

        function reorderQueueGroups(draggedKey, targetKey, placeAfter = false) {
            if (!draggedKey || !targetKey || draggedKey === targetKey) return;
            const groups = getQueueGroups();
            const fromIndex = groups.findIndex(group => group.queueKey === draggedKey);
            const targetIndex = groups.findIndex(group => group.queueKey === targetKey);
            if (fromIndex === -1 || targetIndex === -1) return;

            const reordered = [...groups];
            const [moved] = reordered.splice(fromIndex, 1);
            const remainingTargetIndex = reordered.findIndex(group => group.queueKey === targetKey);
            const insertIndex = remainingTargetIndex + (placeAfter ? 1 : 0);
            reordered.splice(Math.max(0, insertIndex), 0, moved);
            updateQueuePriorities(reordered);
            showNotification(`Da cap nhat thu tu group ${moved.group}`, 'success', 1000);
        }

        function setupQueueDragAndDrop(board) {
            const cards = [...board.querySelectorAll('.queue-group')];
            if (!cards.length) return;

            const clearDropState = () => {
                cards.forEach(card => {
                    card.classList.remove('dragging', 'drop-target', 'drop-after');
                    delete card.dataset.dropAfter;
                });
            };

            cards.forEach(card => {
                card.addEventListener('dragstart', event => {
                    queueDragState.activeKey = card.dataset.key;
                    card.classList.add('dragging');
                    if (event.dataTransfer) {
                        event.dataTransfer.effectAllowed = 'move';
                        event.dataTransfer.setData('text/plain', card.dataset.key || '');
                    }
                });

                card.addEventListener('dragover', event => {
                    const draggedKey = queueDragState.activeKey || event.dataTransfer?.getData('text/plain');
                    if (!draggedKey || draggedKey === card.dataset.key) return;
                    event.preventDefault();
                    const rect = card.getBoundingClientRect();
                    const placeAfter = (event.clientY - rect.top) > rect.height / 2;
                    cards.forEach(node => {
                        if (node !== card) node.classList.remove('drop-target', 'drop-after');
                    });
                    card.classList.add('drop-target');
                    card.classList.toggle('drop-after', placeAfter);
                    card.dataset.dropAfter = placeAfter ? 'true' : 'false';
                });

                card.addEventListener('dragleave', event => {
                    if (card.contains(event.relatedTarget)) return;
                    card.classList.remove('drop-target', 'drop-after');
                    delete card.dataset.dropAfter;
                });

                card.addEventListener('drop', event => {
                    event.preventDefault();
                    const draggedKey = queueDragState.activeKey || event.dataTransfer?.getData('text/plain');
                    const targetKey = card.dataset.key;
                    const placeAfter = card.dataset.dropAfter === 'true';
                    clearDropState();
                    queueDragState.activeKey = null;
                    reorderQueueGroups(draggedKey, targetKey, placeAfter);
                });

                card.addEventListener('dragend', () => {
                    queueDragState.activeKey = null;
                    clearDropState();
                });
            });
        }

        function moveQueueGroup(queueKey, direction = 1) {
            const groups = getQueueGroups();
            const index = groups.findIndex(group => group.queueKey === queueKey);
            if (index === -1) return;
            const nextIndex = Math.min(Math.max(index + direction, 0), groups.length - 1);
            if (nextIndex === index) return;
            const reordered = [...groups];
            const [moved] = reordered.splice(index, 1);
            reordered.splice(nextIndex, 0, moved);
            updateQueuePriorities(reordered);
            showNotification(`Da cap nhat thu tu group ${moved.group}`, 'success', 1000);
        }

        function loadQueueGroupIntoForm(queueKey) {
            const group = getQueueGroups().find(item => item.queueKey === queueKey);
            const sample = group?.items?.[0];
            if (!sample) return;
            populateCargoTemplateForm({
                name: sample.name,
                width: sample.width,
                height: sample.height,
                depth: sample.depth,
                weight: sample.weight,
                quantity: sample.quantity,
                destination: sample.destination,
                group: sample.group,
                priority: sample.priority,
                category: sample.category,
                sku: sample.sku
            });
            showNotification(`Da nap group ${sample.group || sample.destination} vao form`, 'info', 1000);
        }

        function renderSceneSequencePanel(metrics = collectPlanningInsights()) {
            const panel = document.getElementById('sceneSequencePanel');
            const caption = document.getElementById('sceneSequenceCaption');
            if (!panel) return;

            if (!lastStepPlan || lastStepPlan.length === 0) {
                panel.innerHTML = '<div class="report-empty">Chua co step plan. Chay AI Pro hoac Smart Pack de tao sequence.</div>';
                if (caption) caption.textContent = 'Chua co buoc';
                return;
            }

            if (caption) caption.textContent = `${lastStepPlan.length} buoc · Stage ${metrics.stage + 1}`;
            panel.innerHTML = lastStepPlan.map((step, idx) => `
                <div class="scene-step-card ${idx === stepPlaybackState.index ? 'highlight' : ''}" data-step-index="${idx}">
                    <div class="scene-step-no">${idx + 1}</div>
                    <div class="scene-step-body">
                        <strong>${step.name || `Buoc ${idx + 1}`}</strong>
                        <span>${step.destination ? `Diem do: ${step.destination} · ` : ''}${(step.weight || 0).toLocaleString()} kg</span>
                        <span>Pos: ${step.position ? `${step.position.x.toFixed(0)}, ${step.position.y.toFixed(0)}, ${step.position.z.toFixed(0)}` : 'pending'}${step.width ? ` · ${step.width}x${step.height}x${step.depth}` : ''}</span>
                    </div>
                </div>
            `).join('');
            panel.querySelectorAll('.scene-step-card').forEach(card => {
                card.addEventListener('click', () => jumpToStep(parseInt(card.dataset.stepIndex, 10)));
            });
        }

        function updateShipmentDashboard(metrics = collectPlanningInsights()) {
            const objectiveLabels = {
                balanced: 'Can tai va do thuan',
                volume: 'Toi da the tich',
                weight: 'Uu tien tai trong',
                door: 'Gan cua / do nhanh'
            };
            const stageLabels = ['Setup', 'Grouped', 'Draft', 'Check', 'Ready'];

            const bannerTitle = document.getElementById('shipmentBannerTitle');
            const bannerSubtitle = document.getElementById('shipmentBannerSubtitle');
            const stopCount = document.getElementById('shipmentStopCount');
            const queueCount = document.getElementById('shipmentQueueCount');
            const priorityMix = document.getElementById('shipmentPriorityMix');
            const density = document.getElementById('shipmentDensity');
            const cockpitSubtitle = document.getElementById('cockpitSubtitle');
            const cockpitStatus = document.getElementById('cockpitStatus');
            const cockpitVolumeUsed = document.getElementById('cockpitVolumeUsed');
            const cockpitVolumeTrend = document.getElementById('cockpitVolumeTrend');
            const cockpitWeightUsed = document.getElementById('cockpitWeightUsed');
            const cockpitWeightTrend = document.getElementById('cockpitWeightTrend');
            const cockpitStops = document.getElementById('cockpitStops');
            const cockpitDoorPriority = document.getElementById('cockpitDoorPriority');
            const cockpitBalance = document.getElementById('cockpitBalance');
            const cockpitAxleState = document.getElementById('cockpitAxleState');
            const cockpitBalanceFill = document.getElementById('cockpitBalanceFill');
            const cockpitBalanceText = document.getElementById('cockpitBalanceText');
            const cockpitDoorFill = document.getElementById('cockpitDoorFill');
            const cockpitDoorText = document.getElementById('cockpitDoorText');

            if (bannerTitle) bannerTitle.textContent = metrics.state.name || 'Ke hoach load';
            if (bannerSubtitle) bannerSubtitle.textContent = `${objectiveLabels[metrics.state.objective] || 'Dieu do'} · ${metrics.state.route || 'Chua khai bao route'}`;
            if (stopCount) stopCount.textContent = String(metrics.routeStopCount || 0);
            if (queueCount) queueCount.textContent = String(metrics.groups.length || 0);
            if (priorityMix) priorityMix.textContent = `${metrics.nearDoorPercent.toFixed(0)}%`;
            if (density) density.textContent = metrics.avgDensity ? metrics.avgDensity.toFixed(0) : '0';

            if (cockpitSubtitle) cockpitSubtitle.textContent = `${currentContainer.name} · ${metrics.routeStopCount || 0} stop`;
            if (cockpitStatus) cockpitStatus.textContent = stageLabels[metrics.stage] || 'Draft';
            if (cockpitVolumeUsed) cockpitVolumeUsed.textContent = `${metrics.placedMetrics.totalVolumeM3.toFixed(2)} m3`;
            if (cockpitVolumeTrend) cockpitVolumeTrend.textContent = `${metrics.placedMetrics.volumePercent.toFixed(1)}% su dung`;
            if (cockpitWeightUsed) cockpitWeightUsed.textContent = `${metrics.placedMetrics.totalWeight.toLocaleString()} kg`;
            if (cockpitWeightTrend) cockpitWeightTrend.textContent = `${metrics.placedMetrics.weightPercent.toFixed(1)}% tai trong`;
            if (cockpitStops) cockpitStops.textContent = `${metrics.routeStopCount || 0} stop`;
            if (cockpitDoorPriority) cockpitDoorPriority.textContent = `${metrics.nearDoorPercent.toFixed(0)}% gan cua`;
            if (cockpitBalance) cockpitBalance.textContent = `${(metrics.balanceScore * 100).toFixed(0)}% can bang`;
            if (cockpitAxleState) cockpitAxleState.textContent = `Axle ${metrics.axleHealth.label}`;
            if (cockpitBalanceFill) cockpitBalanceFill.style.width = `${(metrics.balanceScore * 100).toFixed(1)}%`;
            if (cockpitBalanceText) cockpitBalanceText.textContent = `${(metrics.balanceScore * 100).toFixed(0)}%`;
            if (cockpitDoorFill) cockpitDoorFill.style.width = `${metrics.doorScore.toFixed(1)}%`;
            if (cockpitDoorText) cockpitDoorText.textContent = `${metrics.doorScore.toFixed(0)}%`;
        }

        function refreshProfessionalPanels() {
            const metrics = collectPlanningInsights();
            renderWorkflowStrip(metrics);
            renderCargoQueueBoard(metrics);
            renderSceneSequencePanel(metrics);
            updateShipmentDashboard(metrics);
            updateRuleStatusPanel();
            renderEasyCargoSurface(metrics);
            return metrics;
        }

        function getEasyGroupBuckets() {
            const groups = getQueueGroups();
            if (!groups.length) return [];
            return groups.map((group, index) => ({
                key: group.queueKey,
                label: String(index + 1),
                title: group.group || group.destination || `Nhóm ${index + 1}`,
                priority: group.priority,
                totalQty: group.totalQty,
                itemCount: (group.items || []).length
            }));
        }

        function getEasyActiveGroupKey() {
            const buckets = getEasyGroupBuckets();
            if (!buckets.length) return 'all';
            if (easyActiveGroupKey === 'all') return buckets[0].key;
            return buckets.some(bucket => bucket.key === easyActiveGroupKey) ? easyActiveGroupKey : buckets[0].key;
        }

        function updateEasyHeaderTabs() {
            const activeMode = easyWorkspaceMode === 'planner' ? 'cargo' : easyWorkspaceMode;
            const tabMap = {
                reports: document.getElementById('easyTabReports'),
                cargo: document.getElementById('easyTabCargo'),
                vehicles: document.getElementById('easyTabVehicles')
            };

            Object.entries(tabMap).forEach(([mode, tab]) => {
                if (!tab) return;
                tab.classList.toggle('active', !easyLegacyMode && mode === activeMode);
            });
        }

        function setEasyWorkspace(mode = 'planner') {
            easyWorkspaceMode = mode;
            easyLegacyMode = false;
            if (mode !== 'planner') cancelManualPlacement();
            const app = document.querySelector('.container-app');
            if (app) {
                app.classList.remove('workspace-cargo', 'workspace-reports', 'workspace-vehicles', 'easy-legacy-mode');
                if (mode !== 'planner') app.classList.add(`workspace-${mode}`);
            }
            updateEasyHeaderTabs();
            renderEasyWorkspacePages();
        }

        function setEasyLegacyMode(enabled) {
            easyLegacyMode = !!enabled;
            if (easyLegacyMode) cancelManualPlacement();
            const app = document.querySelector('.container-app');
            if (app) {
                app.classList.toggle('easy-legacy-mode', easyLegacyMode);
                if (easyLegacyMode) {
                    app.classList.remove('workspace-cargo', 'workspace-reports', 'workspace-vehicles');
                }
            }
            if (easyLegacyMode) {
                easyWorkspaceMode = 'planner';
                document.getElementById('sidebar')?.classList.remove('collapsed');
            }
            updateEasyHeaderTabs();
            if (!easyLegacyMode) {
                renderEasyCargoSurface();
            }
            showNotification(
                easyLegacyMode ? 'Da bat Studio mode voi panel nang cao va cockpit cu.' : 'Da quay lai giao dien EasyCargo-style.',
                easyLegacyMode ? 'info' : 'success',
                1600
            );
        }

        function renderEasyGroupTabs() {
            const container = document.getElementById('easyGroupTabs');
            if (!container) return;
            const buckets = getEasyGroupBuckets();
            if (!buckets.length) {
                container.innerHTML = '<button class="easy-group-tab active" type="button">1</button>';
                const label = document.getElementById('easyActiveGroupLabel');
                if (label) label.textContent = 'Nhóm 1';
                return;
            }

            easyActiveGroupKey = getEasyActiveGroupKey();
            container.innerHTML = buckets.map(bucket => `
                <button class="easy-group-tab ${bucket.key === easyActiveGroupKey ? 'active' : ''}" data-easy-group="${escapeHTML(bucket.key)}" type="button">${bucket.label}</button>
            `).join('');

            const active = buckets.find(bucket => bucket.key === easyActiveGroupKey) || buckets[0];
            const label = document.getElementById('easyActiveGroupLabel');
            if (label) label.textContent = `${active.title}`;

            container.querySelectorAll('[data-easy-group]').forEach(button => {
                button.addEventListener('click', () => {
                    easyActiveGroupKey = button.dataset.easyGroup || 'all';
                    renderEasyGroupTabs();
                    renderEasyLoadList();
                });
            });
        }

        function getEasyLaneSummary(activeGroup) {
            if (!activeGroup) return [];
            const totalQty = Math.max(Number(activeGroup.totalQty) || 0, 0);
            const ratios = [0.46, 0.34, 0.2];
            const targets = ratios.map((ratio, index) => {
                if (index === ratios.length - 1) return 0;
                return Math.round(totalQty * ratio);
            });
            const consumed = targets.reduce((sum, value) => sum + value, 0);
            targets[targets.length - 1] = Math.max(totalQty - consumed, 0);

            const placed = [0, 0, 0];
            boxes.forEach(box => {
                if (getEntryQueueKey(box.userData) !== activeGroup.queueKey) return;
                const z = box.position.z;
                const laneIndex = z < -currentContainer.d / 6 ? 0 : z < currentContainer.d / 6 ? 1 : 2;
                placed[laneIndex] += 1;
            });

            return [
                { key: 'A', caption: 'Sau', colorClass: 'lane-a' },
                { key: 'B', caption: 'Giua', colorClass: 'lane-b' },
                { key: 'C', caption: 'Cua', colorClass: 'lane-c' }
            ].map((lane, index) => {
                const target = targets[index] || 0;
                const count = placed[index] || 0;
                const ratio = target > 0 ? count / target : 0;
                const state = target === 0 ? 'bad' : count === 0 ? 'warn' : ratio >= 0.9 ? 'ok' : 'warn';
                return {
                    ...lane,
                    count,
                    target,
                    state
                };
            });
        }

        function focusEasyLane(laneKey) {
            const zMap = {
                A: -currentContainer.d * 0.28,
                B: 0,
                C: currentContainer.d * 0.28
            };
            setView('side');
            if (!camera || !orbitControls) return;
            const targetZ = zMap[laneKey] ?? 0;
            orbitControls.target.set(0, currentContainer.h * 0.35, targetZ);
            camera.position.set(currentContainer.w * 1.2, currentContainer.h * 0.85, targetZ + currentContainer.d * 0.18);
            orbitControls.update();
        }

        function renderEasyGroupSummary(metrics = collectPlanningInsights()) {
            const container = document.getElementById('easyGroupSummary');
            if (!container) return;

            const groups = getQueueGroups(metrics);
            const activeGroup = groups.find(group => group.queueKey === getEasyActiveGroupKey()) || groups[0];
            if (!activeGroup) {
                container.innerHTML = '';
                return;
            }

            const lanes = getEasyLaneSummary(activeGroup);
            container.innerHTML = lanes.map(lane => `
                <div class="easy-lane-row">
                    <span class="easy-lane-badge ${lane.colorClass}">${lane.key}</span>
                    <span class="easy-lane-count">${lane.count}/${lane.target || 0} <small>${lane.caption}</small></span>
                    <span class="easy-lane-pill ${lane.state}"></span>
                    <button class="easy-lane-action" data-easy-focus-lane="${lane.key}" type="button">→</button>
                </div>
            `).join('');

            container.querySelectorAll('[data-easy-focus-lane]').forEach(button => {
                button.addEventListener('click', () => focusEasyLane(button.dataset.easyFocusLane));
            });
        }

        function adjustBoxTypeQuantity(index, delta) {
            const item = boxTypes[index];
            if (!item) return;
            item.quantity = Math.max(1, (Number(item.quantity) || 1) + delta);
            updateBoxTypeList();
            refreshProfessionalPanels();
        }

        function createEasyDefaultItem() {
            const activeBucket = getEasyGroupBuckets().find(bucket => bucket.key === getEasyActiveGroupKey());
            const nextPriority = activeBucket?.priority || Math.max(1, ...boxTypes.map(item => Number(item.priority) || 1), 1);
            boxTypes.push(buildTemplateDraft({
                name: `Mặt hàng ${String.fromCharCode(65 + (boxTypes.length % 26))}`,
                width: 60,
                height: 50,
                depth: 40,
                weight: 10,
                quantity: 1,
                destination: shipmentState.route?.split('->')?.slice(-1)?.[0]?.trim() || 'Kho chính',
                group: activeBucket?.title || `Nhóm ${nextPriority}`,
                priority: nextPriority,
                sku: `ITEM-${boxTypes.length + 1}`
            }));
            updateBoxTypeList();
            easyActiveGroupKey = getEasyActiveGroupKey();
            openEasyItemModal(boxTypes.length - 1);
        }

        function renderEasyLoadList() {
            const container = document.getElementById('easyLoadList');
            if (!container) return;

            const activeKey = getEasyActiveGroupKey();
            const groups = getQueueGroups();
            const activeGroup = groups.find(group => group.queueKey === activeKey) || groups[0];
            if (!activeGroup) {
                container.innerHTML = `
                    <div class="easy-load-empty">
                        Chưa có mặt hàng trong kế hoạch.
                        <div style="margin-top:10px;"><button class="easy-mini-action" id="easyLoadSample" type="button">Nạp bộ mẫu</button></div>
                    </div>
                `;
                const sampleBtn = document.getElementById('easyLoadSample');
                if (sampleBtn) sampleBtn.onclick = () => loadQuickScenario(0);
                return;
            }

            const activeItems = boxTypes
                .map((item, index) => ({ item, index }))
                .filter(({ item }) => getEntryQueueKey(item) === activeGroup.queueKey);

            container.innerHTML = activeItems.map(({ item, index }) => `
                <div class="easy-load-card ${item.excluded ? 'excluded' : ''}">
                    <button class="easy-load-check" data-easy-toggle="${index}" type="button">${item.excluded ? '×' : '✓'}</button>
                    <div class="easy-load-body">
                        <div class="easy-load-head">
                            <div>
                                <div class="easy-load-name">${escapeHTML(item.name || `Item ${index + 1}`)}</div>
                                <div class="easy-load-code">${escapeHTML(item.sku || `ITEM-${index + 1}`)}</div>
                            </div>
                            <button class="easy-mini-action" data-easy-edit="${index}" type="button">✎</button>
                        </div>
                        <div class="easy-load-meta">
                            <span>${Number(item.depth) || 0} × ${Number(item.width) || 0} × ${Number(item.height) || 0} cm</span>
                            <span>${Number(item.weight) || 0} kg</span>
                            <span>${escapeHTML(item.destination || 'Kho chính')}</span>
                        </div>
                        <div class="easy-load-dims">
                            <span class="easy-dim-pill">D: ${Number(item.depth) || 0}</span>
                            <span class="easy-dim-pill">R: ${Number(item.width) || 0}</span>
                            <span class="easy-dim-pill">C: ${Number(item.height) || 0}</span>
                        </div>
                        <div class="easy-load-controls">
                            <div class="easy-qty-box">
                                <button data-easy-qty-minus="${index}" type="button">−</button>
                                <span>${Number(item.quantity) || 1}</span>
                                <button data-easy-qty-plus="${index}" type="button">+</button>
                            </div>
                            <button class="easy-mini-action" data-easy-place="${index}" type="button">Đặt tay</button>
                            <button class="easy-mini-action" data-easy-delete="${index}" type="button">Xóa</button>
                        </div>
                    </div>
                    <div class="easy-load-side">
                        <span class="easy-letter-tag">${escapeHTML((item.group || 'A').slice(0, 1).toUpperCase())}</span>
                        <span class="easy-status-dot"></span>
                    </div>
                </div>
            `).join('');

            container.querySelectorAll('[data-easy-toggle]').forEach(button => {
                button.addEventListener('click', () => {
                    const index = Number(button.dataset.easyToggle);
                    if (!Number.isInteger(index)) return;
                    boxTypes[index].excluded = !boxTypes[index].excluded;
                    updateBoxTypeList();
                });
            });
            container.querySelectorAll('[data-easy-edit]').forEach(button => {
                button.addEventListener('click', () => openEasyItemModal(Number(button.dataset.easyEdit)));
            });
            container.querySelectorAll('[data-easy-place]').forEach(button => {
                button.addEventListener('click', () => beginManualPlacement(Number(button.dataset.easyPlace)));
            });
            container.querySelectorAll('[data-easy-delete]').forEach(button => {
                button.addEventListener('click', () => {
                    const index = Number(button.dataset.easyDelete);
                    boxTypes.splice(index, 1);
                    updateBoxTypeList();
                });
            });
            container.querySelectorAll('[data-easy-qty-minus]').forEach(button => {
                button.addEventListener('click', () => adjustBoxTypeQuantity(Number(button.dataset.easyQtyMinus), -1));
            });
            container.querySelectorAll('[data-easy-qty-plus]').forEach(button => {
                button.addEventListener('click', () => adjustBoxTypeQuantity(Number(button.dataset.easyQtyPlus), 1));
            });
        }

        function renderEasyStageHud(metrics = collectPlanningInsights()) {
            const title = document.getElementById('easyStageTitle');
            const maxLoad = document.getElementById('easyMetricMaxLoad');
            const usedWeight = document.getElementById('easyMetricUsedWeight');
            const volume = document.getElementById('easyMetricVolume');
            const usedVolume = document.getElementById('easyMetricUsedVolume');
            const freeDepth = document.getElementById('easyMetricFreeDepth');
            const door = document.getElementById('easyMetricDoor');

            if (title) {
                title.textContent = `${currentContainer.name} (${currentContainer.d.toFixed(1)} x ${currentContainer.w.toFixed(1)} x ${currentContainer.h.toFixed(1)} cm)`;
            }
            if (maxLoad) maxLoad.textContent = `${(Number(currentContainer.maxLoad) || 0).toLocaleString()} kg`;
            if (usedWeight) usedWeight.textContent = `${metrics.placedMetrics.totalWeight.toLocaleString()} kg`;
            if (volume) volume.textContent = `${((currentContainer.w * currentContainer.h * currentContainer.d) / 1000000).toFixed(2)} m³`;
            if (usedVolume) usedVolume.textContent = `${metrics.placedMetrics.totalVolumeM3.toFixed(2)} m³`;
            if (freeDepth) {
                const freeDepthMeters = Math.max((currentContainer.d - boxes.reduce((maxZ, box) => Math.max(maxZ, box.position.z + box.userData.depth / 2), -currentContainer.d / 2)) / 100, 0);
                freeDepth.textContent = `${freeDepthMeters.toFixed(2)} m`;
            }
            if (door) door.textContent = `${metrics.doorScore.toFixed(0)}% gần cửa`;
        }

        function renderEasyVehicleBrowser() {
            const container = document.getElementById('easyVehicleBrowser');
            if (!container) return;
            const spaces = getFilteredCargoSpaces(getActiveCargoSpaceKey());
            container.innerHTML = spaces.map(space => `
                <div class="easy-vehicle-card ${space.code === getActiveCargoSpaceKey() ? 'active' : ''}" data-easy-vehicle="${escapeHTML(space.code)}">
                    <div class="easy-vehicle-thumb"></div>
                    <div class="easy-vehicle-name">${escapeHTML(space.name)}</div>
                    <div class="easy-vehicle-meta">${space.d.toFixed(1)} x ${space.w.toFixed(1)} x ${space.h.toFixed(1)} cm</div>
                    <div class="easy-vehicle-meta">${(Number(space.maxLoad) || 0).toLocaleString()} kg${favoriteCargoSpaces.includes(space.code) ? ' · ★' : ''}</div>
                </div>
            `).join('');

            container.querySelectorAll('[data-easy-vehicle]').forEach(card => {
                card.addEventListener('click', () => applyCargoSpaceToState(card.dataset.easyVehicle));
            });
        }

        function renderEasyVehicleCatalogTable() {
            const tbody = document.getElementById('easyVehicleCatalogTable');
            if (!tbody) return;
            const spaces = getCargoSpaceCatalog();
            tbody.innerHTML = spaces.map(space => `
                <tr class="${space.code === getActiveCargoSpaceKey() ? 'selected' : ''}" data-easy-catalog-row="${escapeHTML(space.code)}">
                    <td>${escapeHTML(space.name)}</td>
                    <td>${escapeHTML(space.category || 'container')}</td>
                    <td>${space.d.toFixed(1)}</td>
                    <td>${space.w.toFixed(1)}</td>
                    <td>${space.h.toFixed(1)}</td>
                    <td>${(Number(space.maxLoad) || 0).toLocaleString()} kg</td>
                    <td>${String(space.code).startsWith(CUSTOM_CARGO_SPACE_PREFIX) ? 'Custom' : 'System'}</td>
                </tr>
            `).join('');
            tbody.querySelectorAll('[data-easy-catalog-row]').forEach(row => {
                row.addEventListener('click', () => {
                    applyCargoSpaceToState(row.dataset.easyCatalogRow);
                    closeEasyVehicleCatalog();
                });
            });
        }

        function openEasyVehicleCatalog() {
            renderEasyVehicleCatalogTable();
            document.getElementById('easyVehicleCatalogModal')?.classList.add('show');
        }

        function closeEasyVehicleCatalog() {
            document.getElementById('easyVehicleCatalogModal')?.classList.remove('show');
        }

        function fillEasyItemModal(index = -1) {
            const item = index >= 0 ? boxTypes[index] : buildTemplateDraft({
                name: 'Mặt hàng mới',
                width: 60,
                height: 50,
                depth: 40,
                weight: 10,
                quantity: 1,
                destination: '',
                group: `Nhóm ${(getEasyGroupBuckets().findIndex(bucket => bucket.key === getEasyActiveGroupKey()) + 1) || 1}`,
                priority: getEasyGroupBuckets().find(bucket => bucket.key === getEasyActiveGroupKey())?.priority || 1,
                sku: `ITEM-${boxTypes.length + 1}`
            });

            document.getElementById('easyItemModalTitle').textContent = index >= 0 ? 'Chỉnh mặt hàng' : 'Thêm mặt hàng';
            document.getElementById('easyItemName').value = item.name || '';
            document.getElementById('easyItemDepth').value = Number(item.depth) || 0;
            document.getElementById('easyItemWidth').value = Number(item.width) || 0;
            document.getElementById('easyItemHeight').value = Number(item.height) || 0;
            document.getElementById('easyItemWeight').value = Number(item.weight) || 0;
            document.getElementById('easyItemQty').value = Number(item.quantity) || 1;
            document.getElementById('easyItemPriority').value = Number(item.priority) || 1;
            document.getElementById('easyItemGroup').value = item.group || '';
            document.getElementById('easyItemDestination').value = item.destination || '';
            document.getElementById('easyItemSku').value = item.sku || '';
            document.getElementById('easyItemStackable').checked = item.stackable !== false;
            document.getElementById('easyItemRotatable').checked = item.rotatable !== false;
            document.getElementById('easyItemFragile').checked = !!item.fragile;
            document.getElementById('easyItemExcluded').checked = !!item.excluded;
        }

        function openEasyItemModal(index = -1) {
            easyItemModalIndex = index;
            fillEasyItemModal(index);
            document.getElementById('easyItemModal')?.classList.add('show');
        }

        function closeEasyItemModal() {
            document.getElementById('easyItemModal')?.classList.remove('show');
            easyItemModalIndex = -1;
        }

        function saveEasyItemModal() {
            const nextItem = {
                name: document.getElementById('easyItemName').value.trim() || `Mặt hàng ${boxTypes.length + 1}`,
                depth: Number(document.getElementById('easyItemDepth').value) || 40,
                width: Number(document.getElementById('easyItemWidth').value) || 60,
                height: Number(document.getElementById('easyItemHeight').value) || 50,
                weight: Number(document.getElementById('easyItemWeight').value) || 10,
                quantity: Math.max(1, Number(document.getElementById('easyItemQty').value) || 1),
                priority: Math.max(1, Number(document.getElementById('easyItemPriority').value) || 1),
                group: document.getElementById('easyItemGroup').value.trim() || 'General',
                destination: document.getElementById('easyItemDestination').value.trim(),
                sku: document.getElementById('easyItemSku').value.trim(),
                stackable: document.getElementById('easyItemStackable').checked,
                rotatable: document.getElementById('easyItemRotatable').checked,
                fragile: document.getElementById('easyItemFragile').checked,
                excluded: document.getElementById('easyItemExcluded').checked,
                tiltable: true,
                hazardous: false,
                category: document.getElementById('easyItemFragile').checked ? 'fragile' : 'normal'
            };

            if (easyItemModalIndex >= 0 && boxTypes[easyItemModalIndex]) {
                boxTypes[easyItemModalIndex] = { ...boxTypes[easyItemModalIndex], ...nextItem };
            } else {
                boxTypes.push(nextItem);
            }
            updateBoxTypeList();
            closeEasyItemModal();
        }

        function deleteEasyItemModalEntry() {
            if (easyItemModalIndex < 0) return;
            boxTypes.splice(easyItemModalIndex, 1);
            updateBoxTypeList();
            closeEasyItemModal();
        }

        function placeEasyModalItem() {
            if (easyItemModalIndex < 0) saveEasyItemModal();
            const targetIndex = easyItemModalIndex >= 0 ? easyItemModalIndex : boxTypes.length - 1;
            closeEasyItemModal();
            beginManualPlacement(targetIndex);
        }

        function updateEasyHint(metrics = collectPlanningInsights()) {
            const hint = document.getElementById('easyHintBubble');
            const copy = document.getElementById('easyHintCopy');
            if (!hint || !copy) return;
            if (easyHintDismissed) {
                hint.classList.add('hidden');
                return;
            }
            hint.classList.remove('hidden');
            if (!boxTypes.length) {
                copy.textContent = 'Bắt đầu bằng cách tạo nhóm hàng và thêm một mặt hàng vào kế hoạch, sau đó chọn loại phương tiện ở panel bên phải.';
                return;
            }
            if (!boxes.length) {
                copy.textContent = 'Nhấn "Chất hàng" để xếp tự động, hoặc mở mặt hàng và dùng "Đặt tay" để kéo sát workflow manual loading như giao diện mẫu.';
                return;
            }
            copy.textContent = metrics.balanceScore < 0.75
                ? 'Bạn có thể nhấp vào kiện hàng để chỉnh tay vị trí, đổi mặt hoặc dùng magnet snap để bám sàn giống EasyCargo.'
                : 'Kéo chuột trái để xoay, chuột phải để pan và con lăn để zoom. Bạn cũng có thể đổi góc nhìn ở dải nút bên phải.';
        }

        function renderEasyCargoDeskWorkspace(metrics = collectPlanningInsights()) {
            const summary = document.getElementById('easyCargoDeskSummary');
            const table = document.getElementById('easyCargoDeskTable');
            if (!summary || !table) return;

            const readyCount = boxTypes.filter(item => !item.excluded).length;
            const totalQty = boxTypes.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
            summary.innerHTML = `
                <div class="easy-kpi-card">
                    <span>Mat hang</span>
                    <strong>${boxTypes.length}</strong>
                    <small>${readyCount} dong dang san sang</small>
                </div>
                <div class="easy-kpi-card">
                    <span>So luong</span>
                    <strong>${totalQty}</strong>
                    <small>${metrics.groups.length} priority groups</small>
                </div>
                <div class="easy-kpi-card">
                    <span>Khoi luong</span>
                    <strong>${metrics.placedMetrics.totalWeight.toLocaleString()} kg</strong>
                    <small>${metrics.placedMetrics.weightPercent.toFixed(1)}% tai trong da dung</small>
                </div>
                <div class="easy-kpi-card">
                    <span>Manual load</span>
                    <strong>${manualLoadSettings.snapMagnet ? 'Magnet ON' : 'Magnet OFF'}</strong>
                    <small>Grid ${manualLoadSettings.grid} cm · Rotate ${manualLoadSettings.autoRotate ? 'auto' : 'fixed'}</small>
                </div>
            `;

            if (!boxTypes.length) {
                table.innerHTML = '<tr><td colspan="9">Chua co mat hang nao. Them mat hang moi de bat dau ke hoach.</td></tr>';
                return;
            }

            table.innerHTML = boxTypes.map((item, index) => {
                const statusClass = item.excluded ? 'bad' : (Number(item.quantity) || 0) > 0 ? 'ok' : 'warn';
                const statusText = item.excluded ? 'Exclude' : 'San sang';
                return `
                    <tr>
                        <td>${escapeHTML(item.name || `Item ${index + 1}`)}</td>
                        <td>${escapeHTML(item.group || 'General')}</td>
                        <td>${escapeHTML(item.destination || 'Kho chinh')}</td>
                        <td>${Number(item.depth) || 0} x ${Number(item.width) || 0} x ${Number(item.height) || 0} cm</td>
                        <td>${Number(item.weight) || 0} kg</td>
                        <td>${Number(item.quantity) || 1}</td>
                        <td>P${Number(item.priority) || 1}</td>
                        <td><span class="easy-table-status ${statusClass}">${statusText}</span></td>
                        <td>
                            <button class="easy-table-action" data-easy-cargo-edit="${index}" type="button">Sua</button>
                            <button class="easy-table-action" data-easy-cargo-place="${index}" type="button">Dat tay</button>
                            <button class="easy-table-action" data-easy-cargo-toggle="${index}" type="button">${item.excluded ? 'Include' : 'Exclude'}</button>
                        </td>
                    </tr>
                `;
            }).join('');

            table.querySelectorAll('[data-easy-cargo-edit]').forEach(button => {
                button.addEventListener('click', () => openEasyItemModal(Number(button.dataset.easyCargoEdit)));
            });
            table.querySelectorAll('[data-easy-cargo-place]').forEach(button => {
                button.addEventListener('click', () => {
                    setEasyWorkspace('planner');
                    beginManualPlacement(Number(button.dataset.easyCargoPlace));
                });
            });
            table.querySelectorAll('[data-easy-cargo-toggle]').forEach(button => {
                button.addEventListener('click', () => {
                    const index = Number(button.dataset.easyCargoToggle);
                    if (!boxTypes[index]) return;
                    boxTypes[index].excluded = !boxTypes[index].excluded;
                    updateBoxTypeList();
                });
            });
        }

        function renderEasyReportsWorkspace(metrics = collectPlanningInsights()) {
            const summary = document.getElementById('easyReportSummary');
            const groupTable = document.getElementById('easyReportGroupTable');
            const stepPanel = document.getElementById('easyReportSteps');
            if (!summary || !groupTable || !stepPanel) return;
            const planningUnitsExist = getActiveBoxTypes().length > 0 || boxes.length > 0;
            if (planningUnitsExist) buildAdditionalCargoSpacePlan();
            else {
                lastMultiCargoSpacePlan = [];
                lastMultiCargoSpaceRemaining = 0;
            }

            summary.innerHTML = `
                <div class="easy-kpi-card">
                    <span>Shipment</span>
                    <strong>${escapeHTML(metrics.state.name || 'Chua dat ten')}</strong>
                    <small>${escapeHTML(metrics.state.route || 'Chua khai bao route')}</small>
                </div>
                <div class="easy-kpi-card">
                    <span>Volume</span>
                    <strong>${metrics.placedMetrics.volumePercent.toFixed(1)}%</strong>
                    <small>${metrics.placedMetrics.totalVolumeM3.toFixed(2)} m3 da dung</small>
                </div>
                <div class="easy-kpi-card">
                    <span>Weight</span>
                    <strong>${metrics.placedMetrics.totalWeight.toLocaleString()} kg</strong>
                    <small>${metrics.placedMetrics.weightPercent.toFixed(1)}% tai trong</small>
                </div>
                <div class="easy-kpi-card">
                    <span>Balance</span>
                    <strong>${(metrics.balanceScore * 100).toFixed(0)}%</strong>
                    <small>Door ${metrics.doorScore.toFixed(0)}% · Axle ${metrics.axleHealth.label}</small>
                </div>
            `;

            const groups = getQueueGroups(metrics);
            if (!groups.length) {
                groupTable.innerHTML = '<tr><td colspan="5">Chua co group nao trong shipment.</td></tr>';
            } else {
                groupTable.innerHTML = groups.map(group => `
                    <tr>
                        <td>${escapeHTML(group.group || 'General')}</td>
                        <td>${escapeHTML(group.destination || 'Kho chinh')}</td>
                        <td>${group.totalQty}</td>
                        <td>${Math.round(group.totalWeight).toLocaleString()} kg</td>
                        <td>P${group.priority}</td>
                    </tr>
                `).join('');
            }

            if (!lastStepPlan || !lastStepPlan.length) {
                stepPanel.innerHTML = '<div class="easy-report-step"><strong>Chua co sequence</strong><span>Hay chay Smart Pack hoac AI Pro de tao step-by-step report.</span></div>';
                return;
            }

            stepPanel.innerHTML = lastStepPlan.map((step, index) => `
                <div class="easy-report-step" data-easy-step-jump="${index}">
                    <strong>Buoc ${index + 1}: ${escapeHTML(step.name || `Step ${index + 1}`)}</strong>
                    <span>${step.destination ? `Diem do ${escapeHTML(step.destination)} · ` : ''}${Math.round(step.weight || 0).toLocaleString()} kg</span>
                    <span>${step.position ? `Vi tri ${step.position.x.toFixed(0)}, ${step.position.y.toFixed(0)}, ${step.position.z.toFixed(0)}` : 'Vi tri cho xac dinh'}</span>
                </div>
            `).join('');

            stepPanel.querySelectorAll('[data-easy-step-jump]').forEach(node => {
                node.addEventListener('click', () => {
                    setEasyWorkspace('planner');
                    jumpToStep(Number(node.dataset.easyStepJump));
                });
            });

            renderEasyAxleSummary();
            renderEasyMultiSpacePlan();
        }

        function renderEasyAxleSummary() {
            const container = document.getElementById('easyAxleSummary');
            if (!container) return;
            const axle = computeAxleLoads();
            if (!axle.labels?.length) {
                container.innerHTML = '<div class="easy-report-empty">Chua co du lieu tai truc cho cargo space hien tai.</div>';
                return;
            }

            container.innerHTML = axle.labels.map((label, idx) => {
                const current = axle.loads[idx] || 0;
                const max = axle.maxLoads?.[idx] ?? axle.limits?.[idx] ?? 0;
                const min = axle.minLoads?.[idx] ?? 0;
                const ratio = max ? current / max : 0;
                const statusClass = ratio > 1.001 ? 'bad' : ratio > 0.8 ? 'warn' : 'ok';
                const statusLabel = ratio > 1.001 ? 'Overload' : ratio > 0.8 ? 'Tight' : 'Safe';
                const percent = Math.max(0, Math.min(ratio * 100, 140));
                return `
                    <div class="easy-axle-card">
                        <div class="easy-axle-card-head">
                            <strong>${label}</strong>
                            <span class="easy-axle-status ${statusClass}">${statusLabel}</span>
                        </div>
                        <div class="easy-axle-bar">
                            <div class="easy-axle-progress">
                                <div class="easy-axle-fill" style="width:${percent}%; background:${ratio > 1.001 ? '#ef4444' : ratio > 0.8 ? '#f59e0b' : '#22c55e'}"></div>
                            </div>
                        </div>
                        <div class="easy-axle-values">
                            <div><span>Min</span><strong>${Math.round(min).toLocaleString()} kg</strong></div>
                            <div><span>Current</span><strong>${Math.round(current).toLocaleString()} kg</strong></div>
                            <div><span>Max</span><strong>${Math.round(max).toLocaleString()} kg</strong></div>
                        </div>
                    </div>
                `;
            }).join('');
        }

        function renderEasyMultiSpacePlan() {
            const container = document.getElementById('easyMultiSpacePlan');
            if (!container) return;
            if (!lastMultiCargoSpacePlan.length) {
                container.innerHTML = '<div class="easy-report-empty">Chua tao ke hoach nhieu khoang. Bam "Nap sang nhieu khoang" de phan bo cac kien hang qua nhieu cargo spaces cung loai.</div>';
                return;
            }

            container.innerHTML = lastMultiCargoSpacePlan.map(space => {
                const statusClass = space.utilizationWeight > 100 || space.utilizationVolume > 100 ? 'bad' : (space.utilizationWeight > 85 || space.utilizationVolume > 85 ? 'warn' : 'ok');
                const statusLabel = statusClass === 'bad' ? 'Overloaded' : statusClass === 'warn' ? 'Dense' : 'Ready';
                const groups = [...new Set(space.placed.map(item => item.group || item.destination || 'General'))].slice(0, 4);
                const sampleItems = space.placed.slice(0, 3).map(item => item.name).join(', ');
                return `
                    <div class="easy-space-card">
                        <div class="easy-space-card-head">
                            <strong>${escapeHTML(space.containerName || currentContainer.name)} · Space ${space.index}</strong>
                            <span class="easy-space-status ${statusClass}">${statusLabel}</span>
                        </div>
                        <div class="easy-space-metrics">
                            <div class="easy-space-metric"><span>Kien hang</span><strong>${space.placed.length}</strong></div>
                            <div class="easy-space-metric"><span>Weight</span><strong>${Math.round(space.usedWeight).toLocaleString()} kg</strong></div>
                            <div class="easy-space-metric"><span>Volume</span><strong>${space.usedVolume.toFixed(2)} m3</strong></div>
                        </div>
                        <div class="easy-space-groups">Groups: ${escapeHTML(groups.join(' · ') || 'General')}</div>
                        <div class="easy-space-items">Items: ${escapeHTML(sampleItems || 'Khong co du lieu')}</div>
                        <div class="easy-space-actions">
                            <button class="easy-space-btn primary" data-easy-space-preview="${space.index}" type="button">Xem tren stage</button>
                            <button class="easy-space-btn" data-easy-space-report="${space.index}" type="button">Chon khoang nay</button>
                        </div>
                    </div>
                `;
            }).join('');

            container.querySelectorAll('[data-easy-space-preview]').forEach(button => {
                button.addEventListener('click', () => loadAdditionalCargoSpaceToStage(Number(button.dataset.easySpacePreview)));
            });

            container.querySelectorAll('[data-easy-space-report]').forEach(button => {
                button.addEventListener('click', () => {
                    loadAdditionalCargoSpaceToStage(Number(button.dataset.easySpaceReport));
                    showNotification(`Da nap cargo space ${button.dataset.easySpaceReport} vao ban xep 3D`, 'info', 1200);
                });
            });

            if (lastMultiCargoSpaceRemaining > 0) {
                container.insertAdjacentHTML('beforeend', `<div class="easy-report-empty">Con ${lastMultiCargoSpaceRemaining} kien hang chua phan bo duoc vao ${lastMultiCargoSpacePlan.length} cargo spaces hien tai.</div>`);
            }
        }

        function renderEasyVehiclesWorkspace() {
            const table = document.getElementById('easyVehicleWorkspaceTable');
            if (!table) return;

            const spaces = getCargoSpaceCatalog().filter(space => !easyVehicleWorkspaceFavoritesOnly || favoriteCargoSpaces.includes(space.code));
            if (!spaces.length) {
                table.innerHTML = '<tr><td colspan="8">Khong co cargo space nao phu hop voi bo loc hien tai.</td></tr>';
                return;
            }

            table.innerHTML = spaces.map(space => `
                <tr data-easy-workspace-vehicle="${escapeHTML(space.code)}" class="${space.code === getActiveCargoSpaceKey() ? 'selected' : ''}">
                    <td>${escapeHTML(space.name)}</td>
                    <td>${escapeHTML(space.category || 'container')}</td>
                    <td>${space.d.toFixed(1)}</td>
                    <td>${space.w.toFixed(1)}</td>
                    <td>${space.h.toFixed(1)}</td>
                    <td>${(Number(space.maxLoad) || 0).toLocaleString()} kg</td>
                    <td>${String(space.code).startsWith(CUSTOM_CARGO_SPACE_PREFIX) ? 'Nguoi dung' : 'CargoFlow System'}</td>
                    <td>${favoriteCargoSpaces.includes(space.code) ? 'Yeu thich' : 'San sang'}</td>
                </tr>
            `).join('');

            table.querySelectorAll('[data-easy-workspace-vehicle]').forEach(row => {
                row.addEventListener('click', () => {
                    applyCargoSpaceToState(row.dataset.easyWorkspaceVehicle);
                    setEasyWorkspace('planner');
                });
            });
        }

        function renderEasyWorkspacePages(metrics = collectPlanningInsights()) {
            renderEasyCargoDeskWorkspace(metrics);
            renderEasyReportsWorkspace(metrics);
            renderEasyVehiclesWorkspace();
            updateEasyHeaderTabs();
        }

        function renderEasyCargoSurface(metrics = collectPlanningInsights()) {
            const shipmentInput = document.getElementById('easyShipmentTitle');
            const shipment = captureShipmentState();
            if (shipmentInput && shipmentInput.value !== (shipment.name || '')) {
                shipmentInput.value = shipment.name || '';
            }
            renderEasyGroupTabs();
            renderEasyGroupSummary(metrics);
            renderEasyLoadList();
            renderEasyVehicleBrowser();
            renderEasyStageHud(metrics);
            updateEasyHint(metrics);
            renderEasyWorkspacePages(metrics);
        }

        function getOrientationCandidates(boxType, options = {}) {
            const { allowRotate = manualLoadSettings.autoRotate } = options;
            const rawBaseDims = boxType.baseDims || {
                width: Number(boxType.width) || 0,
                height: Number(boxType.height) || 0,
                depth: Number(boxType.depth) || 0
            };
            const baseDims = {
                width: Number(rawBaseDims.width) || 0,
                height: Number(rawBaseDims.height) || 0,
                depth: Number(rawBaseDims.depth) || 0
            };
            const locked = boxType.fixedOrientation || boxType.rotatable === false || !allowRotate;
            const preferredIndex = typeof boxType.orientationIndex === 'number' ? boxType.orientationIndex : 0;
            const indices = locked
                ? [preferredIndex]
                : [...new Set([preferredIndex, ...Array.from({ length: ORIENTATION_MAPPINGS.length }, (_, idx) => idx)])];

            return indices.map(index => {
                const dims = getOrientationDims(baseDims, index);
                return {
                    boxType: {
                        ...boxType,
                        baseDims: { ...baseDims },
                        orientationIndex: index,
                        width: dims.width,
                        height: dims.height,
                        depth: dims.depth
                    },
                    dims
                };
            });
        }

        function clampPlacementPosition(position, dims) {
            const next = position.clone();
            const allowOverhang = Number(currentContainer.allowOverhangPercent) || 0;
            const overhangW = currentContainer.w * allowOverhang / 100;
            const overhangD = currentContainer.d * allowOverhang / 100;
            const halfW = currentContainer.w / 2;
            const halfD = currentContainer.d / 2;
            const minX = -halfW - overhangW + dims.width / 2;
            const maxX = halfW + overhangW - dims.width / 2;
            const minZ = -halfD - overhangD + dims.depth / 2;
            const maxZ = halfD + overhangD - dims.depth / 2;
            const minY = dims.height / 2;
            const maxY = currentContainer.h + allowOverhang - dims.height / 2;

            next.x = Math.max(minX, Math.min(maxX, next.x));
            next.y = Math.max(minY, Math.min(maxY, next.y));
            next.z = Math.max(minZ, Math.min(maxZ, next.z));
            return next;
        }

        function placementHasCollision(position, dims, ignoreBox = null) {
            const allowOverhang = Number(currentContainer.allowOverhangPercent) || 0;
            const overhangW = currentContainer.w * allowOverhang / 100;
            const overhangD = currentContainer.d * allowOverhang / 100;
            const halfW = currentContainer.w / 2;
            const halfD = currentContainer.d / 2;

            const minX = position.x - dims.width / 2;
            const maxX = position.x + dims.width / 2;
            const minY = position.y - dims.height / 2;
            const maxY = position.y + dims.height / 2;
            const minZ = position.z - dims.depth / 2;
            const maxZ = position.z + dims.depth / 2;

            if (
                minX < -halfW - overhangW ||
                maxX > halfW + overhangW ||
                minZ < -halfD - overhangD ||
                maxZ > halfD + overhangD ||
                minY < 0 ||
                maxY > currentContainer.h + allowOverhang
            ) {
                return true;
            }

            return boxes.some(other => {
                if (other === ignoreBox) return false;
                const otherPos = other.position;
                const otherDims = other.userData;
                return (
                    Math.abs(position.x - otherPos.x) < (dims.width + otherDims.width) / 2 - 0.05 &&
                    Math.abs(position.y - otherPos.y) < (dims.height + otherDims.height) / 2 - 0.05 &&
                    Math.abs(position.z - otherPos.z) < (dims.depth + otherDims.depth) / 2 - 0.05
                );
            });
        }

        function snapAxisValue(value, candidates = [], threshold = 10) {
            let snapped = value;
            let bestDistance = threshold;
            candidates.forEach(candidate => {
                const distance = Math.abs(value - candidate);
                if (distance <= bestDistance) {
                    bestDistance = distance;
                    snapped = candidate;
                }
            });
            return snapped;
        }

        function getSnappedPlacement(position, dims, ignoreBox = null) {
            let next = clampPlacementPosition(position, dims);
            if (!manualLoadSettings.snapMagnet) return next;

            const grid = Number(manualLoadSettings.grid) || 10;
            const threshold = Math.max(6, grid * 1.4);

            next.x = Math.round(next.x / grid) * grid;
            next.z = Math.round(next.z / grid) * grid;
            next.y = Math.round((next.y - dims.height / 2) / grid) * grid + dims.height / 2;

            const xCandidates = [
                -currentContainer.w / 2 + dims.width / 2,
                currentContainer.w / 2 - dims.width / 2
            ];
            const zCandidates = [
                -currentContainer.d / 2 + dims.depth / 2,
                currentContainer.d / 2 - dims.depth / 2
            ];
            const yCandidates = [dims.height / 2];

            boxes.forEach(other => {
                if (other === ignoreBox) return;
                const otherDims = other.userData;
                const overlapX = Math.abs(next.x - other.position.x) <= (dims.width + otherDims.width) / 2 + threshold;
                const overlapY = Math.abs(next.y - other.position.y) <= (dims.height + otherDims.height) / 2 + threshold;
                const overlapZ = Math.abs(next.z - other.position.z) <= (dims.depth + otherDims.depth) / 2 + threshold;

                if (overlapY && overlapZ) {
                    xCandidates.push(
                        other.position.x - (otherDims.width + dims.width) / 2,
                        other.position.x + (otherDims.width + dims.width) / 2
                    );
                }
                if (overlapX && overlapY) {
                    zCandidates.push(
                        other.position.z - (otherDims.depth + dims.depth) / 2,
                        other.position.z + (otherDims.depth + dims.depth) / 2
                    );
                }
                if (overlapX && overlapZ) {
                    yCandidates.push(other.position.y + (otherDims.height + dims.height) / 2);
                }
            });

            next.x = snapAxisValue(next.x, xCandidates, threshold);
            next.y = snapAxisValue(next.y, yCandidates, threshold);
            next.z = snapAxisValue(next.z, zCandidates, threshold);

            return clampPlacementPosition(next, dims);
        }

        function clearSceneBoxes(options = {}) {
            const { saveHistory = false } = options;
            clearStepPlaybackTimer();
            const existing = [...boxes];
            existing.forEach(box => {
                scene.remove(box);
                if (box.geometry) box.geometry.dispose();
                if (box.material) {
                    if (box.material.map) box.material.map.dispose();
                    box.material.dispose();
                }
                box.children.forEach(child => {
                    if (child.isCSS2DObject) {
                        if (child.element) child.element.remove();
                        child.remove();
                    }
                });
            });
            boxes = [];
            selectedBox = null;
            const infoPanel = document.getElementById('infoPanel');
            if (infoPanel) infoPanel.style.display = 'none';
            updateStats();
            updateCOG();
            if (saveHistory) saveToHistory();
        }

        function buildHistorySnapshotFromLayoutBoxes(layoutBoxes = []) {
            return layoutBoxes.map((box, index) => {
                const width = Number(box.width ?? box.w) || 0;
                const height = Number(box.height ?? box.h) || 0;
                const depth = Number(box.depth ?? box.d) || 0;
                return {
                    userData: {
                        ...box,
                        width,
                        height,
                        depth,
                        id: index + 1,
                        baseDims: box.baseDims || {
                            width: Number(box.baseDims?.width) || width,
                            height: Number(box.baseDims?.height) || height,
                            depth: Number(box.baseDims?.depth) || depth
                        }
                    },
                    position: new THREE.Vector3(
                        (Number(box.x) || 0) - currentContainer.w / 2 + width / 2,
                        (Number(box.y) || 0) + height / 2,
                        (Number(box.z) || 0) - currentContainer.d / 2 + depth / 2
                    ),
                    rotation: new THREE.Euler(0, 0, 0)
                };
            });
        }

        function buildHistorySnapshotFromStepPlan(stepPlan = []) {
            return buildHistorySnapshotFromLayoutBoxes(stepPlan.map(step => ({
                ...step,
                x: step.position?.x,
                y: step.position?.y,
                z: step.position?.z
            })));
        }

        function createManualPlacementPreviewObjects() {
            if (!scene) return;
            if (!manualPlacementGuide) {
                manualPlacementGuide = new THREE.Mesh(
                    new THREE.PlaneGeometry(10, 10),
                    new THREE.MeshBasicMaterial({
                        color: 0x22c55e,
                        transparent: true,
                        opacity: 0.22,
                        side: THREE.DoubleSide,
                        depthWrite: false
                    })
                );
                manualPlacementGuide.rotation.x = -Math.PI / 2;
                manualPlacementGuide.visible = false;
                scene.add(manualPlacementGuide);
            }

            if (!manualPlacementGhost) {
                manualPlacementGhost = new THREE.Mesh(
                    new THREE.BoxGeometry(10, 10, 10),
                    new THREE.MeshBasicMaterial({
                        color: 0x22c55e,
                        transparent: true,
                        opacity: 0.28,
                        wireframe: false,
                        depthWrite: false
                    })
                );
                manualPlacementGhost.visible = false;
                scene.add(manualPlacementGhost);
            }
        }

        function clearManualPlacementPreview() {
            if (manualPlacementGuide) manualPlacementGuide.visible = false;
            if (manualPlacementGhost) manualPlacementGhost.visible = false;
        }

        function getActiveManualPlacementBoxType() {
            if (!manualPlacementSession) return null;
            const source = boxTypes[manualPlacementSession.typeIndex];
            if (!source) return null;
            return {
                ...source,
                orientationIndex: manualPlacementSession.orientationIndex
            };
        }

        function beginManualPlacement(typeIndex) {
            const boxType = boxTypes[typeIndex];
            if (!boxType) return;
            if (boxType.excluded) {
                showNotification('Item nay dang bi exclude khoi shipment', 'warning', 1400);
                return;
            }
            manualPlacementSession = {
                typeIndex,
                orientationIndex: typeof boxType.orientationIndex === 'number' ? boxType.orientationIndex : 0,
                orientationLocked: false,
                resolved: null
            };
            createManualPlacementPreviewObjects();
            clearManualPlacementPreview();
            renderer?.domElement?.classList.add('manual-placement-mode');
            showNotification('Che do dat tay: di chuot de xem vi tri, click de dat, R hoac chuot phai de xoay, Esc de thoat.', 'info', 2800);
        }

        function cancelManualPlacement(showMessage = false) {
            manualPlacementSession = null;
            clearManualPlacementPreview();
            renderer?.domElement?.classList.remove('manual-placement-mode');
            if (showMessage) showNotification('Da thoat che do dat tay', 'info', 1200);
        }

        function updateManualPlacementPreviewVisual(resolved, fallbackPosition = null) {
            createManualPlacementPreviewObjects();
            if (!manualPlacementGuide || !manualPlacementGhost) return;
            if (!resolved && !fallbackPosition) {
                clearManualPlacementPreview();
                return;
            }

            const activeType = getActiveManualPlacementBoxType();
            const dims = resolved?.dims || getOrientationCandidates(activeType || {}, { allowRotate: false })[0]?.dims;
            if (!dims) {
                clearManualPlacementPreview();
                return;
            }

            if (manualPlacementGuide.geometry) manualPlacementGuide.geometry.dispose();
            manualPlacementGuide.geometry = new THREE.PlaneGeometry(Math.max(dims.width, 12), Math.max(dims.depth, 12));
            manualPlacementGuide.position.set(
                resolved?.position?.x || fallbackPosition?.x || 0,
                1.2,
                resolved?.position?.z || fallbackPosition?.z || 0
            );
            manualPlacementGuide.material.color.set(resolved && !resolved.collision ? 0x22c55e : 0xef4444);
            manualPlacementGuide.material.opacity = resolved && !resolved.collision ? 0.24 : 0.18;
            manualPlacementGuide.visible = true;

            if (manualPlacementGhost.geometry) manualPlacementGhost.geometry.dispose();
            manualPlacementGhost.geometry = new THREE.BoxGeometry(dims.width, dims.height, dims.depth);
            manualPlacementGhost.position.copy(resolved?.position || fallbackPosition || new THREE.Vector3(0, dims.height / 2, 0));
            manualPlacementGhost.material.color.set(resolved && !resolved.collision ? 0x22c55e : 0xef4444);
            manualPlacementGhost.material.opacity = resolved && !resolved.collision ? 0.22 : 0.18;
            manualPlacementGhost.visible = true;
        }

        function updateManualPlacementPreviewFromPointer(event) {
            if (!manualPlacementSession) return null;
            const boxType = getActiveManualPlacementBoxType();
            if (!boxType) {
                cancelManualPlacement();
                return null;
            }
            const desiredPosition = getDropPositionFromPointer(event, boxType);
            if (!desiredPosition) {
                clearManualPlacementPreview();
                manualPlacementSession.resolved = null;
                return null;
            }

            const resolved = resolveManualPlacement(boxType, desiredPosition, {
                allowRotate: manualPlacementSession.orientationLocked ? false : manualLoadSettings.autoRotate
            });
            manualPlacementSession.resolved = resolved;
            if (resolved?.boxType?.orientationIndex !== undefined && !manualPlacementSession.orientationLocked) {
                manualPlacementSession.orientationIndex = resolved.boxType.orientationIndex;
            }
            updateManualPlacementPreviewVisual(resolved, desiredPosition);
            return resolved;
        }

        function rotateManualPlacementPreview(direction = 1) {
            if (!manualPlacementSession) return;
            const boxType = boxTypes[manualPlacementSession.typeIndex];
            if (!boxType || boxType.rotatable === false) {
                showNotification('Mat hang nay khong cho xoay', 'warning', 1200);
                return;
            }
            const total = ORIENTATION_MAPPINGS.length;
            const next = (((manualPlacementSession.orientationIndex || 0) + direction) % total + total) % total;
            manualPlacementSession.orientationIndex = next;
            manualPlacementSession.orientationLocked = true;
            if (manualPlacementSession.resolved) {
                const resolved = resolveManualPlacement(
                    { ...boxType, orientationIndex: next },
                    manualPlacementSession.resolved.position,
                    { allowRotate: false }
                );
                manualPlacementSession.resolved = resolved;
                updateManualPlacementPreviewVisual(resolved, manualPlacementSession.resolved?.position);
            }
        }

        function commitManualPlacementFromPreview(event) {
            if (!manualPlacementSession) return false;
            const resolved = updateManualPlacementPreviewFromPointer(event) || manualPlacementSession.resolved;
            if (!resolved || resolved.collision) {
                showNotification('Vi tri nay chua hop le de dat tay', 'warning', 1200);
                return true;
            }

            const created = createBox(resolved.boxType, resolved.position);
            if (created) {
                highlightBox(created, true);
                selectedBox = created;
                updateSelectedInfo(created);
                showNotification(`Da dat tay ${resolved.boxType.name || 'mat hang'}. Co the click tiep de dat them.`, 'success', 1400);
            }
            return true;
        }

        function expandItemsForCargoSpacePlan() {
            const plannedBoxTypes = getActiveBoxTypes();
            const sourceList = plannedBoxTypes.length > 0 ? plannedBoxTypes : boxes.map(box => ({ ...box.userData, quantity: 1 }));
            return sourceList.flatMap((item, index) => {
                const quantity = Math.max(1, Number(item.quantity) || 1);
                return Array.from({ length: quantity }, (_, unitIndex) => ({
                    sourceIndex: index,
                    sourceName: item.name || `Item ${index + 1}`,
                    unitIndex,
                    name: item.name || `Item ${index + 1}`,
                    width: Number(item.width) || 0,
                    height: Number(item.height) || 0,
                    depth: Number(item.depth) || 0,
                    weight: Number(item.weight) || 0,
                    priority: Number(item.priority) || 3,
                    destination: item.destination || '',
                    group: item.group || '',
                    sku: item.sku || '',
                    fragile: !!item.fragile,
                    hazardous: !!item.hazardous,
                    stackable: item.stackable !== false,
                    tiltable: item.tiltable !== false,
                    rotatable: item.rotatable !== false,
                    category: item.category || 'normal'
                }));
            }).sort((a, b) => {
                const priorityDiff = (Number(a.priority) || 3) - (Number(b.priority) || 3);
                if (priorityDiff !== 0) return priorityDiff;
                const volA = (a.width || 0) * (a.height || 0) * (a.depth || 0);
                const volB = (b.width || 0) * (b.height || 0) * (b.depth || 0);
                return volB - volA || (b.weight || 0) - (a.weight || 0);
            });
        }

        function simulateCargoSpaceLoad(units = [], cargoSpace = currentContainer) {
            const state = { x: 0, y: 0, z: 0, rowDepth: 0, layerHeight: 0 };
            const placed = [];
            const remaining = [];
            let usedWeight = 0;
            let usedVolume = 0;
            const width = Number(cargoSpace.w) || 0;
            const depth = Number(cargoSpace.d) || 0;
            const height = Number(cargoSpace.h) || 0;
            const maxLoad = Number(cargoSpace.maxLoad) || Number.MAX_SAFE_INTEGER;

            const tryPlace = (cursor, dims) => {
                const fits = (nextX, nextY, nextZ) =>
                    nextX + dims.width <= width + 0.001 &&
                    nextZ + dims.depth <= depth + 0.001 &&
                    nextY + dims.height <= height + 0.001;

                const placeAt = (baseX, baseY, baseZ, current) => ({
                    position: {
                        x: baseX + dims.width / 2 - width / 2,
                        y: baseY + dims.height / 2,
                        z: baseZ + dims.depth / 2 - depth / 2
                    },
                    state: {
                        x: baseX + dims.width,
                        y: baseY,
                        z: baseZ,
                        rowDepth: Math.max(current.rowDepth, dims.depth),
                        layerHeight: Math.max(current.layerHeight, dims.height)
                    }
                });

                if (fits(cursor.x, cursor.y, cursor.z)) {
                    return placeAt(cursor.x, cursor.y, cursor.z, cursor);
                }

                if (cursor.rowDepth > 0 && fits(0, cursor.y, cursor.z + cursor.rowDepth)) {
                    const nextRow = { ...cursor, x: 0, z: cursor.z + cursor.rowDepth, rowDepth: 0 };
                    return placeAt(0, nextRow.y, nextRow.z, nextRow);
                }

                if (cursor.layerHeight > 0 && fits(0, cursor.y + cursor.layerHeight, 0)) {
                    const nextLayer = { x: 0, y: cursor.y + cursor.layerHeight, z: 0, rowDepth: 0, layerHeight: 0 };
                    return placeAt(0, nextLayer.y, 0, nextLayer);
                }

                return null;
            };

            units.forEach(unit => {
                const orientations = getOrientationCandidates(unit, { allowRotate: unit.rotatable !== false });
                let bestPlacement = null;

                for (const option of orientations) {
                    if (usedWeight + (unit.weight || 0) > maxLoad + 0.001) break;
                    const placement = tryPlace(state, option.dims);
                    if (placement) {
                        bestPlacement = { option, placement };
                        break;
                    }
                }

                if (!bestPlacement) {
                    remaining.push(unit);
                    return;
                }

                state.x = bestPlacement.placement.state.x;
                state.y = bestPlacement.placement.state.y;
                state.z = bestPlacement.placement.state.z;
                state.rowDepth = bestPlacement.placement.state.rowDepth;
                state.layerHeight = bestPlacement.placement.state.layerHeight;

                const placedUnit = {
                    ...unit,
                    width: bestPlacement.option.dims.width,
                    height: bestPlacement.option.dims.height,
                    depth: bestPlacement.option.dims.depth,
                    orientationIndex: bestPlacement.option.boxType.orientationIndex,
                    position: bestPlacement.placement.position,
                    boxType: {
                        ...unit,
                        width: bestPlacement.option.dims.width,
                        height: bestPlacement.option.dims.height,
                        depth: bestPlacement.option.dims.depth,
                        orientationIndex: bestPlacement.option.boxType.orientationIndex,
                        baseDims: bestPlacement.option.boxType.baseDims || {
                            width: unit.width,
                            height: unit.height,
                            depth: unit.depth
                        }
                    }
                };

                usedWeight += unit.weight || 0;
                usedVolume += ((placedUnit.width || 0) * (placedUnit.height || 0) * (placedUnit.depth || 0)) / 1000000;
                placed.push(placedUnit);
            });

            return { placed, remaining, usedWeight, usedVolume };
        }

        function buildAdditionalCargoSpacePlan(maxSpaces = 10) {
            const units = expandItemsForCargoSpacePlan();
            if (!units.length) {
                lastMultiCargoSpacePlan = [];
                lastMultiCargoSpaceRemaining = 0;
                return { spaces: [], remaining: [] };
            }

            let remaining = [...units];
            const spaces = [];
            const limit = Math.min(Math.max(1, maxSpaces), 10);

            for (let index = 0; index < limit && remaining.length > 0; index += 1) {
                const allocation = simulateCargoSpaceLoad(remaining, currentContainer);
                if (!allocation.placed.length) break;
                spaces.push({
                    index: index + 1,
                    code: `${currentContainer.code || 'space'}-${index + 1}`,
                    containerName: currentContainer.name,
                    placed: allocation.placed,
                    usedWeight: allocation.usedWeight,
                    usedVolume: allocation.usedVolume,
                    utilizationWeight: currentContainer.maxLoad ? (allocation.usedWeight / currentContainer.maxLoad) * 100 : 0,
                    utilizationVolume: currentContainer.w && currentContainer.h && currentContainer.d
                        ? (allocation.usedVolume / ((currentContainer.w * currentContainer.h * currentContainer.d) / 1000000)) * 100
                        : 0
                });
                remaining = allocation.remaining;
            }

            lastMultiCargoSpacePlan = spaces.map(space => ({ ...space }));
            lastMultiCargoSpaceRemaining = remaining.length;
            return { spaces, remaining };
        }

        function loadAdditionalCargoSpaceToStage(spaceIndex) {
            const target = lastMultiCargoSpacePlan.find(space => space.index === spaceIndex);
            if (!target) return;
            cancelManualPlacement();
            clearSceneBoxes();
            target.placed.forEach(unit => {
                createBox(unit.boxType, new THREE.Vector3(unit.position.x, unit.position.y, unit.position.z), {
                    recordUsage: false,
                    skipHistory: true,
                    ignoreLimit: true
                });
            });
            saveToHistory();
            setEasyWorkspace('planner');
            showNotification(`Dang xem cargo space ${spaceIndex} voi ${target.placed.length} kien hang`, 'success', 1400);
        }

        function resolveManualPlacement(boxType, desiredPosition, options = {}) {
            const { ignoreBox = null, allowRotate = manualLoadSettings.autoRotate } = options;
            const candidates = getOrientationCandidates(boxType, { allowRotate });
            const preferredIndex = typeof boxType.orientationIndex === 'number' ? boxType.orientationIndex : 0;
            let best = null;

            candidates.forEach(candidate => {
                const snappedPosition = getSnappedPlacement(desiredPosition, candidate.dims, ignoreBox);
                const collision = placementHasCollision(snappedPosition, candidate.dims, ignoreBox);
                const distancePenalty =
                    Math.abs(snappedPosition.x - desiredPosition.x) +
                    Math.abs(snappedPosition.y - desiredPosition.y) +
                    Math.abs(snappedPosition.z - desiredPosition.z);
                let score = collision ? -1000 : 1000;
                if (candidate.boxType.orientationIndex === preferredIndex) score += 35;
                score -= distancePenalty * 0.15;
                score -= candidate.dims.height * 0.12;

                if (!best || score > best.score) {
                    best = {
                        ...candidate,
                        position: snappedPosition,
                        collision,
                        score
                    };
                }
            });

            return best;
        }

        function getDropPositionFromPointer(event, boxType) {
            if (!renderer || !camera || !raycaster) return null;
            const rect = renderer.domElement.getBoundingClientRect();
            mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
            mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
            raycaster.setFromCamera(mouse, camera);

            const initialDims = getOrientationCandidates(boxType, { allowRotate: false })[0]?.dims || {
                width: Number(boxType.width) || 0,
                height: Number(boxType.height) || 0,
                depth: Number(boxType.depth) || 0
            };
            const topHits = raycaster.intersectObjects(boxes);
            if (topHits.length > 0) {
                const hit = topHits[0];
                const worldNormal = hit.face?.normal?.clone()?.transformDirection(hit.object.matrixWorld);
                if (worldNormal && worldNormal.y > 0.7) {
                    return new THREE.Vector3(
                        hit.point.x,
                        hit.object.position.y + hit.object.userData.height / 2 + initialDims.height / 2,
                        hit.point.z
                    );
                }
            }

            const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -initialDims.height / 2);
            const point = new THREE.Vector3();
            return raycaster.ray.intersectPlane(floorPlane, point) ? point : null;
        }

        function placeBoxTypeManually(typeIndex, desiredPosition = null) {
            const boxType = boxTypes[typeIndex];
            if (!boxType) return null;
            if (boxType.excluded) {
                showNotification('Item nay dang bi exclude khoi shipment', 'warning', 1400);
                return null;
            }

            const fallbackPosition = new THREE.Vector3(
                0,
                (Number(boxType.height) || 0) / 2,
                currentContainer.d / 2 - (Number(boxType.depth) || 0) / 2 - 20
            );
            const targetPosition = desiredPosition || fallbackPosition;
            const resolved = resolveManualPlacement(boxType, targetPosition);
            if (!resolved || resolved.collision) {
                showNotification('Khong tim duoc vi tri manual load hop le', 'warning', 1500);
                return null;
            }

            const created = createBox(resolved.boxType, resolved.position);
            if (created) {
                highlightBox(created, true);
                selectedBox = created;
                updateSelectedInfo(created);
                showNotification(`Da dat tay ${boxType.name}`, 'success', 1200);
            }
            return created;
        }

        function adjustDraggedBoxPlacement(box) {
            if (!box) return;
            const preferredPosition = getSnappedPlacement(box.position.clone(), box.userData, box);
            if (!manualLoadSettings.autoRotate) {
                box.position.copy(preferredPosition);
                updateSelectedInfo(box);
                return;
            }

            const resolved = resolveManualPlacement(box.userData, preferredPosition, { ignoreBox: box });
            if (!resolved) return;
            applyOrientation(box, resolved.boxType.orientationIndex, {
                skipSave: true,
                skipRecalc: true,
                skipSelection: true
            });
            box.position.copy(resolved.position);
            box.userData.baseDims = { ...(resolved.boxType.baseDims || box.userData.baseDims) };
            box.userData.orientationIndex = resolved.boxType.orientationIndex;
            updateSelectedInfo(box);
        }

        function setupManualCanvasDrop() {
            if (!renderer?.domElement) return;
            const canvas = document.getElementById('canvas');
            const clearState = () => canvas?.classList.remove('manual-drop-active');

            renderer.domElement.addEventListener('mousemove', event => {
                if (!manualPlacementSession) return;
                updateManualPlacementPreviewFromPointer(event);
            });

            renderer.domElement.addEventListener('contextmenu', event => {
                if (!manualPlacementSession) return;
                event.preventDefault();
                rotateManualPlacementPreview(1);
                updateManualPlacementPreviewFromPointer(event);
            });

            renderer.domElement.addEventListener('dragover', event => {
                const rawIndex = event.dataTransfer?.getData('text/manual-box-type');
                const typeIndex = rawIndex !== '' ? Number(rawIndex) : manualDragState.activeIndex;
                if (!Number.isInteger(typeIndex)) return;
                event.preventDefault();
                canvas?.classList.add('manual-drop-active');
            });

            renderer.domElement.addEventListener('dragleave', event => {
                if (renderer.domElement.contains(event.relatedTarget)) return;
                clearState();
            });

            renderer.domElement.addEventListener('drop', event => {
                event.preventDefault();
                clearState();
                const rawIndex = event.dataTransfer?.getData('text/manual-box-type');
                const typeIndex = rawIndex !== '' ? Number(rawIndex) : manualDragState.activeIndex;
                manualDragState.activeIndex = null;
                if (!Number.isInteger(typeIndex)) return;
                const desiredPosition = getDropPositionFromPointer(event, boxTypes[typeIndex] || {});
                placeBoxTypeManually(typeIndex, desiredPosition);
            });

            window.addEventListener('dragend', clearState);
        }

        function replayLastSequence() {
            if (!lastStepPlan || lastStepPlan.length === 0) {
                showNotification('Chua co step plan de phat lai', 'warning');
                return;
            }
            initializeStepPlayback(lastStepPlan);
            startStepPlayback();
            showNotification('Dang phat lai sequence xep hang', 'info', 1200);
        }

        function focusSelectedOrCOG() {
            if (selectedBox) {
                centerOnBox(selectedBox);
                return;
            }
            if (cogMarker?.visible) {
                const targetPos = cogMarker.position.clone();
                const distance = 550;
                const direction = new THREE.Vector3(1, 0.55, 1).normalize();
                camera.position.copy(targetPos.clone().add(direction.multiplyScalar(distance)));
                orbitControls.target.copy(targetPos);
                orbitControls.update();
                showNotification('Da focus vao tam tai trong', 'info', 1000);
                return;
            }
            showNotification('Chua co thung nao de focus', 'warning', 1000);
        }

        function clearStepPlaybackTimer() {
            if (stepPlaybackState.timer) {
                clearInterval(stepPlaybackState.timer);
                stepPlaybackState.timer = null;
            }
            stepPlaybackState.playing = false;
            const playBtn = document.getElementById('btnStepPlayPause');
            if (playBtn) playBtn.textContent = 'Play';
        }

        function initializeStepPlayback(stepPlan = lastStepPlan) {
            clearStepPlaybackTimer();
            stepPlaybackState.steps = Array.isArray(stepPlan) ? stepPlan.map(step => ({ ...step })) : [];
            stepPlaybackState.index = -1;
        }

        function rebuildLayoutFromPlayback(index) {
            clearSceneBoxes();

            if (!stepPlaybackState.steps.length || index < 0) {
                updateCOG();
                updateStats();
                return;
            }

            for (let i = 0; i <= index; i++) {
                const step = stepPlaybackState.steps[i];
                const w = step.width || step.w || 50;
                const h = step.height || step.h || 50;
                const d = step.depth || step.d || 50;
                createBox({
                    name: step.name || `Buoc ${i + 1}`,
                    width: w,
                    height: h,
                    depth: d,
                    weight: step.weight || 1,
                    destination: step.destination || '',
                    group: step.group || '',
                    priority: step.priority || 3,
                    sku: step.sku || '',
                    category: step.category || 'normal'
                }, new THREE.Vector3(
                    step.position?.x - currentContainer.w / 2 + w / 2,
                    step.position?.y + h / 2,
                    step.position?.z - currentContainer.d / 2 + d / 2
                ), { recordUsage: false, skipHistory: true, ignoreLimit: true });
            }

            stepPlaybackState.index = index;
            updateCOG();
            updateStats();

            const caption = document.getElementById('sceneSequenceCaption');
            if (caption) {
                caption.textContent = `${stepPlaybackState.steps.length} buoc · Dang xem ${Math.max(index + 1, 0)}/${stepPlaybackState.steps.length}`;
            }

            const playBtn = document.getElementById('btnStepPlayPause');
            if (playBtn) playBtn.textContent = stepPlaybackState.playing ? 'Pause' : 'Play';
        }

        function startStepPlayback() {
            if (!stepPlaybackState.steps.length) {
                initializeStepPlayback(lastStepPlan);
            }
            if (!stepPlaybackState.steps.length) return;

            clearStepPlaybackTimer();
            stepPlaybackState.playing = true;
            const playBtn = document.getElementById('btnStepPlayPause');
            if (playBtn) playBtn.textContent = 'Pause';

            stepPlaybackState.timer = setInterval(() => {
                const nextIndex = stepPlaybackState.index + 1;
                if (nextIndex >= stepPlaybackState.steps.length) {
                    clearStepPlaybackTimer();
                    return;
                }
                rebuildLayoutFromPlayback(nextIndex);
            }, 220);
        }

        function pauseStepPlayback() {
            clearStepPlaybackTimer();
            rebuildLayoutFromPlayback(stepPlaybackState.index);
        }

        function toggleStepPlayback() {
            if (!stepPlaybackState.steps.length) {
                initializeStepPlayback(lastStepPlan);
            }
            if (!stepPlaybackState.steps.length) {
                showNotification('Chua co step plan', 'warning', 1000);
                return;
            }

            if (stepPlaybackState.playing) pauseStepPlayback();
            else startStepPlayback();
        }

        function showPreviousStep() {
            if (!stepPlaybackState.steps.length) initializeStepPlayback(lastStepPlan);
            const target = Math.max(stepPlaybackState.index - 1, -1);
            pauseStepPlayback();
            rebuildLayoutFromPlayback(target);
        }

        function showNextStep() {
            if (!stepPlaybackState.steps.length) initializeStepPlayback(lastStepPlan);
            const target = Math.min(stepPlaybackState.index + 1, stepPlaybackState.steps.length - 1);
            pauseStepPlayback();
            rebuildLayoutFromPlayback(target);
        }

        function jumpToStep(index) {
            if (!stepPlaybackState.steps.length) initializeStepPlayback(lastStepPlan);
            if (!stepPlaybackState.steps.length) return;
            const target = Math.min(Math.max(index, 0), stepPlaybackState.steps.length - 1);
            pauseStepPlayback();
            rebuildLayoutFromPlayback(target);
            showNotification(`Dang xem buoc ${target + 1}/${stepPlaybackState.steps.length}`, 'info', 900);
        }
        
        // ==================== AUTH FUNCTIONS ====================
        const API_BASE = '/api/web';
        
        async function login(username, password) {
            try {
                const response = await fetch(`${API_BASE}/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });
                const data = await response.json();
                if (data.success) {
                    currentUser = data.data.user;
                    localStorage.setItem('auth_token', data.data.token);
                    localStorage.setItem('user', JSON.stringify(currentUser));
                    updateUserUI();
                    showNotification(`Chào mừng ${currentUser.fullName}!`, 'success');
                    closeLoginModal();
                    return true;
                } else {
                    showNotification(data.message || 'Đăng nhập thất bại', 'error');
                    return false;
                }
            } catch (error) {
                showNotification('Lỗi kết nối server', 'error');
                return false;
            }
        }
        
        async function register(username, email, password, fullName) {
            try {
                const response = await fetch(`${API_BASE}/register`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, email, password, fullName })
                });
                const data = await response.json();
                if (data.success) {
                    currentUser = data.data.user;
                    localStorage.setItem('auth_token', data.data.token);
                    localStorage.setItem('user', JSON.stringify(currentUser));
                    updateUserUI();
                    showNotification('Đăng ký thành công!', 'success');
                    closeRegisterModal();
                    return true;
                } else {
                    showNotification(data.message || 'Đăng ký thất bại', 'error');
                    return false;
                }
            } catch (error) {
                showNotification('Lỗi kết nối server', 'error');
                return false;
            }
        }
        
        function logout() {
            currentUser = null;
            localStorage.removeItem('auth_token');
            localStorage.removeItem('user');
            updateUserUI();
            showNotification('Đã đăng xuất', 'info');
        }
        
        async function checkAuth() {
            const token = localStorage.getItem('auth_token');
            const savedUser = localStorage.getItem('user');
            
            if (token && savedUser) {
                try {
                    const response = await fetch(`${API_BASE}/verify-token`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    const data = await response.json();
                    if (data.success) {
                        currentUser = data.data.user;
                        updateUserUI();
                    } else {
                        logout();
                    }
                } catch (error) {
                    logout();
                }
            }
        }
        
        function updateUserUI() {
    const userBtn = document.getElementById('btnUser');
    const userAvatar = document.getElementById('userAvatar');
    const userName = document.getElementById('userName');
    const userEmail = document.getElementById('userEmail');
    const userPlan = document.getElementById('userPlan');
    
    if (userBtn) {
        if (currentUser) {
            userBtn.innerHTML = `<div style="width:32px;height:32px;background:var(--primary);border-radius:50%;display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;">${currentUser.fullName.charAt(0).toUpperCase()}</div>`;
            if (userAvatar) userAvatar.textContent = currentUser.fullName.charAt(0).toUpperCase();
            if (userName) userName.textContent = currentUser.fullName;
            if (userEmail) userEmail.textContent = currentUser.email;
            if (userPlan) {
                if (currentUser.role === 'admin') {
                    userPlan.textContent = `Quyền: Quản trị viên (Không giới hạn)`;
                } else {
                    const planName = currentUser.subscription?.plan === 'enterprise' ? 'Doanh nghiệp' : 
                                    (currentUser.subscription?.plan === 'pro' ? 'Chuyên nghiệp' : 'Miễn phí');
                    userPlan.textContent = `Gói: ${planName}`;
                }
            }
        } else {
            userBtn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
        }
    }
    
    // Admin luôn có AI Pro
    if (currentUser && (currentUser.role === 'admin' || currentUser.subscription?.features?.aiPro)) {
        const aiProBtn = document.getElementById('btnAIPro');
        if (aiProBtn) {
            aiProBtn.disabled = false;
            aiProBtn.style.opacity = '1';
        }
    }
}
        
        function showLoginModal() {
            const modal = document.getElementById('loginModal');
            if (modal) modal.classList.add('show');
        }
        
        function closeLoginModal() {
            const modal = document.getElementById('loginModal');
            if (modal) modal.classList.remove('show');
        }
        
        function showRegisterModal() {
            closeLoginModal();
            const modal = document.getElementById('registerModal');
            if (modal) modal.classList.add('show');
        }
        
        function closeRegisterModal() {
            const modal = document.getElementById('registerModal');
            if (modal) modal.classList.remove('show');
        }
        
        // ==================== BOX CONTROLS ====================
        function moveBoxUp(box) {
            if (!box) return;
            const step = 10;
            const newY = Math.min(box.position.y + step, currentContainer.h - box.userData.height / 2);
            box.position.y = newY;
            checkCollision(box);
            updateSelectedInfo(box);
            saveToHistory();
            updateStats();
            updateCOG();
        }
        
        function moveBoxDown(box) {
            if (!box) return;
            const step = 10;
            const newY = Math.max(box.position.y - step, box.userData.height / 2);
            box.position.y = newY;
            checkCollision(box);
            updateSelectedInfo(box);
            saveToHistory();
            updateStats();
            updateCOG();
        }
        
        function toggleLabels() {
    showLabels = !showLabels;
    boxes.forEach(box => {
        box.children.forEach(child => {
            if (child.isCSS2DObject) {
                if (showLabels) {
                    child.element.classList.remove('label-hidden');
                } else {
                    child.element.classList.add('label-hidden');
                }
            }
        });
    });
    
    const toggleBtn = document.getElementById('toggleLabels');
    if (toggleBtn) {
        toggleBtn.style.background = showLabels ? 'var(--primary)' : 'var(--gray-light)';
        toggleBtn.style.color = showLabels ? 'white' : 'var(--gray)';
    }
    showNotification(showLabels ? 'Đã bật nhãn thùng' : 'Đã tắt nhãn thùng', 'info', 1000);
}
        // ==================== SMART PACKING ====================
        function smartPackBoxes() {
            if (boxes.length === 0) {
                showNotification('Không có thùng hàng để xếp', 'warning');
                return;
            }
            
            showNotification('🔄 Đang xếp thùng hàng thông minh...', 'info', 1500);
            lastStepPlan = [];
            const rules = capturePlanningRules();
            
            // Sap xep thung theo priority groups giong tutorial EasyCargo:
            // group 1 duoc xep truoc, vao sau trong container; group cuoi se gan cua hon.
            const sortedBoxes = [...boxes].sort((a, b) => {
                const volA = a.userData.width * a.userData.height * a.userData.depth;
                const volB = b.userData.width * b.userData.height * b.userData.depth;
                if (!rules.priority.ignoreSeparation) {
                    const priorityDiff = (a.userData.priority || 3) - (b.userData.priority || 3);
                    if (priorityDiff !== 0) return priorityDiff;
                }
                return volB - volA;
            });
            
            // Reset positions
            sortedBoxes.forEach(box => {
                box.position.set(0, box.userData.height / 2, 0);
            });
            
            // 3D bin packing algorithm
            const placedPositions = [];
            const containerW = currentContainer.w;
            const containerH = currentContainer.h;
            const containerD = currentContainer.d;
            const orderedPriorities = [...new Set(sortedBoxes.map(box => Number(box.userData.priority) || 3))].sort((a, b) => a - b);
            const segmentMap = new Map();
            if (rules.priority.splitByWall && orderedPriorities.length > 0) {
                const wallGap = 12;
                const segmentDepth = (containerD - wallGap * Math.max(orderedPriorities.length - 1, 0)) / orderedPriorities.length;
                let cursor = containerD / 2;
                [...orderedPriorities].sort((a, b) => b - a).forEach((priority, idx, arr) => {
                    const maxZ = cursor;
                    const minZ = idx === arr.length - 1 ? -containerD / 2 : maxZ - segmentDepth;
                    segmentMap.set(priority, { minZ, maxZ });
                    cursor = minZ - wallGap;
                });
            }
            
            let currentY = 0;
            
            for (const box of sortedBoxes) {
                const w = box.userData.width;
                const h = box.userData.height;
                const d = box.userData.depth;
                const stackable = box.userData.stackable !== false;
                const priority = Number(box.userData.priority) || 3;
                const segment = segmentMap.get(priority);
                
                // Try to find best position
                let bestPos = null;
                let bestScore = -Infinity;
                
                // Check all possible positions with grid search
                const step = 10;
                const maxY = stackable ? currentY + 50 : 0;
                const zStart = segment ? Math.max(segment.minZ + d/2, -containerD/2 + d/2) : -containerD/2 + d/2;
                const zEnd = segment ? Math.min(segment.maxZ - d/2, containerD/2 - d/2) : containerD/2 - d/2;
                for (let yOffset = 0; yOffset <= maxY; yOffset += step) {
                    for (let xOffset = -containerW/2 + w/2; xOffset <= containerW/2 - w/2; xOffset += step) {
                        for (let zOffset = zStart; zOffset <= zEnd; zOffset += step) {
                            const testPos = { x: xOffset, y: yOffset + h/2, z: zOffset };
                            
                            // Check collision with placed boxes
                            let collision = false;
                            for (const placed of placedPositions) {
                                if (Math.abs(testPos.x - placed.x) < (w + placed.w) / 2 &&
                                    Math.abs(testPos.y - placed.y) < (h + placed.h) / 2 &&
                                    Math.abs(testPos.z - placed.z) < (d + placed.d) / 2) {
                                    collision = true;
                                    break;
                                }
                                if (rules.priority.noGroupStacking && placed.priority !== priority) {
                                    const overlapXZ =
                                        Math.abs(testPos.x - placed.x) < (w + placed.w) / 2 &&
                                        Math.abs(testPos.z - placed.z) < (d + placed.d) / 2;
                                    const isAbove = testPos.y >= placed.y + placed.h / 2 && testPos.y > h / 2;
                                    if (overlapXZ && isAbove) {
                                        collision = true;
                                        break;
                                    }
                                }
                            }
                            
                            // Check container boundaries
                            if (!collision && testPos.y + h/2 <= containerH && 
                                testPos.x + w/2 <= containerW/2 && testPos.x - w/2 >= -containerW/2 &&
                                testPos.z + d/2 <= containerD/2 && testPos.z - d/2 >= -containerD/2) {
                                const doorBias = rules.priority.ignoreSeparation ? 0 :
                                    ((priority / 4) * ((testPos.z + containerD/2) / Math.max(containerD, 1)) * 60) -
                                    (((5 - priority) / 4) * ((containerD/2 - testPos.z) / Math.max(containerD, 1)) * 20);
                                const centerBias = -Math.abs(testPos.x) / Math.max(containerW, 1) * 20;
                                const score = -testPos.y + centerBias + doorBias + (yOffset === 0 ? 50 : 0);
                                if (score > bestScore) {
                                    bestScore = score;
                                    bestPos = testPos;
                                }
                            }
                        }
                    }
                }
                
                if (bestPos) {
                    box.position.set(bestPos.x, bestPos.y, bestPos.z);
                    placedPositions.push({
                        x: bestPos.x,
                        y: bestPos.y,
                        z: bestPos.z,
                        w: w,
                        h: h,
                        d: d,
                        priority
                    });
                    currentY = Math.max(currentY, bestPos.y + h/2);
                    lastStepPlan.push({
                        name: box.userData.name || `Box ${box.userData.id}`,
                        position: { ...bestPos },
                        destination: box.userData.destination || '',
                        weight: box.userData.weight || 0,
                        width: box.userData.width || w,
                        height: box.userData.height || h,
                        depth: box.userData.depth || d,
                        priority: box.userData.priority || 3,
                        group: box.userData.group || '',
                        sku: box.userData.sku || ''
                    });
                }
            }

            if (rules.weight.shiftToMassCenter && boxes.length > 0) {
                let totalWeight = 0;
                let cogX = 0;
                let cogZ = 0;
                boxes.forEach(box => {
                    const weight = Number(box.userData.weight) || 0;
                    totalWeight += weight;
                    cogX += box.position.x * weight;
                    cogZ += box.position.z * weight;
                });
                if (totalWeight > 0) {
                    cogX /= totalWeight;
                    cogZ /= totalWeight;
                    let deltaX = -cogX;
                    let deltaZ = -cogZ;
                    boxes.forEach(box => {
                        deltaX = Math.max(deltaX, -containerW/2 + box.userData.width/2 - box.position.x);
                        deltaX = Math.min(deltaX, containerW/2 - box.userData.width/2 - box.position.x);
                        deltaZ = Math.max(deltaZ, -containerD/2 + box.userData.depth/2 - box.position.z);
                        deltaZ = Math.min(deltaZ, containerD/2 - box.userData.depth/2 - box.position.z);
                    });
                    boxes.forEach((box, index) => {
                        box.position.x += deltaX;
                        box.position.z += deltaZ;
                        if (lastStepPlan[index]?.position) {
                            lastStepPlan[index].position.x = box.position.x;
                            lastStepPlan[index].position.z = box.position.z;
                        }
                    });
                }
            }
            
            // Check collisions after placement
            for (let i = 0; i < boxes.length; i++) {
                for (let j = i + 1; j < boxes.length; j++) {
                    const box1 = boxes[i];
                    const box2 = boxes[j];
                    const bounds1 = new THREE.Box3().setFromObject(box1);
                    const bounds2 = new THREE.Box3().setFromObject(box2);
                    if (bounds1.intersectsBox(bounds2)) {
                        // Slight adjustment
                        box2.position.y += 5;
                    }
                }
            }
            
            updateStats();
            updateCOG();
            saveToHistory();
            renderStepPlan();
            showNotification('✅ Đã xếp thùng hàng thông minh!', 'success');
        }
        
        // ==================== 3D SETUP ====================
        function init3D() {
            const canvasDiv = document.getElementById('canvas');
            if (!canvasDiv) return;
            
            // Scene with light background
            scene = new THREE.Scene();
            scene.background = new THREE.Color(0xf0f4ff);
            scene.fog = new THREE.FogExp2(0xf0f4ff, 0.0002);
            
            // Camera
            camera = new THREE.PerspectiveCamera(45, canvasDiv.clientWidth / canvasDiv.clientHeight, 0.1, 20000);
            camera.position.set(1200, 900, 1600);
            camera.lookAt(0, 0, 0);
            
            // Renderer
            renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
            renderer.setSize(canvasDiv.clientWidth, canvasDiv.clientHeight);
            renderer.shadowMap.enabled = true;
            renderer.shadowMap.type = THREE.PCFSoftShadowMap;
            renderer.setPixelRatio(window.devicePixelRatio);
            canvasDiv.appendChild(renderer.domElement);
            
            // CSS2 Renderer for labels
            labelRenderer = new CSS2DRenderer();
            labelRenderer.setSize(canvasDiv.clientWidth, canvasDiv.clientHeight);
            labelRenderer.domElement.style.position = 'absolute';
            labelRenderer.domElement.style.top = '0px';
            labelRenderer.domElement.style.left = '0px';
            labelRenderer.domElement.style.pointerEvents = 'none';
            canvasDiv.appendChild(labelRenderer.domElement);
            
            // Lighting
            const ambientLight = new THREE.AmbientLight(0x404060, 0.7);
            scene.add(ambientLight);
            
            const mainLight = new THREE.DirectionalLight(0xfff5e6, 1.2);
            mainLight.position.set(1000, 2000, 800);
            mainLight.castShadow = true;
            mainLight.receiveShadow = true;
            mainLight.shadow.mapSize.width = 2048;
            mainLight.shadow.mapSize.height = 2048;
            mainLight.shadow.camera.near = 0.5;
            mainLight.shadow.camera.far = 3000;
            mainLight.shadow.camera.left = -1000;
            mainLight.shadow.camera.right = 1000;
            mainLight.shadow.camera.top = 1000;
            mainLight.shadow.camera.bottom = -1000;
            scene.add(mainLight);
            
            const fillLight = new THREE.PointLight(0x88aaff, 0.4);
            fillLight.position.set(-500, 800, -600);
            scene.add(fillLight);
            
            const backLight = new THREE.PointLight(0xffaa88, 0.3);
            backLight.position.set(500, 500, 1000);
            scene.add(backLight);
            
            const rimLight = new THREE.PointLight(0xff66aa, 0.2);
            rimLight.position.set(-800, 600, 800);
            scene.add(rimLight);
            
            // Grid helper
            const gridHelper = new THREE.GridHelper(4000, 40, 0x3b82f6, 0x94a3b8);
            gridHelper.position.y = -0.5;
            scene.add(gridHelper);
            
            // Orbit Controls
            orbitControls = new OrbitControls(camera, renderer.domElement);
            orbitControls.enableDamping = true;
            orbitControls.dampingFactor = 0.05;
            orbitControls.maxPolarAngle = Math.PI / 2.2;
            orbitControls.minDistance = 300;
            orbitControls.maxDistance = 3000;
            orbitControls.rotateSpeed = 1.0;
            orbitControls.zoomSpeed = 1.2;
            orbitControls.panSpeed = 0.8;
            
            // Raycaster for selection
            raycaster = new THREE.Raycaster();
            mouse = new THREE.Vector2();
            
            // Container group
            containerGroup = new THREE.Group();
            scene.add(containerGroup);
            
            // COG Marker
            createCOGMarker();
            
            // Update container visual
            updateContainerVisual();
            
            // Setup drag and drop
            setupDragAndDrop();
            
            // Setup selection
            setupSelection();
            
            // Setup rotation
            setupRotation();

            // Manual load drag/drop from queue into 3D scene
            setupManualCanvasDrop();
        }
        
        // ==================== DRAG AND DROP ====================
        function setupDragAndDrop() {
            let currentDragBox = null;
            let dragOffset = null;
            
            renderer.domElement.addEventListener('mousedown', (e) => {
                if (manualPlacementSession) return;
                if (rotationMode) return;
                if (orbitControls.enabled === false) return;
                
                const rect = renderer.domElement.getBoundingClientRect();
                mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
                mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
                
                raycaster.setFromCamera(mouse, camera);
                const intersects = raycaster.intersectObjects(boxes);
                
                if (intersects.length > 0) {
                    currentDragBox = intersects[0].object;
                    
                    const planeNormal = new THREE.Vector3(0, 1, 0);
                    const planeConstant = -currentDragBox.position.y;
                    dragPlane = new THREE.Plane(planeNormal, planeConstant);
                    
                    const intersectionPoint = new THREE.Vector3();
                    raycaster.ray.intersectPlane(dragPlane, intersectionPoint);
                    dragOffset = currentDragBox.position.clone().sub(intersectionPoint);
                    
                    isDragging = true;
                    orbitControls.enabled = false;
                    renderer.domElement.style.cursor = 'grabbing';
                    highlightBox(currentDragBox, true);
                    e.stopPropagation();
                }
            });
            
            window.addEventListener('mousemove', (e) => {
                if (!isDragging || !currentDragBox) return;
                
                const rect = renderer.domElement.getBoundingClientRect();
                mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
                mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
                
                raycaster.setFromCamera(mouse, camera);
                
                if (dragPlane) {
                    const intersectionPoint = new THREE.Vector3();
                    if (raycaster.ray.intersectPlane(dragPlane, intersectionPoint)) {
                        let newPos = intersectionPoint.clone().add(dragOffset);
                        
                        newPos = getSnappedPlacement(newPos, currentDragBox.userData, currentDragBox);
                        currentDragBox.position.copy(newPos);
                        updateSelectedInfo(currentDragBox);
                    }
                }
            });
            
            window.addEventListener('mouseup', () => {
                if (isDragging && currentDragBox) {
                    adjustDraggedBoxPlacement(currentDragBox);
                    checkCollision(currentDragBox);
                    saveToHistory();
                    highlightBox(currentDragBox, false);
                    currentDragBox = null;
                    isDragging = false;
                    orbitControls.enabled = true;
                    renderer.domElement.style.cursor = 'default';
                    dragPlane = null;
                }
            });
        }
        
        function setupRotation() {
            renderer.domElement.addEventListener('click', (e) => {
                if (manualPlacementSession) return;
                if (!rotationMode) return;
                const rect = renderer.domElement.getBoundingClientRect();
                mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
                mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
                
                raycaster.setFromCamera(mouse, camera);
                const intersects = raycaster.intersectObjects(boxes);
                
                if (intersects.length > 0) {
                    const rotatingBox = intersects[0].object;
                    cycleOrientation(rotatingBox);
                    saveToHistory();
                }
            });
        }
        
        function setupSelection() {
            renderer.domElement.addEventListener('click', (e) => {
                if (manualPlacementSession) {
                    commitManualPlacementFromPreview(e);
                    return;
                }
                if (isDragging) return;
                
                const rect = renderer.domElement.getBoundingClientRect();
                mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
                mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
                
                raycaster.setFromCamera(mouse, camera);
                const intersects = raycaster.intersectObjects(boxes);
                
                if (selectedBox) highlightBox(selectedBox, false);
                
                if (intersects.length > 0) {
                    selectedBox = intersects[0].object;
                    highlightBox(selectedBox, true);
                    updateSelectedInfo(selectedBox);
                    document.getElementById('infoPanel').style.display = 'block';
                } else {
                    selectedBox = null;
                    document.getElementById('infoPanel').style.display = 'none';
                }
            });
        }
        
        function highlightBox(box, highlight) {
            if (highlight) {
                box.material.emissive = new THREE.Color(0x88ccff);
                box.children.forEach(child => {
                    if (child.isCSS2DObject) {
                        child.element.style.borderLeft = '3px solid #f59e0b';
                        child.element.style.backgroundColor = 'rgba(0,0,0,0.95)';
                    }
                });
            } else {
                box.material.emissive = new THREE.Color(0x000000);
                box.children.forEach(child => {
                    if (child.isCSS2DObject) {
                        child.element.style.borderLeft = '3px solid #3b82f6';
                        child.element.style.backgroundColor = 'rgba(0,0,0,0.85)';
                    }
                });
            }
        }
        
        function createCOGMarker() {
            cogMarker = new THREE.Group();
            
            const sphereGeo = new THREE.SphereGeometry(12, 32, 32);
            const sphereMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, emissive: 0x442200, roughness: 0.3 });
            const sphere = new THREE.Mesh(sphereGeo, sphereMat);
            sphere.castShadow = true;
            cogMarker.add(sphere);
            
            const ringGeo = new THREE.TorusGeometry(18, 1.5, 32, 64);
            const ringMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b });
            const ringH = new THREE.Mesh(ringGeo, ringMat);
            ringH.rotation.x = Math.PI / 2;
            cogMarker.add(ringH);
            
            const ringV = new THREE.Mesh(ringGeo, ringMat);
            ringV.rotation.z = Math.PI / 2;
            cogMarker.add(ringV);
            
            scene.add(cogMarker);
            cogMarker.visible = false;
        }
        
        function updateCOG() {
            if (boxes.length === 0) {
                cogMarker.visible = false;
                return;
            }
            
            let totalWeight = 0;
            let cogX = 0, cogY = 0, cogZ = 0;
            
            boxes.forEach(box => {
                const weight = box.userData.weight;
                totalWeight += weight;
                cogX += box.position.x * weight;
                cogY += box.position.y * weight;
                cogZ += box.position.z * weight;
            });
            
            if (totalWeight > 0) {
                cogX /= totalWeight;
                cogY /= totalWeight;
                cogZ /= totalWeight;
                cogMarker.position.set(cogX, cogY, cogZ);
                cogMarker.visible = true;
            }
        }

        function createCorrugatedWallTexture() {
            const canvas = document.createElement('canvas');
            canvas.width = 1024;
            canvas.height = 512;
            const ctx = canvas.getContext('2d');

            ctx.fillStyle = '#f2f0ea';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            for (let x = 0; x < canvas.width; x += 20) {
                ctx.fillStyle = x % 40 === 0 ? 'rgba(120, 112, 96, 0.12)' : 'rgba(255,255,255,0.18)';
                ctx.fillRect(x, 0, 10, canvas.height);
            }

            ctx.fillStyle = 'rgba(120, 112, 96, 0.08)';
            for (let y = 0; y < canvas.height; y += 38) {
                ctx.fillRect(0, y, canvas.width, 2);
            }

            ctx.fillStyle = 'rgba(80, 80, 80, 0.16)';
            ctx.font = 'bold 34px sans-serif';
            ctx.fillText('cargoflow', canvas.width - 240, 72);

            const texture = new THREE.CanvasTexture(canvas);
            texture.wrapS = THREE.RepeatWrapping;
            texture.wrapT = THREE.RepeatWrapping;
            texture.anisotropy = 4;
            return texture;
        }

        function createFloorPlateTexture() {
            const canvas = document.createElement('canvas');
            canvas.width = 1024;
            canvas.height = 1024;
            const ctx = canvas.getContext('2d');

            ctx.fillStyle = '#b9b2a4';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.strokeStyle = 'rgba(90,90,90,0.14)';
            ctx.lineWidth = 2;

            const size = 26;
            for (let y = 0; y < canvas.height + size; y += size) {
                for (let x = 0; x < canvas.width + size; x += size) {
                    ctx.beginPath();
                    ctx.moveTo(x, y + size / 2);
                    ctx.lineTo(x + size / 2, y);
                    ctx.lineTo(x + size, y + size / 2);
                    ctx.lineTo(x + size / 2, y + size);
                    ctx.closePath();
                    ctx.stroke();
                }
            }

            const texture = new THREE.CanvasTexture(canvas);
            texture.wrapS = THREE.RepeatWrapping;
            texture.wrapT = THREE.RepeatWrapping;
            texture.repeat.set(2.8, 10);
            texture.anisotropy = 4;
            return texture;
        }

        function updateContainerVisualLegacy() {
            if (!containerGroup) return;
            containerGroup.clear();
            
            const W = currentContainer.w;
            const H = currentContainer.h;
            const D = currentContainer.d;
            const opacity = document.getElementById('opacitySlider')?.value || 0.25;
            const containerColor = currentContainer.color || 0x3b82f6;
            
            // Update opacity display
            const opacityValueSpan = document.getElementById('opacityValue');
            if (opacityValueSpan) opacityValueSpan.innerHTML = `${Math.round(opacity * 100)}%`;
            
            const wallTexture = createCorrugatedWallTexture();
            const floorTexture = createFloorPlateTexture();
            const wallOpacity = Math.max(Number(opacity) || 0, 0.92);

            const floor = new THREE.Mesh(
                new THREE.PlaneGeometry(W, D),
                new THREE.MeshStandardMaterial({
                    map: floorTexture,
                    color: 0xc0b7a7,
                    roughness: 0.82,
                    metalness: 0.1,
                    side: THREE.DoubleSide
                })
            );
            floor.rotation.x = -Math.PI / 2;
            floor.receiveShadow = true;
            containerGroup.add(floor);

            const wallMaterial = new THREE.MeshStandardMaterial({
                map: wallTexture,
                color: 0xf7f4ed,
                roughness: 0.82,
                metalness: 0.04,
                transparent: true,
                opacity: wallOpacity,
                side: THREE.DoubleSide
            });

            const backWall = new THREE.Mesh(new THREE.PlaneGeometry(W, H), wallMaterial.clone());
            backWall.position.set(0, H / 2, -D / 2);
            backWall.receiveShadow = true;
            containerGroup.add(backWall);

            const leftWall = new THREE.Mesh(new THREE.PlaneGeometry(D, H), wallMaterial.clone());
            leftWall.rotation.y = Math.PI / 2;
            leftWall.position.set(-W / 2, H / 2, 0);
            leftWall.receiveShadow = true;
            containerGroup.add(leftWall);

            const rightWall = new THREE.Mesh(new THREE.PlaneGeometry(D, H), wallMaterial.clone());
            rightWall.rotation.y = -Math.PI / 2;
            rightWall.position.set(W / 2, H / 2, 0);
            rightWall.receiveShadow = true;
            containerGroup.add(rightWall);

            const roofGuide = new THREE.Mesh(
                new THREE.PlaneGeometry(W - 10, D - 10),
                new THREE.MeshBasicMaterial({
                    color: 0x9ca3af,
                    transparent: true,
                    opacity: 0.18,
                    side: THREE.DoubleSide
                })
            );
            roofGuide.rotation.x = Math.PI / 2;
            roofGuide.position.set(0, H, 0);
            containerGroup.add(roofGuide);

            const beamMaterial = new THREE.MeshStandardMaterial({ color: 0xc8b89d, roughness: 0.55, metalness: 0.08 });
            const beams = [
                { geo: new THREE.BoxGeometry(10, H, 10), pos: [-W / 2, H / 2, D / 2] },
                { geo: new THREE.BoxGeometry(10, H, 10), pos: [W / 2, H / 2, D / 2] },
                { geo: new THREE.BoxGeometry(W, 12, 12), pos: [0, H - 6, D / 2] },
                { geo: new THREE.BoxGeometry(W, 10, 10), pos: [0, 5, D / 2] }
            ];
            beams.forEach(beam => {
                const mesh = new THREE.Mesh(beam.geo, beamMaterial);
                mesh.position.set(...beam.pos);
                mesh.castShadow = true;
                mesh.receiveShadow = true;
                containerGroup.add(mesh);
            });

            const edgeMat = new THREE.LineBasicMaterial({ color: 0x8b8b8b });
            const edgePoints = [
                [new THREE.Vector3(-W / 2, 0, D / 2), new THREE.Vector3(-W / 2, H, D / 2)],
                [new THREE.Vector3(W / 2, 0, D / 2), new THREE.Vector3(W / 2, H, D / 2)],
                [new THREE.Vector3(-W / 2, H, D / 2), new THREE.Vector3(W / 2, H, D / 2)],
                [new THREE.Vector3(-W / 2, 0, -D / 2), new THREE.Vector3(W / 2, 0, -D / 2)]
            ];
            edgePoints.forEach(([start, end]) => {
                const edge = new THREE.Line(new THREE.BufferGeometry().setFromPoints([start, end]), edgeMat);
                containerGroup.add(edge);
            });

            const rules = capturePlanningRules();
            if (rules.priority.splitByWall) {
                const planningEntries = getPlanningEntries();
                const priorities = [...new Set(planningEntries.map(entry => Number(entry.priority) || 3))].sort((a, b) => a - b);
                if (priorities.length > 1) {
                    const wallGap = 12;
                    const segmentDepth = (D - wallGap * Math.max(priorities.length - 1, 0)) / priorities.length;
                    let cursor = D / 2;
                    [...priorities].sort((a, b) => b - a).forEach((priority, idx, arr) => {
                        const maxZ = cursor;
                        const minZ = idx === arr.length - 1 ? -D / 2 : maxZ - segmentDepth;

                        const guideMat = new THREE.MeshBasicMaterial({
                            color: priority >= 3 ? 0xf59e0b : 0x2563eb,
                            transparent: true,
                            opacity: 0.07,
                            side: THREE.DoubleSide
                        });
                        const guide = new THREE.Mesh(new THREE.PlaneGeometry(W - 18, H - 24), guideMat);
                        guide.position.set(0, H / 2, minZ - wallGap / 2);
                        containerGroup.add(guide);

                        const lineMat = new THREE.LineBasicMaterial({ color: priority >= 3 ? 0xf59e0b : 0x2563eb });
                        const lineGeo = new THREE.BufferGeometry().setFromPoints([
                            new THREE.Vector3(-W / 2 + 8, 4, minZ - wallGap / 2),
                            new THREE.Vector3(W / 2 - 8, 4, minZ - wallGap / 2)
                        ]);
                        containerGroup.add(new THREE.Line(lineGeo, lineMat));

                        cursor = minZ - wallGap;
                    });
                }
            }
        }
        
        function checkCollision(box) {
            if (!box) return false;
            
            const boxBounds = new THREE.Box3().setFromObject(box);
            let hasCollision = false;
            
            // Check container boundaries with optional overhang
            const allowOverhang = currentContainer.allowOverhangPercent || 0;
            const overhangW = currentContainer.w * allowOverhang / 100;
            const overhangD = currentContainer.d * allowOverhang / 100;
            const halfW = currentContainer.w / 2;
            const halfD = currentContainer.d / 2;
            const maxX = halfW + overhangW;
            const minX = -halfW - overhangW;
            const maxZ = halfD + overhangD;
            const minZ = -halfD - overhangD;
            const yLimit = currentContainer.h + (currentContainer.allowOverhangPercent || 0);

            const bbMin = boxBounds.min, bbMax = boxBounds.max;
            if (bbMax.x > maxX || bbMin.x < minX || bbMax.z > maxZ || bbMin.z < minZ || bbMax.y > yLimit || bbMin.y < 0) {
                hasCollision = true;
                box.material.emissive = new THREE.Color(0x88ccff);
                showNotification('Thùng nằm ngoài biên (overhang vượt giới hạn)', 'warning', 1500);
            } else {
                // Check collision with other boxes
                for (let other of boxes) {
                    if (other === box) continue;
                    const otherBounds = new THREE.Box3().setFromObject(other);
                    if (boxBounds.intersectsBox(otherBounds)) {
                        hasCollision = true;
                        box.material.emissive = new THREE.Color(0x88ccff);
                        showNotification('Thùng va chạm với thùng khác!', 'warning', 1500);
                        break;
                    }
                }
            }
            
            if (!hasCollision) {
                box.material.emissive = new THREE.Color(0x000000);
            }
            
            return hasCollision;
        }
 function createBoxLabel(box, dimensions) {
    const w = dimensions.width;
    const h = dimensions.height;
    const d = dimensions.depth;
    const weight = dimensions.weight;
    const name = dimensions.name || `Box`;

    const mainDiv = document.createElement('div');
    mainDiv.className = 'box-label';
    mainDiv.innerHTML = `
        <div class="box-name">${name}</div>
        <div class="box-weight">⚖️ ${weight} kg</div>
        ${dimensions.destination ? `<div class="box-dest">📍 ${dimensions.destination}</div>` : ''}
    `;
    mainDiv.style.cssText = `
        background: rgba(0,0,0,0.65);
        backdrop-filter: blur(8px);
        color: white;
        padding: 4px 10px;
        border-radius: 8px;
        font-size: 11px;
        font-weight: 500;
        text-align: center;
        border-left: 3px solid #3b82f6;
        box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        pointer-events: none;
        font-family: 'Inter', sans-serif;
        white-space: nowrap;
    `;

    const mainLabel = new CSS2DObject(mainDiv);
    mainLabel.position.set(0, h/2 + 12, 0);
    
    // Nếu đang ở chế độ tắt nhãn, thêm class ẩn
    if (!showLabels) {
        mainLabel.element.classList.add('label-hidden');
    }
    
    box.add(mainLabel);
    return mainLabel;
}
        
        // Cập nhật hàm createBox với màu sắc sáng hơn
        function createBox(boxType, position = null, options = {}) {
            const { recordUsage = true, skipHistory = false, ignoreLimit = false } = options;
            const isAdmin = currentUser && currentUser.role === 'admin';
            const maxBoxes = isAdmin ? Infinity : (currentUser?.subscription?.features?.maxBoxes || 50);
            if (!ignoreLimit && !isAdmin && boxes.length >= maxBoxes) {
                showNotification(`Đã đạt giới hạn ${maxBoxes} thùng. Vui lòng nâng cấp tài khoản!`, 'warning');
                return null;
            }

            const rawBaseDims = boxType.baseDims || { width: boxType.width, height: boxType.height, depth: boxType.depth };
            const baseDims = {
                width: Number(rawBaseDims.width) || 0,
                height: Number(rawBaseDims.height) || 0,
                depth: Number(rawBaseDims.depth) || 0
            };
            const orientationIndex = typeof boxType.orientationIndex === 'number' ? boxType.orientationIndex : 0;
            const orientedDims = getOrientationDims(baseDims, orientationIndex);
            const w = orientedDims.width;
            const h = orientedDims.height;
            const d = orientedDims.depth;
            const weight = Number(boxType.weight) || 0;
            
            // Màu sắc tươi sáng hơn
const categoryColors = {
                normal: 0x60a5fa,
                fragile: 0xf87171,
                heavy: 0x22c55e,
                liquid: 0x0891b2
            };
            const baseColor = categoryColors[boxType.category] || 0x3b82f6;
            
            // Tạo texture với màu sáng và rõ nét
            const canvas = document.createElement('canvas');
            canvas.width = 512;
            canvas.height = 512;
            const ctx = canvas.getContext('2d');
            
            // Background gradient sáng
            const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
            grad.addColorStop(0, `#${baseColor.toString(16).padStart(6, '0')}`);
            grad.addColorStop(1, `#${(baseColor - 0x222222).toString(16).padStart(6, '0')}`);
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            // Pattern sáng
ctx.fillStyle = 'rgba(255,255,255,0.3)';
            for (let i = 0; i < 10; i++) {
                ctx.fillRect(i * 50, 0, 25, canvas.height);
                ctx.fillRect(0, i * 50, canvas.width, 25);
            }
            
            // Text với viền đen để dễ đọc
            ctx.shadowColor = 'rgba(0,0,0,0.5)';
            ctx.shadowBlur = 4;
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 42px "Inter"';
            ctx.fillText(boxType.name || 'CARGO', 50, 100);
            ctx.font = '28px "Inter"';
            ctx.fillText(`${weight} kg`, 50, 180);
            ctx.fillText(`${w}x${h}x${d}`, 50, 250);
            
            if (boxType.fragile) {
                ctx.fillStyle = '#fbbf24';
                ctx.font = 'bold 32px "Inter"';
                ctx.fillText('⚠️ FRAGILE', 50, 340);
            }
            if (boxType.hazardous) {
                ctx.fillStyle = '#f87171';
                ctx.font = 'bold 32px "Inter"';
                ctx.fillText('☠️ HAZMAT', 50, 410);
            }
            
            const texture = new THREE.CanvasTexture(canvas);
const material = new THREE.MeshStandardMaterial({ 
                map: texture, 
                roughness: 0.3, 
                metalness: 0.12,
                emissive: new THREE.Color(baseColor),
                emissiveIntensity: 0.22
            });
            const geometry = new THREE.BoxGeometry(w, h, d);
            const mesh = new THREE.Mesh(geometry, material);
            
            if (position) {
                mesh.position.copy(position);
            } else {
                mesh.position.set(0, h/2, 0);
            }
            
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            mesh.userData = {
                ...boxType,
                width: w,
                height: h,
                depth: d,
                id: boxes.length + 1,
                originalColor: baseColor,
                createdAt: Date.now(),
                rotation: { x: 0, y: 0, z: 0 },
                baseDims: { ...baseDims },
                orientationIndex,
                stackable: boxType.stackable !== false,
                tiltable: boxType.tiltable !== false,
                rotatable: boxType.rotatable !== false,
                destination: boxType.destination || ''
            };
            
            // Thêm labels trên các cạnh
            createBoxLabel(mesh, {
                width: w,
                height: h,
                depth: d,
                weight: weight,
                name: boxType.name || `Box ${mesh.userData.id}`,
                destination: boxType.destination || ''
            });
            
            scene.add(mesh);
            boxes.push(mesh);
            
            updateStats();
            updateCOG();
            if (!skipHistory) saveToHistory();
            if (recordUsage) recordBoxUsage(mesh.userData);
            
            return mesh;
        }
        function updateBoxLabels(box) {
const toRemove = [];
box.children.forEach(child => {
    if (child.isCSS2DObject) {
        toRemove.push(child);
    }
});
toRemove.forEach(child => {
    box.remove(child);
    if (child.element) child.element.remove();
});

// Tạo label mới
createBoxLabel(box, {
    width: box.userData.width,
    height: box.userData.height,
    depth: box.userData.depth,
    weight: box.userData.weight,
    name: box.userData.name,
    destination: box.userData.destination || ''
});
        }

        function applyOrientation(box, index = 0, options = {}) {
            if (!box) return;
            const { skipSave = false, skipRecalc = false, skipSelection = false } = options;
            const base = box.userData.baseDims || { width: box.userData.width, height: box.userData.height, depth: box.userData.depth };
            const newDims = getOrientationDims(base, index);
            const pos = box.position.clone();

            if (box.geometry) box.geometry.dispose();
            box.geometry = new THREE.BoxGeometry(newDims.width, newDims.height, newDims.depth);
            box.position.copy(pos);
            box.rotation.set(0, 0, 0);

            box.userData.width = newDims.width;
            box.userData.height = newDims.height;
            box.userData.depth = newDims.depth;
            box.userData.orientationIndex = index % ORIENTATION_MAPPINGS.length;

            updateBoxLabels(box);
            if (!skipSelection) updateSelectedInfo(box);
            if (!skipRecalc) {
                updateStats();
                updateCOG();
            }
            if (!skipSave) saveToHistory();
        }

        function cycleOrientation(box) {
            if (!box) return;
            if (box.userData.rotatable === false) {
                showNotification('Thùng này bị khóa xoay', 'warning', 1200);
                return;
            }
            const next = ((box.userData.orientationIndex || 0) + 1) % ORIENTATION_MAPPINGS.length;
            applyOrientation(box, next);
            showNotification(`Đã đổi hướng thùng (mặt ${next + 1}/6)`, 'info', 900);
        }
        
        // Thêm hàm highlight khi hover để hiển thị thông tin chi tiết
        function setupBoxHighlight() {
            let hoveredBox = null;
            let hoverTimeout = null;
            
            renderer.domElement.addEventListener('mousemove', (e) => {
                const rect = renderer.domElement.getBoundingClientRect();
                mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
                mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
                
                raycaster.setFromCamera(mouse, camera);
                const intersects = raycaster.intersectObjects(boxes);
                
                if (intersects.length > 0) {
                    const box = intersects[0].object;
                    if (hoveredBox !== box) {
                        if (hoveredBox) {
                            // Reset previous hovered box
                            hoveredBox.material.emissiveIntensity = 0.1;
                            hoveredBox.userData.hovered = false;
                        }
                        hoveredBox = box;
                        hoveredBox.material.emissiveIntensity = 0.3;
                        hoveredBox.userData.hovered = true;
                        
                        // Show tooltip with detailed info
                        clearTimeout(hoverTimeout);
                        hoverTimeout = setTimeout(() => {
                            showFloatingTooltip(box, e.clientX, e.clientY);
                        }, 500);
                    }
                } else if (hoveredBox) {
                    hoveredBox.material.emissiveIntensity = 0.1;
                    hoveredBox.userData.hovered = false;
                    hoveredBox = null;
                    hideFloatingTooltip();
                }
            });
        }
        
        function showFloatingTooltip(box, x, y) {
            let tooltip = document.getElementById('floatingTooltip');
            if (!tooltip) {
                tooltip = document.createElement('div');
                tooltip.id = 'floatingTooltip';
                tooltip.style.cssText = `
                    position: fixed;
                    background: rgba(0,0,0,0.9);
                    backdrop-filter: blur(12px);
                    color: white;
                    padding: 12px 16px;
                    border-radius: 12px;
                    font-size: 12px;
                    font-family: 'Inter', monospace;
                    z-index: 10000;
                    pointer-events: none;
                    border-left: 4px solid #3b82f6;
                    box-shadow: 0 4px 20px rgba(0,0,0,0.3);
                    max-width: 250px;
                `;
                document.body.appendChild(tooltip);
            }
            
            const volume = (box.userData.width * box.userData.height * box.userData.depth) / 1000000;
            
            tooltip.innerHTML = `
                <div style="font-weight:700; margin-bottom:6px;">📦 ${box.userData.name || `Thùng ${box.userData.id}`}</div>
                <div>📏 ${box.userData.width}×${box.userData.height}×${box.userData.depth} cm</div>
                <div>📐 Thể tích: ${volume.toFixed(3)} m³</div>
                <div>⚖️ Trọng lượng: ${box.userData.weight} kg</div>
                <div>📍 Vị trí: (${box.position.x.toFixed(0)}, ${box.position.y.toFixed(0)}, ${box.position.z.toFixed(0)})</div>
                ${box.userData.fragile ? '<div style="color:#fbbf24; margin-top:4px;">⚠️ Hàng dễ vỡ</div>' : ''}
                ${box.userData.hazardous ? '<div style="color:#f87171; margin-top:4px;">☠️ Hàng nguy hiểm</div>' : ''}
            `;
            
            tooltip.style.left = (x + 15) + 'px';
            tooltip.style.top = (y - 10) + 'px';
            tooltip.style.display = 'block';
        }
        
        function hideFloatingTooltip() {
            const tooltip = document.getElementById('floatingTooltip');
            if (tooltip) {
                tooltip.style.display = 'none';
            }
        }
        
        // Thêm vào hàm updateSelectedInfo để hiển thị thông tin chi tiết hơn
        function updateSelectedInfo(box) {
            const info = document.getElementById('infoText');
            if (!info) return;
            
            const volume = (box.userData.width * box.userData.height * box.userData.depth) / 1000000;
            const density = volume > 0 ? (box.userData.weight / volume).toFixed(1) : 0;
            
            info.innerHTML = `
                <div style="font-weight:bold; margin-bottom:12px; font-size:16px;">📦 ${box.userData.name || `Thùng ${box.userData.id}`}</div>
                
                <div style="background:#f8fafc; padding:12px; border-radius:12px; margin-bottom:12px;">
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
                        <div><span style="color:#64748b;">📏 Rộng:</span> <strong>${box.userData.width} cm</strong></div>
                        <div><span style="color:#64748b;">📏 Cao:</span> <strong>${box.userData.height} cm</strong></div>
                        <div><span style="color:#64748b;">📏 Dài:</span> <strong>${box.userData.depth} cm</strong></div>
                        <div><span style="color:#64748b;">📐 Thể tích:</span> <strong>${volume.toFixed(3)} m³</strong></div>
                        <div><span style="color:#64748b;">⚖️ Trọng lượng:</span> <strong>${box.userData.weight} kg</strong></div>
                        <div><span style="color:#64748b;">📊 Tỷ trọng:</span> <strong>${density} kg/m³</strong></div>
                    </div>
                </div>
                
                <div style="background:#f8fafc; padding:12px; border-radius:12px; margin-bottom:12px;">
                    <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:8px; text-align:center;">
                        <div><span style="color:#64748b;">X:</span><br><strong>${box.position.x.toFixed(0)}</strong></div>
                        <div><span style="color:#64748b;">Y:</span><br><strong>${box.position.y.toFixed(0)}</strong></div>
                        <div><span style="color:#64748b;">Z:</span><br><strong>${box.position.z.toFixed(0)}</strong></div>
                    </div>
                    <div style="margin-top:8px; font-size:11px; color:#64748b; text-align:center;">Vị trí (cm)</div>
                </div>
                
                <div style="display:flex; gap:8px; flex-wrap:wrap; margin-bottom:12px;">
                    ${box.userData.destination ? `<span style="background:#dbeafe; color:#1d4ed8; padding:4px 10px; border-radius:20px; font-size:12px;">📍 ${box.userData.destination}</span>` : ''}
                    ${box.userData.group ? `<span style="background:#e0f2fe; color:#0369a1; padding:4px 10px; border-radius:20px; font-size:12px;">🧩 ${box.userData.group}</span>` : ''}
                    ${box.userData.priority ? `<span style="background:#ffedd5; color:#c2410c; padding:4px 10px; border-radius:20px; font-size:12px;">🎯 Priority ${box.userData.priority}</span>` : ''}
                    ${box.userData.sku ? `<span style="background:#eef2ff; color:#4338ca; padding:4px 10px; border-radius:20px; font-size:12px;">🏷️ ${box.userData.sku}</span>` : ''}
                    ${box.userData.fragile ? '<span style="background:#fef3c7; color:#d97706; padding:4px 10px; border-radius:20px; font-size:12px;">⚠️ Dễ vỡ</span>' : ''}
                    ${box.userData.hazardous ? '<span style="background:#fee2e2; color:#dc2626; padding:4px 10px; border-radius:20px; font-size:12px;">☠️ Nguy hiểm</span>' : ''}
                    ${box.userData.category === 'heavy' ? '<span style="background:#d1fae5; color:#059669; padding:4px 10px; border-radius:20px; font-size:12px;">⚡ Hàng nặng</span>' : ''}
                </div>
                
                <div class="box-controls" style="display:flex; gap:8px; margin-top:8px;">
                    <button class="box-control-btn move-up" style="background:var(--primary); color:white; border:none; padding:8px 12px; border-radius:8px; cursor:pointer; flex:1;">⬆️ Lên</button>
                    <button class="box-control-btn move-down" style="background:var(--primary); color:white; border:none; padding:8px 12px; border-radius:8px; cursor:pointer; flex:1;">⬇️ Xuống</button>
                    <button class="box-control-btn duplicate-box" style="background:var(--secondary); color:white; border:none; padding:8px 12px; border-radius:8px; cursor:pointer; flex:1;">📋 Nhân bản</button>
                    <button class="box-control-btn delete-box" style="background:var(--danger); color:white; border:none; padding:8px 12px; border-radius:8px; cursor:pointer; flex:1;">🗑️ Xóa</button>
                </div>
                
                <div style="margin-top:12px; padding-top:8px; border-top:1px solid #e2e8f0; font-size:10px; color:#94a3b8;">
                    💡 Mẹo: Di chuột lên thùng để xem thông tin nhanh | Kéo thả để di chuyển
                </div>
            `;
            
            // Add event listeners
            const moveUpBtn = info.querySelector('.move-up');
            const moveDownBtn = info.querySelector('.move-down');
            const duplicateBtn = info.querySelector('.duplicate-box');
            const deleteBtn = info.querySelector('.delete-box');
            
            if (moveUpBtn) moveUpBtn.addEventListener('click', () => moveBoxUp(selectedBox));
            if (moveDownBtn) moveDownBtn.addEventListener('click', () => moveBoxDown(selectedBox));
            if (duplicateBtn) duplicateBtn.addEventListener('click', () => duplicateSelectedBox());
            if (deleteBtn) deleteBtn.addEventListener('click', () => {
                deleteBox(selectedBox);
                selectedBox = null;
                document.getElementById('infoPanel').style.display = 'none';
                showNotification('Đã xóa thùng hàng', 'success');
            });
            
            document.getElementById('infoPanel').style.display = 'block';
        }
        
        // Cập nhật container visual với màu sáng hơn
        function updateContainerVisual() {
            if (!containerGroup) return;
            containerGroup.clear();
            
            const W = currentContainer.w;
            const H = currentContainer.h;
            const D = currentContainer.d;
            const opacity = document.getElementById('opacitySlider')?.value || 0.2;
            const containerColor = currentContainer.color || 0x3b82f6;
            
            // Update opacity display
            const opacityValueSpan = document.getElementById('opacityValue');
            if (opacityValueSpan) opacityValueSpan.innerHTML = `${Math.round(opacity * 100)}%`;
            
            // Container body với độ trong suốt cao hơn
            const material = new THREE.MeshStandardMaterial({
                color: containerColor,
                transparent: true,
                opacity: parseFloat(opacity),
                roughness: 0.3,
                metalness: 0.2,
                side: THREE.DoubleSide,
                emissive: new THREE.Color(containerColor),
                emissiveIntensity: 0.05
            });
            
            const bodyGeo = new THREE.BoxGeometry(W, H, D);
            const body = new THREE.Mesh(bodyGeo, material);
            body.position.set(0, H/2, 0);
            body.castShadow = true;
            body.receiveShadow = false;
            containerGroup.add(body);
            
            // Edges với màu nổi bật
            const edgesGeo = new THREE.EdgesGeometry(bodyGeo);
            const edgesMat = new THREE.LineBasicMaterial({ color: 0x3b82f6, linewidth: 2 });
            const wireframe = new THREE.LineSegments(edgesGeo, edgesMat);
            wireframe.position.copy(body.position);
            containerGroup.add(wireframe);
            
            // Corner markers sáng
            const cornerMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, emissive: 0xf59e0b, emissiveIntensity: 0.2 });
            const corners = [
                [-W/2, 0, -D/2], [W/2, 0, -D/2], [-W/2, 0, D/2], [W/2, 0, D/2],
                [-W/2, H, -D/2], [W/2, H, -D/2], [-W/2, H, D/2], [W/2, H, D/2]
            ];
            corners.forEach(pos => {
                const corner = new THREE.Mesh(new THREE.BoxGeometry(8, 8, 8), cornerMat);
                corner.position.set(pos[0], pos[1], pos[2]);
                corner.castShadow = true;
                containerGroup.add(corner);
            });
            
            // Floor grid với màu sáng
            const floorGridMat = new THREE.LineBasicMaterial({ color: 0x60a5fa });
            for (let i = -W/2 + 20; i <= W/2 - 20; i += 20) {
                const lineGeo = new THREE.BufferGeometry().setFromPoints([
                    new THREE.Vector3(i, 0.1, -D/2 + 20),
                    new THREE.Vector3(i, 0.1, D/2 - 20)
                ]);
                const line = new THREE.Line(lineGeo, floorGridMat);
                containerGroup.add(line);
            }
            for (let i = -D/2 + 20; i <= D/2 - 20; i += 20) {
                const lineGeo = new THREE.BufferGeometry().setFromPoints([
                    new THREE.Vector3(-W/2 + 20, 0.1, i),
                    new THREE.Vector3(W/2 - 20, 0.1, i)
                ]);
                const line = new THREE.Line(lineGeo, floorGridMat);
                containerGroup.add(line);
            }
            
            // Door indicator
            const doorMat = new THREE.MeshStandardMaterial({ color: 0xccaa88 });
            const doorLeft = new THREE.Mesh(new THREE.BoxGeometry(15, H - 40, 5), doorMat);
            doorLeft.position.set(-W/2 + 20, H/2, D/2 + 2);
            containerGroup.add(doorLeft);
            
            const doorRight = new THREE.Mesh(new THREE.BoxGeometry(15, H - 40, 5), doorMat);
            doorRight.position.set(W/2 - 20, H/2, D/2 + 2);
            containerGroup.add(doorRight);
        }
        
        function initializeSceneInteractions() {
            setupBoxHighlight();
        }
        
        function deleteBox(box) {
            if (!box) return false;
            
            scene.remove(box);
            
            if (box.geometry) box.geometry.dispose();
            if (box.material) {
                if (box.material.map) box.material.map.dispose();
                box.material.dispose();
            }
            
            box.children.forEach(child => {
                if (child.isCSS2DObject) {
                    if (child.element) child.element.remove();
                    child.remove();
                }
            });
            
            const index = boxes.indexOf(box);
            if (index !== -1) {
                boxes.splice(index, 1);
            }
            
            if (selectedBox === box) {
                selectedBox = null;
                const infoPanel = document.getElementById('infoPanel');
                if (infoPanel) infoPanel.style.display = 'none';
            }
            
            updateStats();
            updateCOG();
            saveToHistory();
            
            return true;
        }
        
        function deleteAllBoxes(options = {}) {
            const { confirmClear = true, notify = true, saveHistory = true } = options;
            if (boxes.length === 0) return false;

            const boxCount = boxes.length;
            if (confirmClear && !confirm(`Bạn có chắc muốn xóa tất cả ${boxCount} thùng hàng?`)) {
                return false;
            }

            clearSceneBoxes({ saveHistory });
            if (notify) {
                showNotification(`Đã xóa ${boxCount} thùng hàng`, 'success');
            }
            return true;
        }
        
        function saveToHistory(snapshot = null) {
            const state = Array.isArray(snapshot)
                ? snapshot.map(entry => ({
                    userData: { ...entry.userData },
                    position: entry.position?.clone ? entry.position.clone() : new THREE.Vector3(entry.position?.x || 0, entry.position?.y || 0, entry.position?.z || 0),
                    rotation: entry.rotation?.clone ? entry.rotation.clone() : new THREE.Euler(entry.rotation?.x || 0, entry.rotation?.y || 0, entry.rotation?.z || 0)
                }))
                : boxes.map(b => ({
                    userData: { ...b.userData },
                    position: b.position.clone(),
                    rotation: b.rotation.clone()
                }));
            
            history = history.slice(0, historyIndex + 1);
            history.push(state);
            historyIndex++;
            
            if (history.length > 50) {
                history.shift();
                historyIndex--;
            }
            
            updateUndoRedoButtons();
            autoSaveToLocal();
        }
        
        function undo() {
            if (historyIndex <= 0) return;
            historyIndex--;
            restoreState(history[historyIndex]);
        }
        
        function redo() {
            if (historyIndex >= history.length - 1) return;
            historyIndex++;
            restoreState(history[historyIndex]);
        }
        
        function restoreState(state) {
            clearSceneBoxes();
            
            state.forEach(saved => {
                const newBox = createBox(saved.userData, saved.position, { recordUsage: false, skipHistory: true, ignoreLimit: true });
                if (newBox) {
                    const oriIndex = typeof saved.userData.orientationIndex === 'number' ? saved.userData.orientationIndex : 0;
                    applyOrientation(newBox, oriIndex, { skipSave: true, skipRecalc: true, skipSelection: true });
                    newBox.userData = { ...saved.userData, id: boxes.length + 1 };
                    newBox.rotation.set(0, 0, 0);
                }
            });
            
            selectedBox = null;
            updateStats();
            updateCOG();
            updateUndoRedoButtons();
        }
        
        function autoSaveToLocal() {
            try {
                const saveData = {
                    boxes: boxes.map(b => ({
                        userData: b.userData,
                        position: { x: b.position.x, y: b.position.y, z: b.position.z },
                        rotation: { x: b.rotation.x, y: b.rotation.y, z: b.rotation.z }
                    })),
                    container: currentContainer,
                    boxTypes: boxTypes,
                    manualLoadSettings: manualLoadSettings,
                    timestamp: Date.now()
                };
                localStorage.setItem('container_packing_autosave', JSON.stringify(saveData));
            } catch (e) {
                console.warn('Auto save failed:', e);
            }
        }
        
        function loadFromLocal() {
            try {
                const saved = localStorage.getItem('container_packing_autosave');
                if (saved && confirm('Tìm thấy bản lưu tự động từ trước. Bạn có muốn khôi phục?')) {
                    const data = JSON.parse(saved);
                    clearSceneBoxes();
                    
                    applyOptimizerContainerState(data.container, { silent: true });
                    
                    boxTypes = data.boxTypes || [];
                    updateBoxTypeList();

                    if (data.manualLoadSettings) {
                        manualLoadSettings = {
                            ...manualLoadSettings,
                            ...data.manualLoadSettings,
                            grid: Number(data.manualLoadSettings.grid) || manualLoadSettings.grid
                        };
                        updateManualLoadControls();
                    }
                    
                    data.boxes.forEach(savedBox => {
                        createBox(savedBox.userData, new THREE.Vector3(
                            savedBox.position.x,
                            savedBox.position.y,
                            savedBox.position.z
                        ), { recordUsage: false, skipHistory: true, ignoreLimit: true });
                    });
                    
                    updateStats();
                    updateCOG();
                    saveToHistory();
                    showNotification('Đã khôi phục dữ liệu từ bản lưu tự động', 'success');
                }
            } catch (e) {
                console.warn('Load from local failed:', e);
            }
        }
        
        function updateUndoRedoButtons() {
            const undoBtn = document.getElementById('btnUndo');
            const redoBtn = document.getElementById('btnRedo');
            if (undoBtn) {
                undoBtn.disabled = historyIndex <= 0;
                undoBtn.style.opacity = historyIndex <= 0 ? '0.5' : '1';
            }
            if (redoBtn) {
                redoBtn.disabled = historyIndex >= history.length - 1;
                redoBtn.style.opacity = historyIndex >= history.length - 1 ? '0.5' : '1';
            }
        }
        
        function updateStats() {
            const count = boxes.length;
            let totalVol = 0;
            let totalWeight = 0;
            
            boxes.forEach(b => {
                totalVol += b.userData.width * b.userData.height * b.userData.depth;
                totalWeight += b.userData.weight;
            });
            
            const containerVol = currentContainer.w * currentContainer.h * currentContainer.d;
            const volPercent = containerVol > 0 ? (totalVol / containerVol * 100) : 0;
            const weightPercent = currentContainer.maxLoad > 0 ? (totalWeight / currentContainer.maxLoad * 100) : 0;
            const volumeUsedM3 = totalVol / 1000000;
            const volumeLeftM3 = Math.max(containerVol - totalVol, 0) / 1000000;
            const weightLeft = Math.max(currentContainer.maxLoad - totalWeight, 0);
            
            // Update text elements
            const boxCountEl = document.getElementById('boxCount');
            const volumePercentEl = document.getElementById('volumePercent');
            const weightDisplayEl = document.getElementById('weightDisplay');
            const containerVolumeEl = document.getElementById('containerVolume');
            const maxLoadEl = document.getElementById('maxLoad');
            const perfVolumeUsed = document.getElementById('perfVolumeUsed');
            const perfVolumeLeft = document.getElementById('perfVolumeLeft');
            const perfVolumeRate = document.getElementById('perfVolumeRate');
            const perfVolumeLeftRate = document.getElementById('perfVolumeLeftRate');
            const perfWeightUsed = document.getElementById('perfWeightUsed');
            const perfWeightLeft = document.getElementById('perfWeightLeft');
            const perfWeightRate = document.getElementById('perfWeightRate');
            const perfWeightLeftRate = document.getElementById('perfWeightLeftRate');
            
            if (boxCountEl) boxCountEl.innerHTML = count;
            if (volumePercentEl) volumePercentEl.innerHTML = volPercent.toFixed(1);
            if (weightDisplayEl) weightDisplayEl.innerHTML = totalWeight.toLocaleString();
            if (containerVolumeEl) containerVolumeEl.innerHTML = (containerVol / 1000000).toFixed(2);
            if (maxLoadEl) maxLoadEl.innerHTML = currentContainer.maxLoad.toLocaleString();
            if (perfVolumeUsed) perfVolumeUsed.innerHTML = volumeUsedM3.toFixed(2);
            if (perfVolumeLeft) perfVolumeLeft.innerHTML = volumeLeftM3.toFixed(2);
            if (perfVolumeRate) perfVolumeRate.innerHTML = `${volPercent.toFixed(1)}%`;
            if (perfVolumeLeftRate) perfVolumeLeftRate.innerHTML = `${Math.max(0, 100 - volPercent).toFixed(1)}%`;
            if (perfWeightUsed) perfWeightUsed.innerHTML = totalWeight.toLocaleString();
            if (perfWeightLeft) perfWeightLeft.innerHTML = weightLeft.toLocaleString();
            if (perfWeightRate) perfWeightRate.innerHTML = `${weightPercent.toFixed(1)}%`;
            if (perfWeightLeftRate) perfWeightLeftRate.innerHTML = `${Math.max(0, 100 - weightPercent).toFixed(1)}%`;
            
            // Update progress bars
            const volBar = document.getElementById('volumeBar');
            const weightBar = document.getElementById('weightBar');
            if (volBar) {
                volBar.style.width = `${Math.min(volPercent, 100).toFixed(1)}%`;
                volBar.style.background = volPercent > 80 ? '#10b981' : (volPercent > 50 ? '#f59e0b' : '#3b82f6');
            }
            if (weightBar) {
                weightBar.style.width = `${Math.min(weightPercent, 100).toFixed(1)}%`;
                weightBar.style.background = weightPercent > 80 ? '#ef4444' : (weightPercent > 50 ? '#f59e0b' : '#10b981');
            }

            updateAxlePanel(totalWeight);
        }

        function updateAxlePanel(totalWeight = 0) {
            const axleContainer = document.getElementById('axleBars');
            if (!axleContainer) return;
            const axleData = computeAxleLoads();
            axleContainer.innerHTML = '';
            axleData.labels.forEach((label, idx) => {
                const val = axleData.loads[idx] || 0;
                const limit = axleData.limits[idx] || 1;
                const percent = Math.min((val / limit) * 100, 150);
                const bar = document.createElement('div');
                bar.className = 'axle-bar';
                bar.innerHTML = `
                    <div class="axle-progress"><div class="axle-fill" style="width:${percent}%; background:${percent>100 ? '#ef4444' : percent>80 ? '#f59e0b' : '#10b981'}"></div></div>
                    <div class="axle-value">${label}: ${val.toLocaleString()} / ${limit.toLocaleString()} kg</div>
                `;
                axleContainer.appendChild(bar);
            });
        }

        function computeAxleLoads() {
            const axlePairs = (currentContainer.axlePositions || [])
                .map((position, index) => ({
                    position: Number(position) || 0,
                    limit: Number((currentContainer.axleLimits || [])[index]) || 0
                }))
                .sort((a, b) => a.position - b.position);
            if (axlePairs.length === 0) {
                const total = boxes.reduce((sum, box) => sum + (box.userData.weight || 0), 0);
                const maxLoad = currentContainer.maxLoad || 0;
                return {
                    labels: ['Tổng'],
                    loads: [total],
                    limits: [maxLoad],
                    minLoads: [0],
                    maxLoads: [maxLoad],
                    ratios: [maxLoad ? total / maxLoad : 0],
                    safe: maxLoad ? total <= maxLoad + 0.001 : true
                };
            }
            const positions = axlePairs.map(pair => pair.position);
            const limits = axlePairs.map(pair => pair.limit);
            const loads = new Array(positions.length).fill(0);
            const d = currentContainer.d;
            boxes.forEach(b => {
                const w = b.userData.weight || 0;
                const z = b.position.z + d/2; // distance from door (rear) if door at -d/2
                let assigned = false;
                for (let i = 0; i < positions.length - 1; i++) {
                    const p1 = positions[i];
                    const p2 = positions[i+1];
                    if (z >= p1 && z <= p2) {
                        const ratio = (z - p1) / (p2 - p1);
                        loads[i] += w * (1 - ratio);
                        loads[i+1] += w * ratio;
                        assigned = true;
                        break;
                    }
                }
                if (!assigned) {
                    if (z < positions[0]) loads[0] += w;
                    else loads[loads.length - 1] += w;
                }
            });
            const labels = positions.map((p, idx) => `Trục ${idx+1}`);
            const minLoads = limits.map(() => 0);
            const maxLoads = limits.map(limit => Number(limit) || 0);
            const ratios = loads.map((load, idx) => {
                const limit = limits[idx] || 0;
                return limit ? load / limit : 0;
            });
            return {
                labels,
                loads,
                limits,
                minLoads,
                maxLoads,
                ratios,
                safe: ratios.every(ratio => ratio <= 1.001)
            };
        }
        
        // ==================== AI PACKING ALGORITHMS ====================
        class AdvancedPacker {
            constructor(container, items) {
                this.container = container;
                this.items = items;
                this.results = [];
            }
            
            wallBuilding() {
                const items = [...this.items].sort((a, b) => (b.width * b.height * b.depth) - (a.width * a.height * a.depth));
                const placed = [];
                let x = -this.container.w / 2, y = 0, z = -this.container.d / 2;
                let currentRowHeight = 0;
                
                for (const item of items) {
                    if (x + item.width <= this.container.w / 2) {
                        placed.push({ item, pos: { x: x + item.width / 2, y: y + item.height / 2, z: z + item.depth / 2 } });
                        x += item.width + 1;
                        currentRowHeight = Math.max(currentRowHeight, item.height);
                    } else if (z + item.depth <= this.container.d / 2) {
                        x = -this.container.w / 2;
                        z += currentRowHeight + 1;
                        currentRowHeight = 0;
                        if (x + item.width <= this.container.w / 2) {
                            placed.push({ item, pos: { x: x + item.width / 2, y: y + item.height / 2, z: z + item.depth / 2 } });
                            x += item.width + 1;
                            currentRowHeight = item.height;
                        }
                    } else if (y + item.height <= this.container.h) {
                        y += currentRowHeight + 1;
                        x = -this.container.w / 2;
                        z = -this.container.d / 2;
                        currentRowHeight = 0;
                        placed.push({ item, pos: { x: x + item.width / 2, y: y + item.height / 2, z: z + item.depth / 2 } });
                        x += item.width + 1;
                        currentRowHeight = item.height;
                    }
                }
                return { name: 'Xây tường', placed, count: placed.length, volume: this.calcVolume(placed) };
            }
            
            layerByLayer() {
                const items = [...this.items].sort((a, b) => b.height - a.height);
                const placed = [];
                let currentY = 0;
                
                while (items.length > 0 && currentY < this.container.h) {
                    let x = -this.container.w / 2, z = -this.container.d / 2;
                    let layerHeight = 0;
                    let layerItems = [];
                    
                    for (let i = 0; i < items.length; i++) {
                        const item = items[i];
                        if (item.height <= this.container.h - currentY) {
                            if (x + item.width <= this.container.w / 2) {
                                layerItems.push({ item, x, z });
                                x += item.width + 1;
                                layerHeight = Math.max(layerHeight, item.height);
                                items.splice(i, 1);
                                i--;
                            } else if (z + item.depth <= this.container.d / 2) {
                                x = -this.container.w / 2;
                                z += layerHeight + 1;
                                layerItems.push({ item, x, z });
                                x += item.width + 1;
                                layerHeight = Math.max(layerHeight, item.height);
                                items.splice(i, 1);
                                i--;
                            }
                        }
                    }
                    
                    layerItems.forEach(l => {
                        placed.push({ item: l.item, pos: { x: l.x + l.item.width / 2, y: currentY + l.item.height / 2, z: l.z + l.item.depth / 2 } });
                    });
                    currentY += layerHeight + 1;
                }
                return { name: 'Xếp lớp', placed, count: placed.length, volume: this.calcVolume(placed) };
            }
            
            guillotine() {
                const items = [...this.items].sort((a, b) => (b.width * b.depth) - (a.width * a.depth));
                const placed = [];
                const spaces = [{ x: -this.container.w / 2, y: 0, z: -this.container.d / 2, w: this.container.w, h: this.container.h, d: this.container.d }];
                
                for (const item of items) {
                    let bestIdx = -1;
                    let bestFit = Infinity;
                    
                    for (let i = 0; i < spaces.length; i++) {
                        const s = spaces[i];
                        if (item.width <= s.w && item.height <= s.h && item.depth <= s.d) {
                            const fit = (s.w - item.width) + (s.h - item.height) + (s.d - item.depth);
                            if (fit < bestFit) {
                                bestFit = fit;
                                bestIdx = i;
                            }
                        }
                    }
                    
                    if (bestIdx >= 0) {
                        const s = spaces[bestIdx];
                        placed.push({ item, pos: { x: s.x + item.width / 2, y: s.y + item.height / 2, z: s.z + item.depth / 2 } });
                        spaces.splice(bestIdx, 1);
                        
                        if (s.w - item.width > 0) {
                            spaces.push({ x: s.x + item.width + 1, y: s.y, z: s.z, w: s.w - item.width - 1, h: s.h, d: item.depth });
                        }
                        if (s.d - item.depth > 0) {
                            spaces.push({ x: s.x, y: s.y, z: s.z + item.depth + 1, w: s.w, h: s.h, d: s.d - item.depth - 1 });
                        }
                        if (s.h - item.height > 0) {
                            spaces.push({ x: s.x, y: s.y + item.height + 1, z: s.z, w: s.w, h: s.h - item.height - 1, d: s.d });
                        }
                        
                        spaces.sort((a, b) => (b.w * b.h * b.d) - (a.w * a.h * a.d));
                    }
                }
                return { name: 'Guillotine', placed, count: placed.length, volume: this.calcVolume(placed) };
            }
            
            genetic() {
                const items = [...this.items];
                let best = { fitness: 0, order: [...Array(items.length).keys()] };
                
                for (let gen = 0; gen < 50; gen++) {
                    const order = [...best.order];
                    for (let i = 0; i < order.length; i++) {
                        if (Math.random() < 0.1) {
                            const j = Math.floor(Math.random() * order.length);
                            [order[i], order[j]] = [order[j], order[i]];
                        }
                    }
                    const fitness = this.calcFitness(order, items);
                    if (fitness > best.fitness) {
                        best = { fitness, order: [...order] };
                    }
                }
                
                const placed = [];
                let x = -this.container.w / 2, y = 0, z = -this.container.d / 2;
                let rowHeight = 0;
                
                for (const idx of best.order) {
                    const item = items[idx];
                    if (x + item.width <= this.container.w / 2) {
                        placed.push({ item, pos: { x: x + item.width / 2, y: y + item.height / 2, z: z + item.depth / 2 } });
                        x += item.width + 1;
                        rowHeight = Math.max(rowHeight, item.height);
                    } else if (z + item.depth <= this.container.d / 2) {
                        x = -this.container.w / 2;
                        z += rowHeight + 1;
                        rowHeight = 0;
                        placed.push({ item, pos: { x: x + item.width / 2, y: y + item.height / 2, z: z + item.depth / 2 } });
                        x += item.width + 1;
                        rowHeight = item.height;
                    } else if (y + item.height <= this.container.h) {
                        y += rowHeight + 1;
                        x = -this.container.w / 2;
                        z = -this.container.d / 2;
                        rowHeight = 0;
                        placed.push({ item, pos: { x: x + item.width / 2, y: y + item.height / 2, z: z + item.depth / 2 } });
                        x += item.width + 1;
                        rowHeight = item.height;
                    }
                }
                return { name: 'Di truyền', placed, count: placed.length, volume: this.calcVolume(placed) };
            }
            
            calcVolume(placed) {
                const totalVol = placed.reduce((s, p) => s + (p.item.width * p.item.height * p.item.depth), 0);
                const containerVol = this.container.w * this.container.h * this.container.d;
                return containerVol > 0 ? (totalVol / containerVol) * 100 : 0;
            }
            
            calcFitness(order, items) {
                let x = -this.container.w / 2, y = 0, z = -this.container.d / 2;
                let count = 0;
                let rowHeight = 0;
                
                for (const idx of order) {
                    const item = items[idx];
                    if (x + item.width <= this.container.w / 2) {
                        x += item.width + 1;
                        count++;
                        rowHeight = Math.max(rowHeight, item.height);
                    } else if (z + item.depth <= this.container.d / 2) {
                        x = -this.container.w / 2;
                        z += rowHeight + 1;
                        rowHeight = 0;
                        count++;
                    } else if (y + item.height <= this.container.h) {
                        y += rowHeight + 1;
                        x = -this.container.w / 2;
                        z = -this.container.d / 2;
                        rowHeight = 0;
                        count++;
                    } else break;
                }
                return count / items.length;
            }
            
            runAll() {
                this.results = [
                    this.wallBuilding(),
                    this.layerByLayer(),
                    this.guillotine(),
                    this.genetic()
                ];
                this.results.sort((a, b) => b.count - a.count);
                return this.results;
            }
        }
        
        function runAIBasic() {
            if (getActiveBoxTypes().length === 0 && boxes.length === 0) {
                showNotification('Vui lòng thêm thùng hàng trước', 'warning');
                return;
            }
            
            showNotification('🔄 Đang chạy AI Cơ bản...', 'info', 1500);
            
            const allBoxes = [];
            const plannedBoxTypes = getActiveBoxTypes();
            const sourceList = plannedBoxTypes.length > 0 ? plannedBoxTypes : boxes.map(b => b.userData);
            sourceList.forEach(bt => {
                const qty = bt.quantity || 1;
                for (let i = 0; i < qty; i++) allBoxes.push({ ...bt });
            });

            if (!allBoxes.length) {
                showNotification('Tat ca cargo dang bi exclude khoi shipment', 'warning');
                return;
            }
            
            allBoxes.sort((a, b) => (b.width * b.height * b.depth) - (a.width * a.height * a.depth));
            const rules = capturePlanningRules();
            if (!rules.priority.ignoreSeparation) {
                allBoxes.sort((a, b) => {
                    const priorityDiff = (a.priority || 3) - (b.priority || 3);
                    if (priorityDiff !== 0) return priorityDiff;
                    return (b.width * b.height * b.depth) - (a.width * a.height * a.depth);
                });
            }
            
            clearSceneBoxes();
            
            let x = -currentContainer.w / 2, y = 0, z = -currentContainer.d / 2;
            let rowHeight = 0;
            let packed = 0;
            
            for (const box of allBoxes) {
                if (x + box.width <= currentContainer.w / 2) {
                    createBox(box, new THREE.Vector3(x + box.width / 2, y + box.height / 2, z + box.depth / 2), { skipHistory: true });
                    x += box.width + 1;
                    rowHeight = Math.max(rowHeight, box.height);
                    packed++;
                } else if (z + box.depth <= currentContainer.d / 2) {
                    x = -currentContainer.w / 2;
                    z += rowHeight + 1;
                    rowHeight = 0;
                    createBox(box, new THREE.Vector3(x + box.width / 2, y + box.height / 2, z + box.depth / 2), { skipHistory: true });
                    x += box.width + 1;
                    rowHeight = box.height;
                    packed++;
                } else if (y + box.height <= currentContainer.h) {
                    y += rowHeight + 1;
                    x = -currentContainer.w / 2;
                    z = -currentContainer.d / 2;
                    rowHeight = 0;
                    createBox(box, new THREE.Vector3(x + box.width / 2, y + box.height / 2, z + box.depth / 2), { skipHistory: true });
                    x += box.width + 1;
                    rowHeight = box.height;
                    packed++;
                }
            }
            
            updateStats();
            saveToHistory();
            showNotification(`✅ Đã xếp ${packed}/${allBoxes.length} thùng bằng AI cơ bản`, 'success');
        }
        
        async function runAIPro() {
            if (getActiveBoxTypes().length === 0 && boxes.length === 0) {
                showNotification("Vui lòng thêm thùng hàng trước", 'warning');
                return;
            }

            const token = localStorage.getItem('auth_token');
            if (!token) {
                showLoginModal();
                showNotification('Vui lòng đăng nhập để dùng AI Pro', 'warning');
                return;
            }

            showNotification('🔄 Đang tối ưu trên server...', 'info', 2000);

            const expandedItems = [];
            const plannedBoxTypes = getActiveBoxTypes();
            const sourceList = plannedBoxTypes.length > 0 ? plannedBoxTypes : boxes.map(b => b.userData);
            if (!sourceList.length) {
                showNotification('Tat ca cargo dang bi exclude khoi shipment', 'warning');
                return;
            }
            sourceList.forEach(bt => {
                const qty = bt.quantity || 1;
                for (let i = 0; i < qty; i++) {
                    expandedItems.push({
                        name: bt.name || `Box ${expandedItems.length + 1}`,
                        width: bt.width,
                        height: bt.height,
                        depth: bt.depth,
                        weight: bt.weight || 1,
                        priority: bt.priority || 3,
                        rotatable: bt.rotatable !== false,
                        tiltable: bt.tiltable !== false,
                        stackable: bt.stackable !== false,
                        destination: bt.destination || ''
                    });
                }
            });

            const payload = {
                items: expandedItems,
                container: {
                    width: currentContainer.w,
                    height: currentContainer.h,
                    depth: currentContainer.d,
                    maxLoad: currentContainer.maxLoad || 29500,
                    axlePositions: currentContainer.axlePositions || [],
                    axleLimits: currentContainer.axleLimits || [],
                    allowOverhangPercent: currentContainer.allowOverhangPercent || 0
                },
                constraints: {
                    grid: 5,
                    ...capturePlanningRules()
                }
            };

            try {
                const res = await fetch('/api/optimize', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(payload)
                });
                const data = await res.json();
                if (!data.success) throw new Error(data.message || 'Tối ưu thất bại');

                const solution = data.data?.bestSolution || data.data?.solutions?.[0];
                if (!solution) throw new Error('Không nhận được kết quả tối ưu');

                const stepPlan = solution.stepPlan || [];
                const boxesResult = solution.boxes || [];
                clearSceneBoxes();
                if (stepPlan.length) {
                    lastStepPlan = stepPlan.map(s => ({
                        name: s.name,
                        destination: s.destination,
                        position: s.position,
                        weight: s.weight,
                        width: s.width || s.w,
                        height: s.height || s.h,
                        depth: s.depth || s.d,
                        priority: s.priority || 3,
                        group: s.group || '',
                        sku: s.sku || ''
                    }));
                    renderStepPlan();
                    playStepPlan(stepPlan);
                } else if (boxesResult.length) {
                    lastStepPlan = [];
                    renderStepPlan();
                    boxesResult.forEach((b, idx) => {
                        createBox({
                            name: b.name || `Thùng ${idx + 1}`,
                            width: b.w,
                            height: b.h,
                            depth: b.d,
                            weight: b.weight || 1
                        }, new THREE.Vector3(
                            b.x - currentContainer.w / 2 + b.w / 2,
                            b.y + b.h / 2,
                            b.z - currentContainer.d / 2 + b.d / 2
                        ), { skipHistory: true });
                    });
                } else {
                    lastStepPlan = [];
                    renderStepPlan();
                }

                showNotification(`🏆 AI Pro hoàn thành: ${(boxesResult.length || stepPlan.length)} thùng`, 'success', 2500);

                const strategyDiv = document.getElementById('strategyComparison');
                if (strategyDiv && solution.fitness) {
                    strategyDiv.innerHTML = `
                        <div class="strategy-result" style="padding:6px 0;">
                            <strong>Hiệu suất thể tích:</strong> ${(solution.fitness.volume * 100).toFixed(1)}%
                            &nbsp;|&nbsp; <strong>Tải trọng:</strong> ${(solution.fitness.weight * 100).toFixed(1)}%
                            &nbsp;|&nbsp; <strong>COG cân bằng:</strong> ${(solution.fitness.balance * 100).toFixed(1)}%
                            ${solution.fitness.axle !== undefined ? `&nbsp;|&nbsp; <strong>Axle:</strong> ${(solution.fitness.axle * 100).toFixed(1)}%` : ''}
                        </div>
                    `;
                }
                if (solution.axle?.loads || solution.fitness?.axleLoads) {
                    const axleData = solution.axle || { loads: solution.fitness.axleLoads, limits: currentContainer.axleLimits || [] };
                    renderAxleFromServer(axleData);
                }
                updateCOG();
                updateStats();
                const historySnapshot = boxesResult.length
                    ? buildHistorySnapshotFromLayoutBoxes(boxesResult)
                    : buildHistorySnapshotFromStepPlan(stepPlan);
                saveToHistory(historySnapshot);
            } catch (err) {
                console.error(err);
                showNotification('AI Pro lỗi, chuyển sang thuật toán cục bộ', 'warning');
                smartPackBoxes();
            }
        }

        async function runMultiOptimize() {
            if (getActiveBoxTypes().length === 0 && boxes.length === 0) {
                showNotification("Vui lòng thêm thùng hàng trước", 'warning');
                return;
            }
            const token = localStorage.getItem('auth_token');
            if (!token) { showLoginModal(); return; }

            const selected = Array.from(document.querySelectorAll('.multi-container:checked')).map(i => i.value);
            if (selected.length === 0) {
                showNotification('Chọn ít nhất một loại container/xe', 'warning');
                return;
            }

            const expandedItems = [];
            const plannedBoxTypes = getActiveBoxTypes();
            const sourceList = plannedBoxTypes.length > 0 ? plannedBoxTypes : boxes.map(b => b.userData);
            if (!sourceList.length) {
                showNotification('Tat ca cargo dang bi exclude khoi shipment', 'warning');
                return;
            }
            sourceList.forEach(bt => {
                const qty = bt.quantity || 1;
                for (let i = 0; i < qty; i++) {
                    expandedItems.push({
                        name: bt.name || `Box ${expandedItems.length + 1}`,
                        width: bt.width,
                        height: bt.height,
                        depth: bt.depth,
                        weight: bt.weight || 1,
                        priority: bt.priority || 3,
                        rotatable: bt.rotatable !== false,
                        tiltable: bt.tiltable !== false,
                        stackable: bt.stackable !== false,
                        destination: bt.destination || ''
                    });
                }
            });

            const containerPresets = {
                '20dc': { id: '20dc', width: 235, height: 239, depth: 590, maxLoad: 28200, axlePositions: [200, 400], axleLimits: [14100, 14100], allowOverhangPercent: 0 },
                '40hc': { id: '40hc', width: 235, height: 269, depth: 1203, maxLoad: 29500, axlePositions: [200, 800], axleLimits: [14750, 14750], allowOverhangPercent: 0 },
                'flatbed2': { id: 'flatbed2', width: 245, height: 300, depth: 1200, maxLoad: 32000, axlePositions: [200, 900], axleLimits: [12000, 20000], allowOverhangPercent: 10 },
                'flatbed3': { id: 'flatbed3', width: 245, height: 300, depth: 1350, maxLoad: 36000, axlePositions: [200, 700, 1200], axleLimits: [12000, 14000, 14000], allowOverhangPercent: 8 }
            };
            const containers = selected.map(id => containerPresets[id]).filter(Boolean);

            showNotification('🧠 Đang so sánh các phương án...', 'info', 2000);

            try {
                const res = await fetch('/api/optimize/multi', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ items: expandedItems, containers, constraints: { grid: 5, ...capturePlanningRules() } })
                });
                const data = await res.json();
                if (!data.success) throw new Error(data.message || 'Tối ưu multi thất bại');

                const bestCandidate = data.data?.best || null;
                const bestSolution = bestCandidate?.bestSolution || bestCandidate?.solutions?.[0] || null;
                if (!bestCandidate || !bestSolution) throw new Error('Khong nhan duoc phuong an toi uu');

                const fitness = bestSolution.fitness || {};
                const boxesResult = bestSolution.boxes || [];
                const stepPlan = bestSolution.stepPlan || [];

                applyOptimizerContainerState(bestCandidate.container, { silent: true });
                clearSceneBoxes();
                if (stepPlan.length) {
                    lastStepPlan = stepPlan.map(step => ({
                        ...step,
                        width: step.width || step.w,
                        height: step.height || step.h,
                        depth: step.depth || step.d
                    }));
                    renderStepPlan();
                    playStepPlan(stepPlan);
                } else if (boxesResult.length) {
                    lastStepPlan = [];
                    renderStepPlan();
                    boxesResult.forEach((b, idx) => {
                        createBox({
                            name: b.name || `Thùng ${idx + 1}`,
                            width: b.w,
                            height: b.h,
                            depth: b.d,
                            weight: b.weight || 1
                        }, new THREE.Vector3(
                            b.x - currentContainer.w / 2 + b.w / 2,
                            b.y + b.h / 2,
                            b.z - currentContainer.d / 2 + b.d / 2
                        ), { skipHistory: true });
                    });
                } else {
                    lastStepPlan = [];
                    renderStepPlan();
                }

                updateBalanceBars(fitness);
                if (fitness.axleLoads || bestSolution?.axle?.loads) {
                    renderAxleFromServer(bestSolution.axle || { loads: fitness.axleLoads, limits: currentContainer.axleLimits || [] });
                }
                const strategyDiv = document.getElementById('strategyComparison');
                if (strategyDiv) {
                    const candidates = data.data?.candidates || [];
                    strategyDiv.innerHTML = candidates.map((candidate, index) => `
                        <div class="strategy-result" style="padding:6px 0;">
                            <strong>${index === 0 ? 'Phuong an chon' : `Phuong an ${index + 1}`}</strong>: ${escapeHTML(candidate.container?.name || candidate.container?.id || 'Container')}
                            &nbsp;|&nbsp; <strong>Utilization:</strong> ${((candidate.utilization || 0) * 100).toFixed(1)}%
                            &nbsp;|&nbsp; <strong>Score:</strong> ${(candidate.score || 0).toFixed(3)}
                            &nbsp;|&nbsp; <strong>Needed:</strong> ${candidate.neededContainers || 1}
                        </div>
                    `).join('');
                }
                showNotification(`🏆 Đã chọn ${bestCandidate.container?.name || currentContainer.name} là phương án tối ưu`, 'success', 2500);
                updateStats();
                updateCOG();
                const historySnapshot = boxesResult.length
                    ? buildHistorySnapshotFromLayoutBoxes(boxesResult)
                    : buildHistorySnapshotFromStepPlan(stepPlan);
                saveToHistory(historySnapshot);
            } catch (err) {
                console.error(err);
                showNotification('Multi-opt lỗi, thử lại hoặc chọn ít phương án hơn', 'warning');
            }
        }

        function updateBalanceBars(fitness = {}) {
            const lr = Math.max(0, Math.min(1, fitness.balance || 0));
            const fb = Math.max(0, Math.min(1, fitness.weight || 0));
            const cog = Math.max(0, Math.min(1, fitness.stability || 0));
            const barLR = document.getElementById('barLR'); const lblLR = document.getElementById('lblLR');
            const barFB = document.getElementById('barFB'); const lblFB = document.getElementById('lblFB');
            const barCOG = document.getElementById('barCOG'); const lblCOG = document.getElementById('lblCOG');
            if (barLR) { barLR.style.width = `${(1 - Math.abs(0.5 - lr) * 2) * 100}%`; barLR.style.background = lr > 0.8 ? '#10b981' : '#f59e0b'; }
            if (barFB) { barFB.style.width = `${(fb * 100).toFixed(1)}%`; barFB.style.background = fb > 0.8 ? '#10b981' : '#f59e0b'; }
            if (barCOG) { barCOG.style.width = `${(cog * 100).toFixed(1)}%`; barCOG.style.background = cog > 0.8 ? '#10b981' : '#f59e0b'; }
            if (lblLR) lblLR.innerText = `${(lr * 100).toFixed(1)}%`;
            if (lblFB) lblFB.innerText = `${(fb * 100).toFixed(1)}%`;
            if (lblCOG) lblCOG.innerText = `${(cog * 100).toFixed(1)}%`;
        }

        function playStepPlan(stepPlan) {
            if (!Array.isArray(stepPlan) || stepPlan.length === 0) return;
            initializeStepPlayback(stepPlan);
            startStepPlayback();
        }
        
        function generateRandomBoxes() {
    const isAdmin = currentUser && currentUser.role === 'admin';
    const maxBoxes = isAdmin ? Infinity : (currentUser?.subscription?.features?.maxBoxes || 50);
    const remainingSlots = maxBoxes === Infinity ? 20 : maxBoxes - boxes.length;
    const count = Math.min(20, remainingSlots);
    
    if (count <= 0) {
        showNotification(`Đã đạt giới hạn thùng!`, 'warning');
        return;
    }
            
            for (let i = 0; i < count; i++) {
                const randBox = {
                    name: `Random ${i + 1}`,
                    width: 30 + Math.floor(Math.random() * 70),
                    height: 30 + Math.floor(Math.random() * 70),
                    depth: 30 + Math.floor(Math.random() * 70),
                    weight: 10 + Math.floor(Math.random() * 50),
                    quantity: 1,
                    fragile: Math.random() > 0.85,
                    hazardous: Math.random() > 0.9,
                    category: ['normal', 'fragile', 'heavy'][Math.floor(Math.random() * 3)]
                };
                const pos = new THREE.Vector3(
                    -currentContainer.w/2 + randBox.width/2 + (Math.random() - 0.5) * 300,
                    randBox.height/2,
                    -currentContainer.d/2 + randBox.depth/2 + (Math.random() - 0.5) * 500
                );
                createBox(randBox, pos);
            }
            showNotification(`Đã tạo ${count} thùng ngẫu nhiên`, 'success');
        }
        
        function updateBoxTypeList() {
            const container = document.getElementById('boxTypeList');
            if (!container) return;
            
            if (boxTypes.length === 0) {
                container.innerHTML = '<div style="text-align:center; color:#999; padding:20px;">Chưa có loại thùng nào<br>Hãy thêm loại thùng bên trên</div>';
                refreshProfessionalPanels();
                return;
            }
            
            container.innerHTML = boxTypes.map((bt, idx) => `
                <div class="box-type-item ${bt.excluded ? 'excluded' : ''}" data-box-type-idx="${idx}" draggable="${bt.excluded ? 'false' : 'true'}" style="background:var(--gray-light); border-radius:12px; padding:12px; margin-bottom:8px; border-left:3px solid ${bt.excluded ? 'var(--gray)' : 'var(--primary)'};">
                    <div class="box-type-info">
                        <strong style="color:var(--primary);">${bt.name}</strong>
                        <span style="display:inline-block; font-size:11px; color:var(--gray); margin-right:12px;">📏 ${bt.width}x${bt.height}x${bt.depth} cm</span>
                        <span style="display:inline-block; font-size:11px; color:var(--gray); margin-right:12px;">⚖️ ${bt.weight} kg</span>
                        <span style="display:inline-block; font-size:11px; color:var(--gray); margin-right:12px;">🔢 SL: ${bt.quantity}</span>
                        <span style="display:inline-block; font-size:11px; color:var(--gray); margin-right:12px;">🚚 ${bt.destination || 'Kho chinh'}</span>
                        <span style="display:inline-block; font-size:11px; color:var(--gray); margin-right:12px;">🧩 ${bt.group || 'General'}</span>
                        <span style="display:inline-block; font-size:11px; color:var(--gray); margin-right:12px;">🎯 P${bt.priority || 3}</span>
                        ${bt.sku ? `<span style="display:inline-block; font-size:11px; color:var(--gray); margin-right:12px;">🏷️ ${bt.sku}</span>` : ''}
                        ${bt.fragile ? '<span class="badge fragile" style="background:#fef3c7; color:#d97706; padding:2px 8px; border-radius:12px; font-size:10px;">⚠️ Dễ vỡ</span>' : ''}
                        ${bt.hazardous ? '<span class="badge hazardous" style="background:#fee2e2; color:#dc2626; padding:2px 8px; border-radius:12px; font-size:10px;">☠️ Nguy hiểm</span>' : ''}
                    </div>
                    <div class="box-type-flags">
                        <span class="box-type-flag ${bt.excluded ? 'muted' : ''}">${bt.excluded ? '🚫 Excluded khỏi shipment' : '✋ Kéo card vào vùng 3D để manual load'}</span>
                        ${bt.fixedOrientation ? '<span class="box-type-flag">🔒 Fixed orientation</span>' : ''}
                        ${bt.rotatable === false ? '<span class="box-type-flag">⛔ Không xoay</span>' : ''}
                    </div>
                    <div class="box-type-actions" style="display:flex; gap:8px; margin-top:10px;">
                        <button class="manual-place-one" data-idx="${idx}" style="background:white; border:1px solid var(--gray-light); padding:6px 12px; border-radius:8px; font-size:11px; cursor:pointer;">✋ Dat tay</button>
                        <button class="create-batch" data-idx="${idx}" ${bt.excluded ? 'disabled' : ''} style="background:white; border:1px solid var(--gray-light); padding:6px 12px; border-radius:8px; font-size:11px; cursor:pointer;">📦 Dua vao layout</button>
                        <button class="load-type-form" data-idx="${idx}" style="background:white; border:1px solid var(--gray-light); padding:6px 12px; border-radius:8px; font-size:11px; cursor:pointer;">📝 Nap form</button>
                        <button class="toggle-exclude" data-idx="${idx}" style="background:white; border:1px solid var(--gray-light); padding:6px 12px; border-radius:8px; font-size:11px; cursor:pointer;">${bt.excluded ? '✅ Include' : '🚫 Exclude'}</button>
                        <button class="remove-type" data-idx="${idx}" style="background:white; border:1px solid var(--gray-light); padding:6px 12px; border-radius:8px; font-size:11px; cursor:pointer;">🗑️ Xóa loại</button>
                    </div>
                </div>
            `).join('');

            container.querySelectorAll('.box-type-item[data-box-type-idx]').forEach(card => {
                card.addEventListener('dragstart', event => {
                    const idx = Number(card.dataset.boxTypeIdx);
                    if (!Number.isInteger(idx) || boxTypes[idx]?.excluded) {
                        event.preventDefault();
                        return;
                    }
                    manualDragState.activeIndex = idx;
                    card.classList.add('drag-source');
                    event.dataTransfer?.setData('text/manual-box-type', String(idx));
                    event.dataTransfer.effectAllowed = 'copyMove';
                    showNotification('Keo item vao vung 3D de dat tay', 'info', 1000);
                });
                card.addEventListener('dragend', () => {
                    manualDragState.activeIndex = null;
                    card.classList.remove('drag-source');
                });
            });

            document.querySelectorAll('.manual-place-one').forEach(btn => {
                btn.addEventListener('click', () => {
                    const idx = parseInt(btn.dataset.idx, 10);
                    beginManualPlacement(idx);
                });
            });
            
            document.querySelectorAll('.create-batch').forEach(btn => {
                btn.addEventListener('click', () => {
                    const idx = parseInt(btn.dataset.idx);
                    const bt = boxTypes[idx];
                    if (!bt || bt.excluded) {
                        showNotification('Item nay dang bi exclude khoi shipment', 'warning');
                        return;
                    }
                    const maxBoxes = currentUser?.subscription?.features?.maxBoxes || 50;
                    if (boxes.length + bt.quantity > maxBoxes && maxBoxes !== Infinity) {
                        showNotification(`Giới hạn ${maxBoxes} thùng. Vui lòng nâng cấp!`, 'warning');
                        return;
                    }
                    for (let i = 0; i < bt.quantity; i++) {
                        const guess = new THREE.Vector3(
                            -currentContainer.w / 2 + bt.width / 2 + (Math.random() - 0.5) * 200,
                            bt.height / 2,
                            currentContainer.d / 2 - bt.depth / 2 - 20 - (i * ((Number(bt.depth) || 0) + 8))
                        );
                        const resolved = resolveManualPlacement(bt, guess);
                        if (resolved && !resolved.collision) createBox(resolved.boxType, resolved.position);
                        else createBox(bt, guess);
                    }
                    updateStats();
                    showNotification(`Đã tạo ${bt.quantity} thùng ${bt.name}`, 'success');
                });
            });

            document.querySelectorAll('.load-type-form').forEach(btn => {
                btn.addEventListener('click', () => {
                    const idx = parseInt(btn.dataset.idx, 10);
                    const bt = boxTypes[idx];
                    populateCargoTemplateForm(bt);
                    showNotification(`Da nap ${bt?.name || 'cargo'} vao form`, 'info', 1000);
                });
            });

            document.querySelectorAll('.toggle-exclude').forEach(btn => {
                btn.addEventListener('click', () => {
                    const idx = parseInt(btn.dataset.idx, 10);
                    const bt = boxTypes[idx];
                    if (!bt) return;
                    bt.excluded = !bt.excluded;
                    updateBoxTypeList();
                    showNotification(bt.excluded ? `Da exclude ${bt.name}` : `Da include lai ${bt.name}`, bt.excluded ? 'warning' : 'success', 1100);
                });
            });
            
            document.querySelectorAll('.remove-type').forEach(btn => {
                btn.addEventListener('click', () => {
                    const idx = parseInt(btn.dataset.idx);
                    boxTypes.splice(idx, 1);
                    updateBoxTypeList();
                    showNotification('Đã xóa loại thùng', 'info');
                });
            });
            refreshProfessionalPanels();
        }
        
        function compareContainers() {
            if (getActiveBoxTypes().length === 0 && boxes.length === 0) {
                showNotification('Vui lòng thêm thùng hàng trước', 'warning');
                return;
            }
            
            const allBoxes = [];
            const plannedBoxTypes = getActiveBoxTypes();
            const sourceList = plannedBoxTypes.length > 0 ? plannedBoxTypes : boxes.map(b => b.userData);
            sourceList.forEach(bt => {
                const qty = bt.quantity || 1;
                for (let i = 0; i < qty; i++) {
                    allBoxes.push({ volume: bt.width * bt.height * bt.depth, weight: bt.weight });
                }
            });
            
            const totalVolume = allBoxes.reduce((s, b) => s + b.volume, 0);
            const totalWeight = allBoxes.reduce((s, b) => s + b.weight, 0);
            
            const comparison = Object.entries(CONTAINER_TYPES).map(([key, cont]) => {
                const containerVol = cont.w * cont.h * cont.d;
                const neededByVol = Math.ceil(totalVolume / containerVol);
                const neededByWeight = Math.ceil(totalWeight / cont.maxLoad);
                const needed = Math.max(neededByVol, neededByWeight, 1);
                const utilization = (totalVolume / (containerVol * needed)) * 100;
                const weightUtil = (totalWeight / (cont.maxLoad * needed)) * 100;
                return { ...cont, key, needed, utilization, weightUtil, totalCost: needed * (cont.price || 500) };
            }).sort((a, b) => b.utilization - a.utilization);
            
            const best = comparison[0];
            
            const panel = document.getElementById('containerComparison');
            if (panel) {
                panel.innerHTML = `
                    <div class="comparison-table">
                        <div class="comparison-header" style="display:grid; grid-template-columns:1.5fr 1fr 0.8fr 1fr 1fr 1fr; gap:8px; padding:10px; background:var(--primary); color:white; border-radius:8px; margin-bottom:8px;">
                            <span>Loại</span><span>Kích thước</span><span>Số lượng</span><span>Hiệu suất V</span><span>Hiệu suất W</span><span>Chi phí</span>
                        </div>
                        ${comparison.map(c => `
                            <div class="comparison-row ${c === best ? 'recommended' : ''}" style="display:grid; grid-template-columns:1.5fr 1fr 0.8fr 1fr 1fr 1fr; gap:8px; padding:10px; border-bottom:1px solid rgba(0,0,0,0.05); align-items:center;">
                                <span><strong>${c.name}</strong></span>
                                <span>${c.w}x${c.h}x${c.d}</span>
                                <span>${c.needed}</span>
                                <span>${c.utilization.toFixed(1)}%</span>
                                <span>${c.weightUtil.toFixed(1)}%</span>
                                <span>${c.totalCost.toLocaleString()}đ</span>
                            </div>
                        `).join('')}
                    </div>
                    <div class="recommendation-note" style="margin-top:12px; padding:10px; background:rgba(16,185,129,0.1); border-radius:8px; border-left:3px solid #10b981;">
                        💡 <strong>Khuyến nghị:</strong> ${best.name} - ${best.needed} container, 
                        hiệu suất ${best.utilization.toFixed(1)}%, chi phí ${best.totalCost.toLocaleString()}đ
                    </div>
                `;
                panel.style.display = 'block';
            }
        }
        
        function suggestMaterials() {
            if (boxes.length === 0) {
                showNotification('Chưa có thùng hàng để đề xuất', 'warning');
                return;
            }
            
            const totalVolume = boxes.reduce((s, b) => s + (b.userData.width * b.userData.height * b.userData.depth), 0);
            const containerVol = currentContainer.w * currentContainer.h * currentContainer.d;
            const emptySpace = (containerVol - totalVolume) / 1000000;
            const fragileCount = boxes.filter(b => b.userData.fragile).length;
            const hazardousCount = boxes.filter(b => b.userData.hazardous).length;
            
            const suggestions = [];
            
            if (emptySpace > 0.5) {
                suggestions.push({
                    material: PACKING_MATERIALS.air_bag,
                    reason: `Khoảng trống ${emptySpace.toFixed(1)}m³ cần chèn cố định`,
                    quantity: Math.ceil(emptySpace * 2),
                    cost: Math.ceil(emptySpace * 2) * 50000
                });
            }
            
            if (fragileCount > 0) {
                suggestions.push({
                    material: PACKING_MATERIALS.foam_sheet,
                    reason: `${fragileCount} thùng hàng dễ vỡ cần đệm xốp`,
                    quantity: Math.ceil(fragileCount / 3),
                    cost: Math.ceil(fragileCount / 3) * 25000
                });
            }
            
            if (boxes.length > 10) {
                suggestions.push({
                    material: PACKING_MATERIALS.stretch_film,
                    reason: `Cố định ${boxes.length} thùng hàng`,
                    quantity: Math.ceil(boxes.length / 12),
                    cost: Math.ceil(boxes.length / 12) * 50000
                });
            }
            
            suggestions.push({
                material: PACKING_MATERIALS.corner_protector,
                reason: `Bảo vệ góc cạnh cho ${boxes.length} thùng`,
                quantity: boxes.length * 8,
                cost: boxes.length * 8 * 5000
            });
            
            if (hazardousCount > 0) {
                suggestions.push({
                    material: PACKING_MATERIALS.wood_pallet,
                    reason: `${hazardousCount} thùng hàng nguy hiểm cần kê pallet`,
                    quantity: hazardousCount,
                    cost: hazardousCount * 150000
                });
            }
            
            const totalCost = suggestions.reduce((s, i) => s + i.cost, 0);
            
            const panel = document.getElementById('materialSuggestions');
            if (panel) {
                panel.innerHTML = `
                    <h4 style="margin:0 0 12px 0">📦 Đề xuất vật liệu chèn lót</h4>
                    <div style="margin-bottom: 12px; padding: 8px; background: #e8f8f0; border-radius: 8px;">
                        <strong>📊 Phân tích:</strong><br>
                        Thể tích trống: ${emptySpace.toFixed(2)} m³<br>
                        Số thùng dễ vỡ: ${fragileCount} | Số thùng nguy hiểm: ${hazardousCount}
                    </div>
                    ${suggestions.map(s => `
                        <div class="material-item" style="background:white; padding:10px; border-radius:8px; margin-bottom:8px;">
                            <strong style="color:var(--primary);">${s.material.name}</strong>
                            <p style="font-size:11px; margin:6px 0; color:var(--gray);">${s.reason}</p>
                            <small>Số lượng: ${s.quantity} ${s.material.unit} | Chi phí: ${s.cost.toLocaleString()}đ</small>
                        </div>
                    `).join('')}
                    <div class="total-cost" style="margin-top:12px; padding:12px; background:linear-gradient(135deg, #10b981, #059669); color:white; border-radius:8px; text-align:center; font-weight:600;">💰 Tổng chi phí: ${totalCost.toLocaleString()}đ</div>
                `;
                panel.style.display = 'block';
            }
        }
        
        function exportPDF() {
            const totalVolume = boxes.reduce((s, b) => s + (b.userData.width * b.userData.height * b.userData.depth), 0);
            const totalWeight = boxes.reduce((s, b) => s + b.userData.weight, 0);
            const containerVol = currentContainer.w * currentContainer.h * currentContainer.d;
            const volumeUtil = (totalVolume / containerVol * 100).toFixed(1);
            const weightUtil = (totalWeight / currentContainer.maxLoad * 100).toFixed(1);
            
            let cog = { x: 0, y: 0, z: 0 };
            if (boxes.length > 0) {
                let totalW = 0;
                boxes.forEach(b => {
                    totalW += b.userData.weight;
                    cog.x += b.position.x * b.userData.weight;
                    cog.y += b.position.y * b.userData.weight;
                    cog.z += b.position.z * b.userData.weight;
                });
                cog.x /= totalW;
                cog.y /= totalW;
                cog.z /= totalW;
            }
            
            const printWindow = window.open('', '_blank');
            printWindow.document.write(`
                <!DOCTYPE html>
                <html>
                <head><title>Báo cáo xếp hàng container</title>
                <style>
                    body { font-family: 'Inter', Arial, sans-serif; margin: 40px; background: #f0f4ff; }
                    h1 { color: #1e293b; border-bottom: 3px solid #3b82f6; padding-bottom: 10px; }
                    h2 { color: #3b82f6; margin-top: 30px; }
                    table { border-collapse: collapse; width: 100%; margin: 15px 0; }
                    th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
                    th { background: #3b82f6; color: white; }
                    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; background: #ffffff; padding: 20px; border-radius: 10px; margin: 20px 0; }
                    .footer { margin-top: 50px; text-align: center; color: #64748b; font-size: 12px; border-top: 1px solid #ddd; padding-top: 20px; }
                </style>
                </head>
                <body>
                    <h1>🚛 BÁO CÁO XẾP HÀNG CONTAINER</h1>
                    <p><strong>Ngày tạo:</strong> ${new Date().toLocaleString('vi-VN')}</p>
                    <p><strong>Phần mềm:</strong> Container Packing Pro v${VERSION}</p>
                    
                    <h2>📦 THÔNG TIN CONTAINER</h2>
                    <div class="info-grid">
                        <div><strong>Loại container:</strong> ${currentContainer.name}</div>
                        <div><strong>Kích thước:</strong> ${currentContainer.w} x ${currentContainer.h} x ${currentContainer.d} cm</div>
                        <div><strong>Thể tích:</strong> ${(containerVol / 1000000).toFixed(2)} m³</div>
                        <div><strong>Tải trọng tối đa:</strong> ${currentContainer.maxLoad.toLocaleString()} kg</div>
                    </div>
                    
                    <h2>📊 THỐNG KÊ XẾP HÀNG</h2>
                    <div class="info-grid">
                        <div><strong>Tổng số thùng:</strong> ${boxes.length}</div>
                        <div><strong>Tổng thể tích:</strong> ${(totalVolume / 1000000).toFixed(2)} m³</div>
                        <div><strong>Tổng trọng lượng:</strong> ${totalWeight.toLocaleString()} kg</div>
                        <div><strong>Hiệu suất thể tích:</strong> ${volumeUtil}%</div>
                        <div><strong>Hiệu suất tải trọng:</strong> ${weightUtil}%</div>
                        <div><strong>Trọng tâm:</strong> X: ${cog.x.toFixed(1)} | Y: ${cog.y.toFixed(1)} | Z: ${cog.z.toFixed(1)} cm</div>
                    </div>
                    
                    <h2>📋 DANH SÁCH THÙNG HÀNG</h2>
                    <table>
                        <thead>
                            <tr><th>STT</th><th>Tên thùng</th><th>Kích thước</th><th>Trọng lượng</th><th>Vị trí</th></tr>
                        </thead>
                        <tbody>
                            ${boxes.map((b, i) => `
                                <tr>
                                    <td>${i+1}</td>
                                    <td>${b.userData.name || `Thùng ${b.userData.id}`}</td>
                                    <td>${b.userData.width}x${b.userData.height}x${b.userData.depth} cm</td>
                                    <td>${b.userData.weight} kg</td>
                                    <td>(${b.position.x.toFixed(0)}, ${b.position.y.toFixed(0)}, ${b.position.z.toFixed(0)})</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                    <div class="footer">Báo cáo được tạo bởi Container Packing Pro</div>
                </body>
                </html>
            `);
            printWindow.document.close();
            printWindow.print();
        }
        
        function exportCSV() {
            let csv = '\uFEFFSTT,Tên thùng,Rộng (cm),Cao (cm),Dài (cm),Thể tích (m³),Trọng lượng (kg),Vị trí X,Vị trí Y,Vị trí Z\n';
            boxes.forEach((b, i) => {
                const volume = (b.userData.width * b.userData.height * b.userData.depth) / 1000000;
                csv += `${i+1},"${b.userData.name || `Thùng ${b.userData.id}`}",${b.userData.width},${b.userData.height},${b.userData.depth},${volume.toFixed(3)},${b.userData.weight},${b.position.x.toFixed(0)},${b.position.y.toFixed(0)},${b.position.z.toFixed(0)}\n`;
            });
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `container-report-${Date.now()}.csv`;
            a.click();
            URL.revokeObjectURL(url);
            showNotification('Đã xuất file CSV', 'success');
        }
        
        function exportJSON() {
            const exportData = {
                version: VERSION,
                exportedAt: new Date().toISOString(),
                container: {
                    name: currentContainer.name,
                    code: currentContainer.code || '',
                    dimensions: { width: currentContainer.w, height: currentContainer.h, depth: currentContainer.d },
                    maxLoad: currentContainer.maxLoad
                },
                boxes: boxes.map(b => ({
                    name: b.userData.name,
                    dimensions: { width: b.userData.width, height: b.userData.height, depth: b.userData.depth },
                    weight: b.userData.weight,
                    position: { x: b.position.x, y: b.position.y, z: b.position.z },
                    rotation: { x: b.rotation.x, y: b.rotation.y, z: b.rotation.z },
                    fragile: b.userData.fragile || false,
                    hazardous: b.userData.hazardous || false,
                    category: b.userData.category
                })),
                boxTypes: boxTypes,
                manualLoadSettings: manualLoadSettings,
                cargoSpaces: {
                    custom: customCargoSpaces,
                    favorites: favoriteCargoSpaces
                },
                stats: {
                    totalBoxes: boxes.length,
                    totalVolume: boxes.reduce((s, b) => s + (b.userData.width * b.userData.height * b.userData.depth), 0) / 1000000,
                    totalWeight: boxes.reduce((s, b) => s + b.userData.weight, 0)
                }
            };
            
            const jsonStr = JSON.stringify(exportData, null, 2);
            const blob = new Blob([jsonStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `container-project-${Date.now()}.json`;
            a.click();
            URL.revokeObjectURL(url);
            showNotification('Đã xuất file JSON', 'success');
        }
        
        function importJSON(file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    
                    clearSceneBoxes();

                    if (data.cargoSpaces?.custom) {
                        customCargoSpaces = data.cargoSpaces.custom;
                        saveCustomCargoSpaces();
                    }
                    if (Array.isArray(data.cargoSpaces?.favorites)) {
                        favoriteCargoSpaces = data.cargoSpaces.favorites;
                        saveFavoriteCargoSpaces();
                    }
                    if (data.manualLoadSettings) {
                        manualLoadSettings = {
                            ...manualLoadSettings,
                            ...data.manualLoadSettings,
                            grid: Number(data.manualLoadSettings.grid) || manualLoadSettings.grid
                        };
                        saveManualLoadSettings();
                        updateManualLoadControls();
                    }
                    
                    if (data.container) {
                        if (data.container.code && getCargoSpaceByKey(data.container.code)) {
                            applyCargoSpaceToState(data.container.code, { silent: true, skipVisuals: true });
                        }
                        currentContainer = {
                            ...currentContainer,
                            code: data.container.code || currentContainer.code || '',
                            w: data.container.dimensions.width,
                            h: data.container.dimensions.height,
                            d: data.container.dimensions.depth,
                            maxLoad: data.container.maxLoad
                        };
                        updateContainerVisual();
                        renderCargoSpaceSelector(currentContainer.code || '40hc');
                        
                        const cw = document.getElementById('cw');
                        const ch = document.getElementById('ch');
                        const cd = document.getElementById('cd');
                        if (cw) cw.value = currentContainer.w;
                        if (ch) ch.value = currentContainer.h;
                        if (cd) cd.value = currentContainer.d;
                    }
                    
                    if (data.boxTypes) {
                        boxTypes = data.boxTypes;
                        updateBoxTypeList();
                    }

                    if (data.cargoSpaces?.custom) {
                        customCargoSpaces = data.cargoSpaces.custom;
                        saveCustomCargoSpaces();
                    }
                    if (Array.isArray(data.cargoSpaces?.favorites)) {
                        favoriteCargoSpaces = data.cargoSpaces.favorites;
                        saveFavoriteCargoSpaces();
                    }
                    if (data.manualLoadSettings) {
                        manualLoadSettings = {
                            ...manualLoadSettings,
                            ...data.manualLoadSettings,
                            grid: Number(data.manualLoadSettings.grid) || manualLoadSettings.grid
                        };
                        saveManualLoadSettings();
                        updateManualLoadControls();
                    }
                    
                    if (data.boxes) {
                        data.boxes.forEach(savedBox => {
                            const boxData = {
                                name: savedBox.name,
                                width: savedBox.dimensions.width,
                                height: savedBox.dimensions.height,
                                depth: savedBox.dimensions.depth,
                                weight: savedBox.weight,
                                fragile: savedBox.fragile,
                                hazardous: savedBox.hazardous,
                                category: savedBox.category || 'normal'
                            };
                            const box = createBox(boxData, new THREE.Vector3(
                                savedBox.position.x,
                                savedBox.position.y,
                                savedBox.position.z
                            ), { skipHistory: true });
                            if (savedBox.rotation) {
                                box.rotation.set(savedBox.rotation.x, savedBox.rotation.y, savedBox.rotation.z);
                            }
                        });
                    }
                    
                    updateStats();
                    updateCOG();
                    saveToHistory();
                    showNotification('Đã import dự án thành công', 'success');
                } catch (err) {
                    showNotification('Lỗi khi import file JSON', 'error');
                    console.error(err);
                }
            };
            reader.readAsText(file);
        }
        
        function setView(type) {
            switch(type) {
                case 'top': camera.position.set(0, 1500, 0); orbitControls.target.set(0, 0, 0); break;
                case 'front': camera.position.set(0, 400, 1800); orbitControls.target.set(0, 0, 0); break;
                case 'side': camera.position.set(1800, 400, 0); orbitControls.target.set(0, 0, 0); break;
                case 'isometric': camera.position.set(1200, 900, 1600); orbitControls.target.set(0, 0, 0); break;
            }
            orbitControls.update();
        }
        
        function showNotification(message, type = 'info', duration = 3000) {
            const container = document.getElementById('notification-container');
            if (!container) return;
            
            const notification = document.createElement('div');
            notification.className = `notification ${type}`;
            notification.innerHTML = message;
            container.appendChild(notification);
            
            setTimeout(() => {
                notification.style.animation = 'fadeOut 0.3s ease';
                setTimeout(() => notification.remove(), 300);
            }, duration);
        }
        
        // ==================== EVENT HANDLERS ====================
        function setupEventHandlers() {
            // Container type selector
            const contSelect = document.getElementById('contType');
            if (contSelect) {
                renderCargoSpaceSelector(currentContainer.code || '40hc');
                contSelect.onchange = (e) => {
                    applyCargoSpaceToState(e.target.value);
                };
            }

            const cargoSpaceFilterInput = document.getElementById('cargoSpaceFilter');
            if (cargoSpaceFilterInput) {
                cargoSpaceFilterInput.onchange = (event) => {
                    cargoSpaceFilter = event.target.value || 'all';
                    renderCargoSpaceSelector(getActiveCargoSpaceKey());
                };
            }

            const favoriteCargoSpaceBtn = document.getElementById('btnFavoriteCargoSpace');
            if (favoriteCargoSpaceBtn) favoriteCargoSpaceBtn.onclick = toggleFavoriteCargoSpace;

            const saveCargoSpaceBtn = document.getElementById('btnSaveCargoSpace');
            if (saveCargoSpaceBtn) saveCargoSpaceBtn.onclick = saveCurrentCargoSpaceAsCustom;
            
            const cwInput = document.getElementById('cw');
            const chInput = document.getElementById('ch');
            const cdInput = document.getElementById('cd');
            
            if (cwInput) cwInput.onchange = () => {
                currentContainer.w = parseFloat(cwInput.value);
                currentContainer.code = '';
                syncCargoSpaceActions('');
                updateContainerVisual();
                updateStats();
            };
            if (chInput) chInput.onchange = () => {
                currentContainer.h = parseFloat(chInput.value);
                currentContainer.code = '';
                syncCargoSpaceActions('');
                updateContainerVisual();
                updateStats();
            };
            if (cdInput) cdInput.onchange = () => {
                currentContainer.d = parseFloat(cdInput.value);
                currentContainer.code = '';
                syncCargoSpaceActions('');
                updateContainerVisual();
                updateStats();
            };
            
            // Add box type
            const addBoxBtn = document.getElementById('addBoxType');
            if (addBoxBtn) {
                addBoxBtn.onclick = () => {
                    const name = document.getElementById('boxTypeName').value.trim();
                    const width = parseFloat(document.getElementById('boxWidth').value);
                    const height = parseFloat(document.getElementById('boxHeight').value);
                    const depth = parseFloat(document.getElementById('boxDepth').value);
                    const weight = parseFloat(document.getElementById('boxWeight').value);
                    const quantity = parseInt(document.getElementById('boxQuantity').value);
                    const destination = (document.getElementById('boxDestination')?.value || '').trim();
                    const group = (document.getElementById('boxGroup')?.value || '').trim();
                    const priority = parseInt(document.getElementById('boxPriority')?.value || '3');
                    const sku = (document.getElementById('boxSku')?.value || '').trim();
                    
                    if (!width || !height || !depth || !weight || !quantity) {
                        showNotification('Vui lòng nhập đầy đủ thông tin', 'warning');
                        return;
                    }
                    
                    boxTypes.push({
                        name: name || `Thùng ${boxTypes.length + 1}`,
                        width, height, depth, weight, quantity,
                        fixedOrientation: document.getElementById('fixedOrientation').checked,
                        stackable: document.getElementById('stackable').checked,
                        tiltable: document.getElementById('tiltable').checked,
                        rotatable: document.getElementById('rotatable').checked,
                        fragile: document.getElementById('fragile').checked,
                        hazardous: document.getElementById('hazardous').checked,
                        destination,
                        group: group || destination || 'General',
                        priority,
                        sku,
                        category: document.getElementById('boxCategory').value,
                        excluded: document.getElementById('excludeFromShipment').checked
                    });
                    updateBoxTypeList();
                    showNotification(`Đã thêm loại thùng "${name || `Thùng ${boxTypes.length}`}"`, 'success');
                    
                    document.getElementById('boxTypeName').value = '';
                    document.getElementById('boxWidth').value = 60;
                    document.getElementById('boxHeight').value = 50;
                    document.getElementById('boxDepth').value = 80;
                    document.getElementById('boxWeight').value = 20;
                    document.getElementById('boxQuantity').value = 1;
                    document.getElementById('fixedOrientation').checked = false;
                    document.getElementById('stackable').checked = true;
                    document.getElementById('tiltable').checked = true;
                    document.getElementById('rotatable').checked = true;
                    document.getElementById('fragile').checked = false;
                    document.getElementById('hazardous').checked = false;
                    document.getElementById('excludeFromShipment').checked = false;
                    if (document.getElementById('boxDestination')) document.getElementById('boxDestination').value = '';
                    if (document.getElementById('boxGroup')) document.getElementById('boxGroup').value = '';
                    if (document.getElementById('boxPriority')) document.getElementById('boxPriority').value = '3';
                    if (document.getElementById('boxSku')) document.getElementById('boxSku').value = '';
                };
            }
            
            // AI buttons
            const btnAI = document.getElementById('btnAI');
            const btnAIPro = document.getElementById('btnAIPro');
            const btnMultiOptimize = document.getElementById('btnMultiOptimize');
            if (btnAI) btnAI.onclick = runAIBasic;
            if (btnAIPro) btnAIPro.onclick = runAIPro;
            if (btnMultiOptimize) btnMultiOptimize.onclick = runMultiOptimize;
            
            // Smart pack button
            const btnSmartPack = document.getElementById('btnSmartPack');
            if (btnSmartPack) btnSmartPack.onclick = smartPackBoxes;
            
            // Analysis buttons
            const optimizeBtn = document.getElementById('optimizeBtn');
            const suggestMaterialsBtn = document.getElementById('suggestMaterials');
            if (optimizeBtn) optimizeBtn.onclick = compareContainers;
            if (suggestMaterialsBtn) suggestMaterialsBtn.onclick = suggestMaterials;
            
            // Tools
            const btnClear = document.getElementById('btnClear');
            const btnRandom = document.getElementById('btnRandom20');
            const btnUndo = document.getElementById('btnUndo');
            const btnRedo = document.getElementById('btnRedo');
            const btnSave = document.getElementById('btnSave');
            const btnLoad = document.getElementById('btnLoad');
            const toggleLabelsBtn = document.getElementById('toggleLabels');
            
            if (btnClear) btnClear.onclick = deleteAllBoxes;
            if (btnRandom) btnRandom.onclick = generateRandomBoxes;
            if (btnUndo) btnUndo.onclick = undo;
            if (btnRedo) btnRedo.onclick = redo;
            if (btnSave) btnSave.onclick = exportJSON;
            if (btnLoad) {
                btnLoad.onclick = () => {
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.accept = '.json';
                    input.onchange = (e) => {
                        if (e.target.files.length) importJSON(e.target.files[0]);
                    };
                    input.click();
                };
            }
// ✅ EXCEL DRAG-DROP IMPORT UPGRADE
async function setupExcelImport() {
  const dropZone = document.getElementById('excelDropZone');
  const fileInput = document.getElementById('excelFileInput');
  const browseBtn = document.getElementById('excelBrowseBtn');
  
  if (!dropZone || !fileInput || !browseBtn) return;
  
  // Click to browse
  browseBtn.onclick = () => fileInput.click();
  dropZone.onclick = (e) => {
    if (!dropZone.classList.contains('dragover')) fileInput.click();
  };
  
  // File input change
  fileInput.onchange = (e) => importExcelFile(e.target.files[0]);
  
  // Drag events
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, preventDefaults, false);
  });
  
  function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
  }
  
  ['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, () => dropZone.classList.add('dragover'), false);
  });
  
  ['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, () => dropZone.classList.remove('dragover'), false);
  });
  
  dropZone.ondrop = (e) => {
    const file = e.dataTransfer.files[0];
    if (file && (file.name.match(/\\.xlsx?$/i))) {
      importExcelFile(file);
    } else {
      showNotification('Chỉ hỗ trợ file Excel (.xlsx, .xls)', 'warning');
    }
  };
}

// Enhanced Excel import
async function importExcelFile(file) {
  if (!file) return;
  
  showNotification('Đang đọc file Excel...', 'info');
  
  const formData = new FormData();
  formData.append('file', file);
  
  try {
    const token = localStorage.getItem('auth_token');
    const res = await fetch('/api/import/excel', {
      method: 'POST',
      headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      body: formData
    });
    
    const data = await res.json();
    
    if (data.success && Array.isArray(data.data) && data.data.length > 0) {
      // Clear existing and add imported
      boxTypes = data.data.map((row, index) => ({
        name: row.name || `Thùng ${index + 1}`,
        width: Number(row.width) || 60,
        height: Number(row.height) || 50,
        depth: Number(row.depth) || 80,
        weight: Number(row.weight) || 20,
        quantity: Math.max(1, Number(row.quantity) || 1),
        destination: row.destination || '',
        group: row.group || 'Nhóm 1',
        priority: Number(row.priority) || 3,
        sku: row.sku || `EXCEL-${Date.now()}-${index}`,
        category: row.category || 'normal',
        stackable: row.stackable !== false,
        tiltable: row.tiltable !== false,
        rotatable: row.rotatable !== false
      }));
      
      updateBoxTypeList();
      refreshProfessionalPanels();
      updateStats();
      showNotification(`✅ Import thành công ${data.data.length} thùng từ Excel!`, 'success', 4000);
    } else {
      showNotification(data.message || 'Import thất bại - kiểm tra định dạng Excel', 'error');
    }
  } catch (err) {
    console.error('Excel import error:', err);
    showNotification('❌ Lỗi server. Thử template Excel hoặc kiểm tra kết nối.', 'error');
  }
}

// Init Excel import on DOM ready (add to existing DOMContentLoaded)
setupExcelImport();
            if (btnImportExcel) {
                btnImportExcel.onclick = () => {
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.accept = '.xlsx,.xls';
                    input.onchange = (e) => {
                        if (e.target.files.length) importExcelFile(e.target.files[0]);
                    };
                    input.click();
                };
            }
            if (toggleLabelsBtn) toggleLabelsBtn.onclick = toggleLabels;
            
            // View controls
            const viewTop = document.getElementById('viewTop');
            const viewFront = document.getElementById('viewFront');
            const viewSide = document.getElementById('viewSide');
            const viewIsometric = document.getElementById('viewIsometric');
            const btnResetView = document.getElementById('btnResetView');
            
            if (viewTop) viewTop.onclick = () => setView('top');
            if (viewFront) viewFront.onclick = () => setView('front');
            if (viewSide) viewSide.onclick = () => setView('side');
            if (viewIsometric) viewIsometric.onclick = () => setView('isometric');
            if (btnResetView) btnResetView.onclick = () => setView('isometric');
            
            // Mode buttons
            const btnModeMove = document.getElementById('btnModeMove');
            const btnModeRotate = document.getElementById('btnModeRotate');
            
            if (btnModeMove) {
                btnModeMove.onclick = () => {
                    btnModeMove.classList.add('active');
                    if (btnModeRotate) btnModeRotate.classList.remove('active');
                    rotationMode = false;
                    showNotification('Chế độ di chuyển - Kéo thả trực tiếp', 'info', 1500);
                };
            }
            if (btnModeRotate) {
                btnModeRotate.onclick = () => {
                    btnModeRotate.classList.add('active');
                    if (btnModeMove) btnModeMove.classList.remove('active');
                    rotationMode = true;
                    showNotification('Chế độ xoay 6 mặt: click vào thùng để đổi mặt', 'info', 1500);
                };
            }

            const snapBtn = document.getElementById('btnSnapMagnet');
            if (snapBtn) {
                snapBtn.onclick = () => {
                    manualLoadSettings.snapMagnet = !manualLoadSettings.snapMagnet;
                    saveManualLoadSettings();
                    updateManualLoadControls();
                    showNotification(manualLoadSettings.snapMagnet ? 'Da bat magnet snap' : 'Da tat magnet snap', 'info', 1000);
                };
            }

            const autoRotateBtn = document.getElementById('btnAutoRotateManual');
            if (autoRotateBtn) {
                autoRotateBtn.onclick = () => {
                    manualLoadSettings.autoRotate = !manualLoadSettings.autoRotate;
                    saveManualLoadSettings();
                    updateManualLoadControls();
                    showNotification(manualLoadSettings.autoRotate ? 'Da bat auto rotate khi dat tay' : 'Da tat auto rotate khi dat tay', 'info', 1000);
                };
            }

            const manualGridSize = document.getElementById('manualGridSize');
            if (manualGridSize) {
                manualGridSize.onchange = () => {
                    manualLoadSettings.grid = Number(manualGridSize.value) || 10;
                    saveManualLoadSettings();
                    updateManualLoadControls();
                    showNotification(`Da doi grid manual load sang ${manualLoadSettings.grid} cm`, 'info', 1000);
                };
            }
            
            // Export
            const exportPDFBtn = document.getElementById('exportPDF');
            const exportCSVBtn = document.getElementById('exportCSV');
            const exportServerPDFBtn = document.getElementById('exportServerPDF');
            const shareLinkBtn = document.getElementById('shareLink');
            const btnScreenshot = document.getElementById('btnScreenshot');

            if (exportPDFBtn) exportPDFBtn.onclick = exportPDF;
            if (exportCSVBtn) exportCSVBtn.onclick = exportCSV;
            if (exportServerPDFBtn) exportServerPDFBtn.onclick = exportServerReport;
            if (shareLinkBtn) shareLinkBtn.onclick = shareProjectLink;
            if (btnScreenshot) {
                btnScreenshot.onclick = () => {
                    if (renderer) {
                        renderer.render(scene, camera);
                        const link = document.createElement('a');
                        link.download = `screenshot-${Date.now()}.png`;
                        link.href = renderer.domElement.toDataURL();
                        link.click();
                        showNotification('Đã chụp ảnh màn hình', 'success');
                    }
                };
            }
            
            // Toggle sidebar
            const toggleSidebar = document.getElementById('toggleSidebar');
            const sidebar = document.getElementById('sidebar');
            if (toggleSidebar && sidebar) {
                toggleSidebar.onclick = () => {
                    sidebar.classList.toggle('collapsed');
                };
            }
            
            // Opacity slider
            const opacitySlider = document.getElementById('opacitySlider');
            const opacityValue = document.getElementById('opacityValue');
            if (opacitySlider && opacityValue) {
                opacitySlider.oninput = (e) => {
                    const val = parseFloat(e.target.value);
                    opacityValue.innerHTML = `${Math.round(val * 100)}%`;
                    if (containerGroup && containerGroup.children[0]) {
                        containerGroup.children[0].material.opacity = val;
                    }
                };
            }
            
            // User menu
            const userBtn = document.getElementById('btnUser');
            if (userBtn) {
                userBtn.onclick = () => {
                    if (currentUser) {
                        const dropdown = document.getElementById('userDropdown');
                        if (dropdown) dropdown.classList.toggle('show');
                    } else {
                        showLoginModal();
                    }
                };
            }
            
            // Login/Register
            const loginBtn = document.getElementById('loginBtn');
            const registerBtn = document.getElementById('registerBtn');
            const showRegister = document.getElementById('showRegister');
            const showLogin = document.getElementById('showLogin');
            const closeLoginModalBtn = document.getElementById('closeLoginModal');
            const closeRegisterModalBtn = document.getElementById('closeRegisterModal');
            const logoutBtn = document.getElementById('logoutBtn');
            
            if (loginBtn) loginBtn.onclick = () => {
                const username = document.getElementById('loginUsername').value;
                const password = document.getElementById('loginPassword').value;
                if (username && password) login(username, password);
                else showNotification('Nhập tên đăng nhập và mật khẩu', 'warning');
            };
            if (registerBtn) registerBtn.onclick = () => {
                const username = document.getElementById('regUsername').value;
                const email = document.getElementById('regEmail').value;
                const password = document.getElementById('regPassword').value;
                const fullName = document.getElementById('regFullName').value;
                if (username && email && password && fullName) register(username, email, password, fullName);
                else showNotification('Nhập đầy đủ thông tin', 'warning');
            };
            if (showRegister) showRegister.onclick = () => { closeLoginModal(); showRegisterModal(); };
            if (showLogin) showLogin.onclick = () => { closeRegisterModal(); showLoginModal(); };
            if (closeLoginModalBtn) closeLoginModalBtn.onclick = closeLoginModal;
            if (closeRegisterModalBtn) closeRegisterModalBtn.onclick = closeRegisterModal;
            if (logoutBtn) logoutBtn.onclick = () => { logout(); document.getElementById('userDropdown')?.classList.remove('show'); };
            
            // Close dropdown when clicking outside
            window.addEventListener('click', (e) => {
                const dropdown = document.getElementById('userDropdown');
                if (dropdown && !e.target.closest('#btnUser') && !e.target.closest('#userDropdown')) {
                    dropdown.classList.remove('show');
                }
            });
            
            // Keyboard shortcuts
            window.addEventListener('keydown', (e) => {
                if (manualPlacementSession) {
                    if (e.key === 'Escape') {
                        e.preventDefault();
                        cancelManualPlacement(true);
                        return;
                    }
                    if (e.key === 'r' || e.key === 'R') {
                        e.preventDefault();
                        rotateManualPlacementPreview(1);
                        return;
                    }
                }
                if (e.key === 'Delete' && selectedBox) {
                    deleteBox(selectedBox);
                    selectedBox = null;
                    document.getElementById('infoPanel').style.display = 'none';
                    showNotification('Đã xóa thùng hàng', 'success');
                }
                if (e.key === 't' || e.key === 'T') {
                    if (btnModeMove) btnModeMove.click();
                }
                if (e.key === 'r' || e.key === 'R') {
                    if (btnModeRotate) btnModeRotate.click();
                }
                if (e.ctrlKey && e.key === 'z') {
                    e.preventDefault();
                    undo();
                }
                if (e.ctrlKey && e.key === 'y') {
                    e.preventDefault();
                    redo();
                }
                if (e.ctrlKey && e.key === 's') {
                    e.preventDefault();
                    exportJSON();
                }
                if (e.key === 'F5') {
                    e.preventDefault();
                    smartPackBoxes();
                }
            });
        }
        
        // ==================== NEW FEATURES ====================
        
        // Toggle info panel
        let infoPanelVisible = true;
        function toggleInfoPanel() {
            const infoPanel = document.getElementById('infoPanel');
            const toggleBtn = document.getElementById('toggleInfoPanel');
            if (infoPanel) {
                infoPanelVisible = !infoPanelVisible;
                infoPanel.style.display = infoPanelVisible ? 'block' : 'none';
                if (toggleBtn) {
                    if (infoPanelVisible) toggleBtn.classList.add('active');
                    else toggleBtn.classList.remove('active');
                }
                showNotification(infoPanelVisible ? 'Đã hiện bảng thông tin' : 'Đã ẩn bảng thông tin', 'info', 1000);
            }
        }
        
        // Toggle color legend
        let legendVisible = true;
        function toggleColorLegend() {
            const legend = document.getElementById('colorLegend');
            if (legend) {
                legendVisible = !legendVisible;
                legend.style.display = legendVisible ? 'flex' : 'none';
                showNotification(legendVisible ? 'Đã hiện chú thích' : 'Đã ẩn chú thích', 'info', 1000);
            }
        }
        
        // Update quick stats
        function updateQuickStats() {
            const count = boxes.length;
            let totalVol = 0, totalWeight = 0;
            boxes.forEach(b => {
                totalVol += b.userData.width * b.userData.height * b.userData.depth;
                totalWeight += b.userData.weight;
            });
            const containerVol = currentContainer.w * currentContainer.h * currentContainer.d;
            const volPercent = containerVol > 0 ? (totalVol / containerVol * 100).toFixed(1) : 0;
            const quickBoxCount = document.getElementById('quickBoxCount');
            const quickVolume = document.getElementById('quickVolume');
            const quickWeight = document.getElementById('quickWeight');
            if (quickBoxCount) quickBoxCount.innerHTML = count;
            if (quickVolume) quickVolume.innerHTML = volPercent;
            if (quickWeight) quickWeight.innerHTML = totalWeight.toLocaleString();
        }

        function renderStepPlan() {
            const report = document.getElementById('report');
            if (!report) return;
            const metrics = collectPlanningInsights();
            const queueGroups = getQueueGroups(metrics);
            if (!lastStepPlan || lastStepPlan.length === 0) {
                report.innerHTML = '<div class="report-empty">Chưa có bước xếp</div>';
                report.style.display = 'block';
                renderSceneSequencePanel();
                return;
            }
            report.innerHTML = `
                <div class="report-title">📋 Hướng dẫn xếp (${lastStepPlan.length} bước)</div>
                <div class="cargo-template-tags" style="margin-bottom:12px;">
                    ${queueGroups.map(group => `<span class="cargo-template-tag">P${group.priority} ${group.group} · ${group.destination}</span>`).join('')}
                </div>
                <div class="report-step-meta" style="margin-bottom:12px;">
                    Route: ${metrics.state.route || 'Chua khai bao'} · Objective: ${metrics.state.objective || 'balanced'} · Rules: ${capturePlanningRules().priority.ignoreSeparation ? 'Ignore groups' : 'Respect groups'}
                </div>
                <div class="report-steps">
                    ${lastStepPlan.map((step, idx) => `
                        <div class="report-step">
                            <div class="report-step-no">${idx + 1}</div>
                            <div class="report-step-body">
                                <div><strong>${step.name}</strong>${step.destination ? ` · 📍 ${step.destination}` : ''}${step.group ? ` · 🧩 ${step.group}` : ''}</div>
                                <div class="report-step-meta">Vị trí: (${step.position.x.toFixed(0)}, ${step.position.y.toFixed(0)}, ${step.position.z.toFixed(0)}) · ${step.weight}kg${step.width ? ` · ${step.width}x${step.height}x${step.depth}` : ''}${step.sku ? ` · ${step.sku}` : ''}</div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
            report.style.display = 'block';
            renderSceneSequencePanel();
        }

        function renderAxleFromServer(axleData) {
            const { loads = [], limits = [] } = axleData;
            const axleContainer = document.getElementById('axleBars');
            if (!axleContainer) return;
            axleContainer.innerHTML = '';
            loads.forEach((val, idx) => {
                const limit = limits[idx] || 1;
                const percent = Math.min((val / limit) * 100, 150);
                const bar = document.createElement('div');
                bar.className = 'axle-bar';
                bar.innerHTML = `
                    <div class="axle-progress"><div class="axle-fill" style="width:${percent}%; background:${percent>100 ? '#ef4444' : percent>80 ? '#f59e0b' : '#10b981'}"></div></div>
                    <div class="axle-value">Trục ${idx+1}: ${Math.round(val).toLocaleString()} / ${limit.toLocaleString()} kg</div>
                `;
                axleContainer.appendChild(bar);
            });
        }
        
        // Show selection info bar
        function showSelectionInfoBar(box) {
            const bar = document.getElementById('selectionInfoBar');
            const text = document.getElementById('selectionInfoText');
            if (bar && text && box) {
                const dest = box.userData.destination ? ` · 📍 ${box.userData.destination}` : '';
                const group = box.userData.group ? ` · 🧩 ${box.userData.group}` : '';
                const priority = box.userData.priority ? ` · P${box.userData.priority}` : '';
                text.innerHTML = `📦 ${box.userData.name || `Thùng ${box.userData.id}`} | ${box.userData.weight}kg${dest}${group}${priority}`;
                bar.classList.add('show');
                clearTimeout(window.selectionBarTimeout);
                window.selectionBarTimeout = setTimeout(() => bar.classList.remove('show'), 5000);
            }
        }
        function hideSelectionInfoBar() {
            const bar = document.getElementById('selectionInfoBar');
            if (bar) bar.classList.remove('show');
        }
        
        // Center camera on selected box
        function centerOnBox(box) {
            if (!box) return;
            const targetPos = box.position.clone();
            const distance = 500;
            const direction = new THREE.Vector3(1, 0.5, 1).normalize();
            camera.position.copy(targetPos.clone().add(direction.multiplyScalar(distance)));
            orbitControls.target.copy(targetPos);
            orbitControls.update();
            showNotification('Đã di chuyển camera đến thùng hàng', 'info', 1000);
        }
        
        // Quick add templates
        const QUICK_BOX_TEMPLATES = [
            { name: '📦 Pallet 1m', width: 100, height: 120, depth: 100, weight: 500, category: 'normal' },
            { name: '📦 Thùng carton L', width: 80, height: 60, depth: 50, weight: 30, category: 'normal' },
            { name: '📦 Thùng carton M', width: 60, height: 50, depth: 40, weight: 20, category: 'normal' },
            { name: '📦 Thùng carton S', width: 40, height: 30, depth: 30, weight: 10, category: 'normal' },
            { name: '⚠️ Hàng dễ vỡ', width: 50, height: 40, depth: 50, weight: 15, fragile: true, category: 'fragile' },
            { name: '⚡ Hàng nặng', width: 80, height: 60, depth: 80, weight: 100, category: 'heavy' }
        ];

        function persistBoxUsageHistory() {
            try {
                localStorage.setItem(BOX_HISTORY_KEY, JSON.stringify(boxUsageHistory.slice(0, 12)));
            } catch (err) {
                console.warn('Không lưu được lịch sử thùng', err);
            }
        }

        function loadBoxUsageHistory() {
            try {
                const saved = localStorage.getItem(BOX_HISTORY_KEY);
                if (saved) boxUsageHistory = JSON.parse(saved);
            } catch (err) {
                boxUsageHistory = [];
            }
        }

        function recordBoxUsage(boxData) {
            if (!boxData) return;
            const baseDims = boxData.baseDims || { width: boxData.width, height: boxData.height, depth: boxData.depth };
            const normalizedBase = {
                width: Number(baseDims.width) || 0,
                height: Number(baseDims.height) || 0,
                depth: Number(baseDims.depth) || 0
            };
            const entry = {
                name: boxData.name || 'Thùng',
                width: Number(boxData.width) || 0,
                height: Number(boxData.height) || 0,
                depth: Number(boxData.depth) || 0,
                weight: Number(boxData.weight) || 0,
                category: boxData.category || 'normal',
                fragile: !!boxData.fragile,
                hazardous: !!boxData.hazardous,
                baseDims: normalizedBase,
                orientationIndex: boxData.orientationIndex || 0
            };
            const key = `${entry.name}|${normalizedBase.width}x${normalizedBase.height}x${normalizedBase.depth}|${entry.weight}|${entry.category}|${entry.orientationIndex}|${entry.fragile}|${entry.hazardous}`;
            const now = Date.now();
            const idx = boxUsageHistory.findIndex(h => h.key === key);
            if (idx >= 0) {
                boxUsageHistory[idx].count += 1;
                boxUsageHistory[idx].lastUsed = now;
            } else {
                boxUsageHistory.unshift({ ...entry, key, count: 1, lastUsed: now });
            }
            boxUsageHistory = boxUsageHistory
                .sort((a, b) => (b.count - a.count) || (b.lastUsed - a.lastUsed))
                .slice(0, 12);
            persistBoxUsageHistory();
        }

        function getHistoryTemplates(limit = 6) {
            if (!boxUsageHistory || boxUsageHistory.length === 0) return [];
            return boxUsageHistory
                .sort((a, b) => (b.count - a.count) || (b.lastUsed - a.lastUsed))
                .slice(0, limit);
        }
        
        function showQuickAddPanel() {
            const panel = document.getElementById('quickAddPanel');
            const list = document.getElementById('quickAddList');
            if (panel && list) {
                const historyTemplates = getHistoryTemplates();
                const useHistory = historyTemplates.length > 0;
                const templates = useHistory ? historyTemplates : QUICK_BOX_TEMPLATES;
                const subtitle = useHistory ? 'Gợi ý từ lịch sử bạn đã dùng' : 'Mẫu gợi ý mặc định';
                list.innerHTML = `
                    <div class="quick-add-subtitle">${subtitle}</div>
                    ${templates.map((template, idx) => `
                        <div class="quick-add-item" data-idx="${idx}">
                            <div class="quick-add-name">${template.name}</div>
                            <div class="quick-add-meta">${template.width}x${template.height}x${template.depth} cm · ${template.weight || 0} kg${template.count ? ` · ${template.count} lần` : ''}</div>
                        </div>
                    `).join('')}
                `;
                list.querySelectorAll('.quick-add-item').forEach(item => {
                    item.addEventListener('click', () => {
                        const idx = parseInt(item.dataset.idx);
                        const template = useHistory ? historyTemplates[idx] : QUICK_BOX_TEMPLATES[idx];
                        const base = template.baseDims || { width: template.width, height: template.height, depth: template.depth };
                        const orientationIndex = template.orientationIndex || 0;
                        const oriented = getOrientationDims(base, orientationIndex);
                        const maxBoxes = currentUser?.subscription?.features?.maxBoxes || 50;
                        if (boxes.length >= maxBoxes && maxBoxes !== Infinity) {
                            showNotification(`Giới hạn ${maxBoxes} thùng!`, 'warning');
                            return;
                        }
                        const pos = new THREE.Vector3(
                            -currentContainer.w/2 + oriented.width/2,
                            oriented.height/2,
                            -currentContainer.d/2 + oriented.depth/2
                        );
                        const payload = {
                            ...template,
                            width: oriented.width,
                            height: oriented.height,
                            depth: oriented.depth,
                            baseDims: base,
                            orientationIndex
                        };
                        createBox(payload, pos);
                        showNotification(`Đã thêm ${template.name}`, 'success');
                        panel.classList.remove('show');
                    });
                });
                panel.classList.toggle('show');
            }
        }
        
        // Toggle floating menu
        let fabMenuVisible = false;
        function toggleFabMenu() {
            const menu = document.getElementById('fabMenu');
            if (menu) {
                fabMenuVisible = !fabMenuVisible;
                if (fabMenuVisible) menu.classList.add('show');
                else menu.classList.remove('show');
            }
        }
        
        // Duplicate selected box
        function duplicateSelectedBox() {
            if (!selectedBox) {
                showNotification('Chọn thùng cần nhân bản', 'warning');
                return;
            }
            const maxBoxes = currentUser?.subscription?.features?.maxBoxes || 50;
            if (boxes.length >= maxBoxes && maxBoxes !== Infinity) {
                showNotification(`Giới hạn ${maxBoxes} thùng!`, 'warning');
                return;
            }
            const newBox = {
                name: `${selectedBox.userData.name} (copy)`,
                width: selectedBox.userData.width,
                height: selectedBox.userData.height,
                depth: selectedBox.userData.depth,
                weight: selectedBox.userData.weight,
                fragile: selectedBox.userData.fragile,
                hazardous: selectedBox.userData.hazardous,
                category: selectedBox.userData.category,
                destination: selectedBox.userData.destination || '',
                group: selectedBox.userData.group || '',
                priority: selectedBox.userData.priority || 3,
                sku: selectedBox.userData.sku || ''
            };
            const pos = new THREE.Vector3(
                selectedBox.position.x + 20,
                selectedBox.position.y,
                selectedBox.position.z + 20
            );
            createBox(newBox, pos);
            showNotification(`Đã nhân bản thùng hàng`, 'success');
        }
        
        // Batch import
        function batchImport() {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json,.csv';
            input.onchange = (e) => {
                if (e.target.files.length) {
                    const file = e.target.files[0];
                    if (file.name.endsWith('.json')) importJSON(file);
                    else if (file.name.endsWith('.csv')) importCSV(file);
                }
            };
            input.click();
        }

        async function importExcelFile(file) {
            const token = localStorage.getItem('auth_token');
            if (!token) { showLoginModal(); return; }
            const form = new FormData();
            form.append('file', file);
            try {
                const res = await fetch('/api/import/excel', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` },
                    body: form
                });
                const data = await res.json();
                if (!data.success) throw new Error(data.message || 'Import lỗi');
                (data.data || []).forEach((box, idx) => {
                    const pos = new THREE.Vector3(
                        -currentContainer.w/2 + box.width/2 + (Math.random() - 0.5) * 50,
                        box.height/2,
                        -currentContainer.d/2 + box.depth/2 + (Math.random() - 0.5) * 100
                    );
                    createBox(box, pos);
                });
                showNotification(`Đã import ${data.data?.length || 0} thùng từ Excel`, 'success');
                updateStats(); updateCOG(); saveToHistory();
            } catch (err) {
                console.error(err);
                showNotification(err.message || 'Import Excel lỗi', 'error');
            }
        }
        
        function importCSV(file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const text = e.target.result;
                    const lines = text.split('\n');
                    for (let i = 1; i < lines.length; i++) {
                        const values = lines[i].split(',');
                        if (values.length >= 5) {
                            const box = {
                                name: values[0]?.replace(/["']/g, '') || `Box ${i}`,
                                width: parseFloat(values[1]) || 50,
                                height: parseFloat(values[2]) || 50,
                                depth: parseFloat(values[3]) || 50,
                                weight: parseFloat(values[4]) || 20,
                                category: 'normal'
                            };
                            const maxBoxes = currentUser?.subscription?.features?.maxBoxes || 50;
                            if (boxes.length >= maxBoxes && maxBoxes !== Infinity) {
                                showNotification(`Đã đạt giới hạn ${maxBoxes} thùng!`, 'warning');
                                break;
                            }
                            const pos = new THREE.Vector3(
                                -currentContainer.w/2 + box.width/2 + (Math.random() - 0.5) * 100,
                                box.height/2,
                                -currentContainer.d/2 + box.depth/2 + (Math.random() - 0.5) * 200
                            );
                            createBox(box, pos);
                        }
                    }
                    showNotification(`Đã import ${lines.length - 1} thùng từ CSV`, 'success');
                } catch (err) {
                    showNotification('Lỗi import CSV', 'error');
                }
            };
            reader.readAsText(file);
        }
        
        // Override các hàm để tích hợp tính năng mới
        const originalUpdateSelectedInfo = updateSelectedInfo;
        updateSelectedInfo = function(box) {
            originalUpdateSelectedInfo(box);
            showSelectionInfoBar(box);
        };
        
        const originalUpdateStats = updateStats;
        updateStats = function() {
            originalUpdateStats();
            updateQuickStats();
            refreshProfessionalPanels();
        };
        
        const originalDeleteBox = deleteBox;
        deleteBox = function(box) {
            const result = originalDeleteBox(box);
            if (!selectedBox) hideSelectionInfoBar();
            return result;
        };
        
        // ==================== NEW EVENT HANDLERS ====================
        function setupNewEventHandlers() {
            const toggleInfoBtn = document.getElementById('toggleInfoPanel');
            if (toggleInfoBtn) toggleInfoBtn.onclick = toggleInfoPanel;
            
            const toggleLegendBtn = document.getElementById('toggleColorLegend');
            if (toggleLegendBtn) toggleLegendBtn.onclick = toggleColorLegend;

            const quickScenarioBtn = document.getElementById('btnQuickScenario');
            if (quickScenarioBtn) quickScenarioBtn.onclick = () => loadQuickScenario(0);

            const loadCargoTemplateBtn = document.getElementById('btnLoadCargoTemplate');
            if (loadCargoTemplateBtn) {
                loadCargoTemplateBtn.onclick = () => {
                    QUICK_SCENARIOS[0].cargoIds
                        .map(id => CARGO_TEMPLATE_LIBRARY.find(template => template.id === id))
                        .filter(Boolean)
                        .forEach(template => boxTypes.push(buildTemplateDraft(template)));
                    updateBoxTypeList();
                    showNotification('Da nap bo cargo mau vao queue', 'success', 1500);
                };
            }

            [
                'shipmentName',
                'shipmentRef',
                'shipmentMode',
                'shipmentObjective',
                'shipmentRoute',
                'shipmentNotes'
            ].forEach(id => {
                const input = document.getElementById(id);
                if (input) {
                    input.addEventListener('input', () => refreshProfessionalPanels());
                    input.addEventListener('change', () => refreshProfessionalPanels());
                }
            });

            [
                'ruleRespectPrioritySeparation',
                'ruleNoGroupStacking',
                'ruleSplitByWall',
                'ruleIgnoreGroupSeparation',
                'ruleRespectWeightLimits',
                'ruleShiftToMassCenter'
            ].forEach(id => {
                const input = document.getElementById(id);
                if (input) {
                    input.addEventListener('change', () => {
                        const ignore = document.getElementById('ruleIgnoreGroupSeparation');
                        const respect = document.getElementById('ruleRespectPrioritySeparation');
                        const noStack = document.getElementById('ruleNoGroupStacking');
                        const splitWall = document.getElementById('ruleSplitByWall');

                        if (id === 'ruleIgnoreGroupSeparation' && ignore?.checked) {
                            if (respect) respect.checked = false;
                            if (noStack) noStack.checked = false;
                            if (splitWall) splitWall.checked = false;
                        }
                        if (id === 'ruleRespectPrioritySeparation' && respect?.checked && ignore) {
                            ignore.checked = false;
                        }
                        if ((id === 'ruleNoGroupStacking' || id === 'ruleSplitByWall') && (noStack?.checked || splitWall?.checked)) {
                            if (ignore) ignore.checked = false;
                            if (respect) respect.checked = true;
                        }
                        updateContainerVisual();
                        refreshProfessionalPanels();
                    });
                }
            });
             
            const fab = document.getElementById('fab');
            if (fab) fab.onclick = toggleFabMenu;
            
            const fabQuickAdd = document.getElementById('fabQuickAdd');
            if (fabQuickAdd) fabQuickAdd.onclick = showQuickAddPanel;
            
            const fabClearAll = document.getElementById('fabClearAll');
            if (fabClearAll) fabClearAll.onclick = () => { toggleFabMenu(); deleteAllBoxes(); };
            
            const fabSmartPack = document.getElementById('fabSmartPack');
            if (fabSmartPack) fabSmartPack.onclick = () => { toggleFabMenu(); smartPackBoxes(); };
            
            const selectionMoveUp = document.getElementById('selectionMoveUp');
            const selectionMoveDown = document.getElementById('selectionMoveDown');
            const selectionDelete = document.getElementById('selectionDelete');
            const selectionCenter = document.getElementById('selectionCenter');
            const selectionRotate = document.getElementById('selectionRotate');
            if (selectionMoveUp) selectionMoveUp.onclick = () => { if (selectedBox) moveBoxUp(selectedBox); };
            if (selectionMoveDown) selectionMoveDown.onclick = () => { if (selectedBox) moveBoxDown(selectedBox); };
            if (selectionDelete) selectionDelete.onclick = () => { if (selectedBox) { deleteBox(selectedBox); selectedBox = null; hideSelectionInfoBar(); document.getElementById('infoPanel').style.display = 'none'; } };
            if (selectionCenter) selectionCenter.onclick = () => { if (selectedBox) centerOnBox(selectedBox); };
            if (selectionRotate) selectionRotate.onclick = () => { if (selectedBox) cycleOrientation(selectedBox); };

            const replaySequenceBtn = document.getElementById('btnReplaySequence');
            if (replaySequenceBtn) replaySequenceBtn.onclick = replayLastSequence;

            const focusSelectedBtn = document.getElementById('btnFocusSelected');
            if (focusSelectedBtn) focusSelectedBtn.onclick = focusSelectedOrCOG;

            const stepPrevBtn = document.getElementById('btnStepPrev');
            if (stepPrevBtn) stepPrevBtn.onclick = showPreviousStep;

            const stepPlayPauseBtn = document.getElementById('btnStepPlayPause');
            if (stepPlayPauseBtn) stepPlayPauseBtn.onclick = toggleStepPlayback;

            const stepNextBtn = document.getElementById('btnStepNext');
            if (stepNextBtn) stepNextBtn.onclick = showNextStep;

            const easyShipmentTitle = document.getElementById('easyShipmentTitle');
            if (easyShipmentTitle) {
                easyShipmentTitle.addEventListener('input', () => {
                    const shipmentName = document.getElementById('shipmentName');
                    if (shipmentName) shipmentName.value = easyShipmentTitle.value;
                    refreshProfessionalPanels();
                });
            }

            const easyNavToggle = document.getElementById('easyNavToggle');
            if (easyNavToggle) {
                easyNavToggle.onclick = () => {
                    document.querySelector('.container-app')?.classList.toggle('easy-panel-collapsed');
                };
            }

            const easyAddGroup = document.getElementById('easyAddGroup');
            if (easyAddGroup) {
                easyAddGroup.onclick = () => {
                    const nextPriority = Math.max(1, ...boxTypes.map(item => Number(item.priority) || 1), 0) + 1;
                    easyActiveGroupKey = 'all';
                    openEasyItemModal(-1);
                    setTimeout(() => {
                        const priorityInput = document.getElementById('easyItemPriority');
                        const groupInput = document.getElementById('easyItemGroup');
                        if (priorityInput) priorityInput.value = String(nextPriority);
                        if (groupInput) groupInput.value = `Nhóm ${nextPriority}`;
                    }, 0);
                };
            }

            const easyAddItemBtn = document.getElementById('easyAddItemBtn');
            if (easyAddItemBtn) easyAddItemBtn.onclick = createEasyDefaultItem;

            const easyOpenRules = document.getElementById('easyOpenRules');
            if (easyOpenRules) easyOpenRules.onclick = () => {
                if (!easyLegacyMode) setEasyLegacyMode(true);
                document.getElementById('ruleStatusPanel')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                showNotification('Rule engine đang chạy theo nhóm, weight và split wall hiện tại', 'info', 1400);
            };

            const easyOpenCargoDesk = document.getElementById('easyOpenCargoDesk');
            if (easyOpenCargoDesk) easyOpenCargoDesk.onclick = () => setEasyWorkspace('cargo');

            const easyOpenReport = document.getElementById('easyOpenReport');
            if (easyOpenReport) easyOpenReport.onclick = () => setEasyWorkspace('reports');

            const easyOpenLegacy = document.getElementById('easyOpenLegacy');
            if (easyOpenLegacy) easyOpenLegacy.onclick = () => setEasyLegacyMode(!easyLegacyMode);

            const easyViewIso = document.getElementById('easyViewIso');
            const easyViewSide = document.getElementById('easyViewSide');
            const easyViewTop = document.getElementById('easyViewTop');
            const easyViewFront = document.getElementById('easyViewFront');
            const activateViewButton = activeId => {
                ['easyViewIso', 'easyViewSide', 'easyViewTop', 'easyViewFront'].forEach(id => {
                    document.getElementById(id)?.classList.toggle('active', id === activeId);
                });
            };
            if (easyViewIso) easyViewIso.onclick = () => { setView('isometric'); activateViewButton('easyViewIso'); };
            if (easyViewSide) easyViewSide.onclick = () => { setView('side'); activateViewButton('easyViewSide'); };
            if (easyViewTop) easyViewTop.onclick = () => { setView('top'); activateViewButton('easyViewTop'); };
            if (easyViewFront) easyViewFront.onclick = () => { setView('front'); activateViewButton('easyViewFront'); };

            const easyUndoBtn = document.getElementById('easyUndoBtn');
            const easyRedoBtn = document.getElementById('easyRedoBtn');
            const easyShareBtn = document.getElementById('easyShareBtn');
            const easyPrintBtn = document.getElementById('easyPrintBtn');
            const easyLoadAction = document.getElementById('easyLoadAction');
            if (easyUndoBtn) easyUndoBtn.onclick = undo;
            if (easyRedoBtn) easyRedoBtn.onclick = redo;
            if (easyShareBtn) easyShareBtn.onclick = shareProjectLink;
            if (easyPrintBtn) easyPrintBtn.onclick = exportServerReport;
            if (easyLoadAction) {
                easyLoadAction.onclick = () => {
                    if (boxes.length > 0) smartPackBoxes();
                    else runAIBasic();
                };
            }

            const easyVehicleCatalogBtn = document.getElementById('easyVehicleCatalogBtn');
            if (easyVehicleCatalogBtn) easyVehicleCatalogBtn.onclick = () => setEasyWorkspace('vehicles');

            const easyVehicleFavoriteBtn = document.getElementById('easyVehicleFavoriteBtn');
            if (easyVehicleFavoriteBtn) easyVehicleFavoriteBtn.onclick = toggleFavoriteCargoSpace;

            const easyVehicleCatalogClose = document.getElementById('easyVehicleCatalogClose');
            if (easyVehicleCatalogClose) easyVehicleCatalogClose.onclick = closeEasyVehicleCatalog;
            document.querySelectorAll('[data-easy-close="vehicle"]').forEach(node => node.addEventListener('click', closeEasyVehicleCatalog));

            const easyItemModalClose = document.getElementById('easyItemModalClose');
            if (easyItemModalClose) easyItemModalClose.onclick = closeEasyItemModal;
            document.querySelectorAll('[data-easy-close="item"]').forEach(node => node.addEventListener('click', closeEasyItemModal));

            const easyItemSave = document.getElementById('easyItemSave');
            const easyItemDelete = document.getElementById('easyItemDelete');
            const easyItemPlaceOne = document.getElementById('easyItemPlaceOne');
            if (easyItemSave) easyItemSave.onclick = saveEasyItemModal;
            if (easyItemDelete) easyItemDelete.onclick = deleteEasyItemModalEntry;
            if (easyItemPlaceOne) easyItemPlaceOne.onclick = placeEasyModalItem;

            const easyHintClose = document.getElementById('easyHintClose');
            const easyHintAcknowledge = document.getElementById('easyHintAcknowledge');
            const dismissHint = () => {
                easyHintDismissed = true;
                document.getElementById('easyHintBubble')?.classList.add('hidden');
            };
            if (easyHintClose) easyHintClose.onclick = dismissHint;
            if (easyHintAcknowledge) easyHintAcknowledge.onclick = dismissHint;

            const easyTabReports = document.getElementById('easyTabReports');
            const easyTabCargo = document.getElementById('easyTabCargo');
            const easyTabVehicles = document.getElementById('easyTabVehicles');
            const easyTabAccount = document.getElementById('easyTabAccount');
            const easyTabLicense = document.getElementById('easyTabLicense');
            if (easyTabReports) easyTabReports.onclick = () => setEasyWorkspace('reports');
            if (easyTabCargo) easyTabCargo.onclick = () => setEasyWorkspace('planner');
            if (easyTabVehicles) easyTabVehicles.onclick = () => setEasyWorkspace('vehicles');
            if (easyTabAccount) easyTabAccount.onclick = () => document.getElementById('btnUser')?.click();
            if (easyTabLicense) easyTabLicense.onclick = () => showNotification('Ban dang dung che do phat trien noi bo', 'info', 1400);

            const toggleSidebar = document.getElementById('toggleSidebar');
            if (toggleSidebar) toggleSidebar.onclick = () => setEasyLegacyMode(!easyLegacyMode);

            const easyWorkspaceBackFromCargo = document.getElementById('easyWorkspaceBackFromCargo');
            const easyWorkspaceBackFromReports = document.getElementById('easyWorkspaceBackFromReports');
            const easyWorkspaceBackFromVehicles = document.getElementById('easyWorkspaceBackFromVehicles');
            const easyWorkspaceExportReport = document.getElementById('easyWorkspaceExportReport');
            const easyWorkspacePlanSpaces = document.getElementById('easyWorkspacePlanSpaces');
            const easyWorkspaceFavoriteOnly = document.getElementById('easyWorkspaceFavoriteOnly');
            if (easyWorkspaceBackFromCargo) easyWorkspaceBackFromCargo.onclick = () => setEasyWorkspace('planner');
            if (easyWorkspaceBackFromReports) easyWorkspaceBackFromReports.onclick = () => setEasyWorkspace('planner');
            if (easyWorkspaceBackFromVehicles) easyWorkspaceBackFromVehicles.onclick = () => setEasyWorkspace('planner');
            if (easyWorkspaceExportReport) easyWorkspaceExportReport.onclick = exportServerReport;
            if (easyWorkspacePlanSpaces) {
                easyWorkspacePlanSpaces.onclick = () => {
                    const plan = buildAdditionalCargoSpacePlan();
                    renderEasyMultiSpacePlan();
                    showNotification(
                        plan.spaces.length
                            ? `Da lap ke hoach ${plan.spaces.length} cargo spaces${plan.remaining.length ? `, con ${plan.remaining.length} kien chua xep` : ''}`
                            : 'Chua tao duoc cargo space nao voi bo du lieu hien tai',
                        plan.spaces.length ? 'success' : 'warning',
                        1800
                    );
                };
            }
            if (easyWorkspaceFavoriteOnly) {
                easyWorkspaceFavoriteOnly.onclick = () => {
                    easyVehicleWorkspaceFavoritesOnly = !easyVehicleWorkspaceFavoritesOnly;
                    easyWorkspaceFavoriteOnly.textContent = easyVehicleWorkspaceFavoritesOnly ? 'Xem tất cả' : 'Chỉ xem yêu thích';
                    renderEasyVehiclesWorkspace();
                };
            }

            const easyHelpBtn = document.getElementById('easyHelpBtn');
            if (easyHelpBtn) {
                easyHelpBtn.onclick = () => {
                    easyHintDismissed = false;
                    document.getElementById('easyHintBubble')?.classList.remove('hidden');
                    updateEasyHint();
                };
            }

            const easyBuyBtn = document.getElementById('easyBuyBtn');
            if (easyBuyBtn) easyBuyBtn.onclick = () => showNotification('Che do Pro mo AI Pro, report viewer va chia se cong khai', 'info', 1800);
             
            window.addEventListener('keydown', (e) => {
                if (manualPlacementSession) {
                    if (e.key === 'Escape') {
                        e.preventDefault();
                        cancelManualPlacement(true);
                        return;
                    }
                    if (e.key === 'r' || e.key === 'R') {
                        e.preventDefault();
                        rotateManualPlacementPreview(1);
                        return;
                    }
                }
                if (e.ctrlKey && e.key === 'd') {
                    e.preventDefault();
                    duplicateSelectedBox();
                }
                if (e.key === 'Escape') {
                    hideSelectionInfoBar();
                    const panel = document.getElementById('quickAddPanel');
                    if (panel) panel.classList.remove('show');
                    const menu = document.getElementById('fabMenu');
                    if (menu) menu.classList.remove('show');
                }
            });
        }
        
        // ==================== INITIALIZE ====================
        function init() {
            loadOperationalPreferences();
            init3D();
            initializeSceneInteractions();
            applyShipmentStateToInputs(shipmentState);
            renderCargoTemplateLibrary();
            setupEventHandlers();
            setupNewEventHandlers();
            updateManualLoadControls();
            renderCargoSpaceSelector(currentContainer.code || '40hc');
            window.__cppAppBridge = {
                buildShareSnapshot,
                getPublicViewUrl(publicId, options = {}) {
                    const query = new URLSearchParams(options);
                    const suffix = query.toString() ? `?${query.toString()}` : '';
                    return `${window.location.origin}/p/${publicId}${suffix}`;
                },
                showLoginModal,
                showNotification
            };
            checkAuth();
            loadBoxUsageHistory();
            loadFromLocal();
            
            setTimeout(() => {
                if (boxTypes.length === 0 && boxes.length === 0) {
                    boxTypes = [
                        { name: 'Hang tieu chuan A', width: 60, height: 50, depth: 80, weight: 25, quantity: 6, fixedOrientation: false, fragile: false, hazardous: false, category: 'normal', destination: 'Da Nang', group: 'Retail', priority: 2, sku: 'RTL-A' },
                        { name: 'Hang de vo B', width: 45, height: 40, depth: 60, weight: 15, quantity: 4, fixedOrientation: true, fragile: true, hazardous: false, category: 'fragile', destination: 'Hai Phong', group: 'Fragile', priority: 3, sku: 'FRG-B' },
                        { name: 'Hang nang C', width: 100, height: 60, depth: 80, weight: 80, quantity: 2, fixedOrientation: false, fragile: false, hazardous: false, category: 'heavy', destination: 'Hai Phong', group: 'Heavy', priority: 4, sku: 'HVY-C' }
                    ];
                    updateBoxTypeList();
                }
                refreshProfessionalPanels();
                showNotification('🚛 Container Packing Pro v7.0 - Đăng nhập admin/123456 để dùng AI Pro!', 'success', 6000);
            }, 500);
            
            autoSaveInterval = setInterval(() => { if (boxes.length > 0) autoSaveToLocal(); }, 30000);
            
            function animate() {
                requestAnimationFrame(animate);
                if (orbitControls) orbitControls.update();
                if (renderer && scene && camera) renderer.render(scene, camera);
                if (labelRenderer && scene && camera) labelRenderer.render(scene, camera);
            }
            animate();
            
            window.addEventListener('resize', () => {
                const canvasDiv = document.getElementById('canvas');
                if (canvasDiv && camera && renderer && labelRenderer) {
                    camera.aspect = canvasDiv.clientWidth / canvasDiv.clientHeight;
                    camera.updateProjectionMatrix();
                    renderer.setSize(canvasDiv.clientWidth, canvasDiv.clientHeight);
                    labelRenderer.setSize(canvasDiv.clientWidth, canvasDiv.clientHeight);
                }
            });
            
            saveToHistory();
            renderStepPlan();
        }
        
        init();
    });
})();



// Server report export & share link
function downloadBlob(blob, filename = `download-${Date.now()}.bin`) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 500);
}

function getAppBridge() {
    return window.__cppAppBridge || null;
}

async function createSnapshotShare(token) {
    const bridge = getAppBridge();
    if (!bridge) throw new Error('Ứng dụng chưa sẵn sàng để tạo snapshot');

    const response = await fetch('/api/share/public/snapshot', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(bridge.buildShareSnapshot())
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.success) {
        throw new Error(data.message || 'Không tạo được snapshot chia sẻ');
    }
    return data.data;
}

async function exportServerReport() {
    const bridge = getAppBridge();
    const token = localStorage.getItem('auth_token');
    if (!token) {
        bridge?.showLoginModal?.();
        return;
    }
    try {
        const share = await createSnapshotShare(token);
        const reportUrl = share.reportUrl ? `${window.location.origin}${share.reportUrl}` : bridge?.getPublicViewUrl?.(share.publicId, { print: 1, autoplay: 0 });
        if (!reportUrl) throw new Error('Không dựng được report URL');
        window.open(reportUrl, '_blank', 'noopener');
        bridge?.showNotification?.('Đã mở report viewer để in hoặc lưu PDF', 'success');
    } catch (e) {
        console.error(e);
        bridge?.showNotification?.('Xuất report viewer lỗi', 'error');
    }
}

async function shareProjectLink() {
    const bridge = getAppBridge();
    const token = localStorage.getItem('auth_token');
    if (!token) {
        bridge?.showLoginModal?.();
        return;
    }
    try {
        const share = await createSnapshotShare(token);
        const url = share.url ? `${window.location.origin}${share.url}` : bridge?.getPublicViewUrl?.(share.publicId);
        if (!url) throw new Error('Không dựng được URL chia sẻ');
        try {
            await navigator.clipboard?.writeText(url);
            bridge?.showNotification?.('Đã tạo link public viewer và copy vào clipboard', 'success');
        } catch (clipboardError) {
            console.warn('Clipboard unavailable:', clipboardError);
            window.prompt('Link chia sẻ public viewer', url);
            bridge?.showNotification?.('Đã tạo link public viewer', 'success');
        }
    } catch (e) {
        console.error(e);
        bridge?.showNotification?.('Không tạo được link chia sẻ', 'error');
    }
}




