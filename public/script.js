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
            '40rf': { name: '40\' Reefer', w: 229, h: 227, d: 1158, maxLoad: 29000, tare: 4400, price: 2000, color: 0x34d399 }
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
        let currentContainer = { ...CONTAINER_TYPES['40hc'] };
        let boxTypes = [];
        let history = [];
        let historyIndex = -1;
        let cogMarker = null;
        let raycaster, mouse;
        let isDragging = false;
        let dragPlane = null;
        let rotationMode = false;
        let autoSaveInterval = null;
        let currentUser = null;
        let showLabels = true;
        
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
            
            // Sắp xếp thùng theo thể tích giảm dần
            const sortedBoxes = [...boxes].sort((a, b) => {
                const volA = a.userData.width * a.userData.height * a.userData.depth;
                const volB = b.userData.width * b.userData.height * b.userData.depth;
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
            
            let currentY = 0;
            
            for (const box of sortedBoxes) {
                const w = box.userData.width;
                const h = box.userData.height;
                const d = box.userData.depth;
                
                // Try to find best position
                let bestPos = null;
                let bestScore = -Infinity;
                
                // Check all possible positions with grid search
                const step = 10;
                for (let yOffset = 0; yOffset <= currentY + 50; yOffset += step) {
                    for (let xOffset = -containerW/2 + w/2; xOffset <= containerW/2 - w/2; xOffset += step) {
                        for (let zOffset = -containerD/2 + d/2; zOffset <= containerD/2 - d/2; zOffset += step) {
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
                            }
                            
                            // Check container boundaries
                            if (!collision && testPos.y + h/2 <= containerH && 
                                testPos.x + w/2 <= containerW/2 && testPos.x - w/2 >= -containerW/2 &&
                                testPos.z + d/2 <= containerD/2 && testPos.z - d/2 >= -containerD/2) {
                                // Calculate score - prefer lower positions
                                const score = -testPos.y + (testPos.x === xOffset ? 50 : 0);
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
                        d: d
                    });
                    currentY = Math.max(currentY, bestPos.y + h/2);
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
        }
        
        // ==================== DRAG AND DROP ====================
        function setupDragAndDrop() {
            let currentDragBox = null;
            let dragOffset = null;
            
            renderer.domElement.addEventListener('mousedown', (e) => {
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
                        
                        const halfW = currentContainer.w / 2;
                        const halfH = currentContainer.h;
                        const halfD = currentContainer.d / 2;
                        const boxHalfW = currentDragBox.userData.width / 2;
                        const boxHalfH = currentDragBox.userData.height / 2;
                        const boxHalfD = currentDragBox.userData.depth / 2;
                        
                        newPos.x = Math.max(-halfW + boxHalfW, Math.min(halfW - boxHalfW, newPos.x));
                        newPos.y = Math.max(boxHalfH, Math.min(halfH - boxHalfH, newPos.y));
                        newPos.z = Math.max(-halfD + boxHalfD, Math.min(halfD - boxHalfD, newPos.z));
                        
                        currentDragBox.position.copy(newPos);
                        updateSelectedInfo(currentDragBox);
                    }
                }
            });
            
            window.addEventListener('mouseup', () => {
                if (isDragging && currentDragBox) {
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
            let rotatingBox = null;
            let lastMouseX = 0, lastMouseY = 0;
            
            renderer.domElement.addEventListener('mousedown', (e) => {
                if (!rotationMode) return;
                if (orbitControls.enabled === false) return;
                
                const rect = renderer.domElement.getBoundingClientRect();
                mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
                mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
                
                raycaster.setFromCamera(mouse, camera);
                const intersects = raycaster.intersectObjects(boxes);
                
                if (intersects.length > 0) {
                    rotatingBox = intersects[0].object;
                    lastMouseX = e.clientX;
                    lastMouseY = e.clientY;
                    orbitControls.enabled = false;
                    renderer.domElement.style.cursor = 'grabbing';
                    e.stopPropagation();
                }
            });
            
            window.addEventListener('mousemove', (e) => {
                if (!rotatingBox) return;
                
                const deltaX = e.clientX - lastMouseX;
                const deltaY = e.clientY - lastMouseY;
                
                if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
                    rotatingBox.rotation.y += deltaX * 0.01;
                    rotatingBox.rotation.x += deltaY * 0.01;
                    rotatingBox.userData.rotation = {
                        x: rotatingBox.rotation.x,
                        y: rotatingBox.rotation.y,
                        z: rotatingBox.rotation.z
                    };
                    lastMouseX = e.clientX;
                    lastMouseY = e.clientY;
                    updateSelectedInfo(rotatingBox);
                }
            });
            
            window.addEventListener('mouseup', () => {
                if (rotatingBox) {
                    saveToHistory();
                    rotatingBox = null;
                    orbitControls.enabled = true;
                    renderer.domElement.style.cursor = 'default';
                }
            });
        }
        
        function setupSelection() {
            renderer.domElement.addEventListener('click', (e) => {
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
                box.material.emissive = new THREE.Color(0x442200);
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
        
        function updateContainerVisual() {
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
            
            // Container body
            const material = new THREE.MeshStandardMaterial({
                color: containerColor,
                transparent: true,
                opacity: parseFloat(opacity),
                roughness: 0.3,
                metalness: 0.4,
                side: THREE.DoubleSide
            });
            
            const bodyGeo = new THREE.BoxGeometry(W, H, D);
            const body = new THREE.Mesh(bodyGeo, material);
            body.position.set(0, H/2, 0);
            body.castShadow = true;
            body.receiveShadow = true;
            containerGroup.add(body);
            
            // Edges
            const edgesGeo = new THREE.EdgesGeometry(bodyGeo);
            const edgesMat = new THREE.LineBasicMaterial({ color: 0x3b82f6 });
            const wireframe = new THREE.LineSegments(edgesGeo, edgesMat);
            wireframe.position.copy(body.position);
            containerGroup.add(wireframe);
            
            // Corner markers
            const cornerMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, emissive: 0x442200 });
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
            
            // Floor grid
            const floorGridMat = new THREE.LineBasicMaterial({ color: 0x3b82f6 });
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
        
        function checkCollision(box) {
            if (!box) return false;
            
            const boxBounds = new THREE.Box3().setFromObject(box);
            let hasCollision = false;
            
            // Check container boundaries
            const containerBounds = new THREE.Box3().setFromObject(containerGroup);
            if (!containerBounds.containsBox(boxBounds)) {
                hasCollision = true;
                box.material.emissive = new THREE.Color(0x442200);
                showNotification('Thùng nằm ngoài container!', 'warning', 1500);
            } else {
                // Check collision with other boxes
                for (let other of boxes) {
                    if (other === box) continue;
                    const otherBounds = new THREE.Box3().setFromObject(other);
                    if (boxBounds.intersectsBox(otherBounds)) {
                        hasCollision = true;
                        box.material.emissive = new THREE.Color(0x442200);
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
function createBox(boxType, position = null) {
    // Admin không bị giới hạn số thùng
    const isAdmin = currentUser && currentUser.role === 'admin';
    const maxBoxes = isAdmin ? Infinity : (currentUser?.subscription?.features?.maxBoxes || 50);
    
    if (!isAdmin && boxes.length >= maxBoxes) {
        showNotification(`Đã đạt giới hạn ${maxBoxes} thùng. Vui lòng nâng cấp tài khoản!`, 'warning');
        return null;
    }
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
        function createBox(boxType, position = null) {
            const w = boxType.width;
            const h = boxType.height;
            const d = boxType.depth;
            const weight = boxType.weight;
            
            // Màu sắc tươi sáng hơn
            const categoryColors = {
                normal: 0x3b82f6,
                fragile: 0xef4444,
                heavy: 0x10b981,
                liquid: 0x06b6d4
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
            ctx.fillStyle = 'rgba(255,255,255,0.2)';
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
                roughness: 0.4, 
                metalness: 0.1,
                emissive: new THREE.Color(baseColor),
                emissiveIntensity: 0.1
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
                id: boxes.length + 1,
                originalColor: baseColor,
                createdAt: Date.now(),
                rotation: { x: 0, y: 0, z: 0 }
            };
            
            // Thêm labels trên các cạnh
           createBoxLabel(mesh, {
    width: w,
    height: h,
    depth: d,
    weight: weight,
    name: boxType.name || `Box ${mesh.userData.id}`
});
            
            scene.add(mesh);
            boxes.push(mesh);
            
            updateStats();
            updateCOG();
            saveToHistory();
            
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
    name: box.userData.name
});
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
        
        // Thêm vào hàm init
        function init() {
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
                document.getElementById('infoPanel').style.display = 'none';
            }
            
            updateStats();
            updateCOG();
            saveToHistory();
            
            return true;
        }
        
        function deleteAllBoxes() {
            if (boxes.length === 0) return;
            
            if (confirm(`Bạn có chắc muốn xóa tất cả ${boxes.length} thùng hàng?`)) {
                const boxesToDelete = [...boxes];
                boxesToDelete.forEach(box => deleteBox(box));
                selectedBox = null;
                document.getElementById('infoPanel').style.display = 'none';
                showNotification(`Đã xóa ${boxesToDelete.length} thùng hàng`, 'success');
            }
        }
        
        function saveToHistory() {
            const state = boxes.map(b => ({
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
            const boxesToDelete = [...boxes];
            boxesToDelete.forEach(box => deleteBox(box));
            boxes = [];
            
            state.forEach(saved => {
                const newBox = createBox(saved.userData, saved.position);
                newBox.rotation.copy(saved.rotation);
                newBox.userData = { ...saved.userData, id: boxes.length + 1 };
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
                    const boxesToDelete = [...boxes];
                    boxesToDelete.forEach(box => deleteBox(box));
                    boxes = [];
                    
                    currentContainer = data.container;
                    updateContainerVisual();
                    
                    boxTypes = data.boxTypes || [];
                    updateBoxTypeList();
                    
                    data.boxes.forEach(savedBox => {
                        createBox(savedBox.userData, new THREE.Vector3(
                            savedBox.position.x,
                            savedBox.position.y,
                            savedBox.position.z
                        ));
                    });
                    
                    updateStats();
                    updateCOG();
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
            const volPercent = containerVol > 0 ? (totalVol / containerVol * 100).toFixed(1) : 0;
            const weightPercent = currentContainer.maxLoad > 0 ? (totalWeight / currentContainer.maxLoad * 100).toFixed(1) : 0;
            
            // Update text elements
            const boxCountEl = document.getElementById('boxCount');
            const volumePercentEl = document.getElementById('volumePercent');
            const weightDisplayEl = document.getElementById('weightDisplay');
            const containerVolumeEl = document.getElementById('containerVolume');
            const maxLoadEl = document.getElementById('maxLoad');
            
            if (boxCountEl) boxCountEl.innerHTML = count;
            if (volumePercentEl) volumePercentEl.innerHTML = volPercent;
            if (weightDisplayEl) weightDisplayEl.innerHTML = totalWeight.toLocaleString();
            if (containerVolumeEl) containerVolumeEl.innerHTML = (containerVol / 1000000).toFixed(2);
            if (maxLoadEl) maxLoadEl.innerHTML = currentContainer.maxLoad.toLocaleString();
            
            // Update progress bars
            const volBar = document.getElementById('volumeBar');
            const weightBar = document.getElementById('weightBar');
            if (volBar) {
                volBar.style.width = `${Math.min(volPercent, 100)}%`;
                volBar.style.background = volPercent > 80 ? '#10b981' : (volPercent > 50 ? '#f59e0b' : '#3b82f6');
            }
            if (weightBar) {
                weightBar.style.width = `${Math.min(weightPercent, 100)}%`;
                weightBar.style.background = weightPercent > 80 ? '#ef4444' : (weightPercent > 50 ? '#f59e0b' : '#10b981');
            }
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
            if (boxTypes.length === 0 && boxes.length === 0) {
                showNotification('Vui lòng thêm thùng hàng trước', 'warning');
                return;
            }
            
            showNotification('🔄 Đang chạy AI Cơ bản...', 'info', 1500);
            
            const allBoxes = [];
            if (boxTypes.length > 0) {
                boxTypes.forEach(bt => {
                    for (let i = 0; i < bt.quantity; i++) allBoxes.push({ ...bt });
                });
            } else {
                boxes.forEach(b => allBoxes.push({ ...b.userData }));
            }
            
            allBoxes.sort((a, b) => (b.width * b.height * b.depth) - (a.width * a.height * a.depth));
            
            const boxesToDelete = [...boxes];
            boxesToDelete.forEach(b => deleteBox(b));
            
            let x = -currentContainer.w / 2, y = 0, z = -currentContainer.d / 2;
            let rowHeight = 0;
            let packed = 0;
            
            for (const box of allBoxes) {
                if (x + box.width <= currentContainer.w / 2) {
                    createBox(box, new THREE.Vector3(x + box.width / 2, y + box.height / 2, z + box.depth / 2));
                    x += box.width + 1;
                    rowHeight = Math.max(rowHeight, box.height);
                    packed++;
                } else if (z + box.depth <= currentContainer.d / 2) {
                    x = -currentContainer.w / 2;
                    z += rowHeight + 1;
                    rowHeight = 0;
                    createBox(box, new THREE.Vector3(x + box.width / 2, y + box.height / 2, z + box.depth / 2));
                    x += box.width + 1;
                    rowHeight = box.height;
                    packed++;
                } else if (y + box.height <= currentContainer.h) {
                    y += rowHeight + 1;
                    x = -currentContainer.w / 2;
                    z = -currentContainer.d / 2;
                    rowHeight = 0;
                    createBox(box, new THREE.Vector3(x + box.width / 2, y + box.height / 2, z + box.depth / 2));
                    x += box.width + 1;
                    rowHeight = box.height;
                    packed++;
                }
            }
            
            updateStats();
            saveToHistory();
            showNotification(`✅ Đã xếp ${packed}/${allBoxes.length} thùng bằng AI cơ bản`, 'success');
        }
        
        function runAIPro() {
            if (boxTypes.length === 0 && boxes.length === 0) {
                showNotification('Vui lòng thêm thùng hàng trước', 'warning');
                return;
            }
            
            if (!currentUser?.subscription?.features?.aiPro) {
                showNotification('Tính năng AI Pro yêu cầu nâng cấp tài khoản!', 'warning');
                return;
            }
            
            showNotification('🔄 Đang chạy AI Pro với 4 chiến lược...', 'info', 2000);
            
            const allBoxes = [];
            if (boxTypes.length > 0) {
                boxTypes.forEach(bt => {
                    for (let i = 0; i < bt.quantity; i++) allBoxes.push({ ...bt });
                });
            } else {
                boxes.forEach(b => allBoxes.push({ ...b.userData }));
            }
            
            const packer = new AdvancedPacker(currentContainer, allBoxes);
            const results = packer.runAll();
            const best = results[0];
            
            const boxesToDelete = [...boxes];
            boxesToDelete.forEach(b => deleteBox(b));
            
            best.placed.forEach(p => {
                createBox(p.item, new THREE.Vector3(p.pos.x, p.pos.y, p.pos.z));
            });
            
            const strategyDiv = document.getElementById('strategyComparison');
            if (strategyDiv) {
                strategyDiv.innerHTML = `
                    <div style="font-weight:bold; margin-bottom:8px;">📊 Kết quả 4 chiến lược:</div>
                    ${results.map(r => `<div class="strategy-result" style="display:flex; justify-content:space-between; padding:6px 0;"><span><strong>${r.name}:</strong></span><span>${r.count} thùng</span><span style="color:${r.volume > 70 ? '#10b981' : '#f59e0b'}">${r.volume.toFixed(1)}%</span></div>`).join('')}
                    <div style="margin-top:8px; padding-top:8px; border-top:1px solid #ddd;">🏆 <strong>Tối ưu nhất:</strong> ${best.name} (${best.count}/${allBoxes.length} thùng)</div>
                `;
            }
            
            updateStats();
            saveToHistory();
            showNotification(`✅ ${best.name}: ${best.count}/${allBoxes.length} thùng, hiệu suất ${best.volume.toFixed(1)}%`, 'success');
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
                return;
            }
            
            container.innerHTML = boxTypes.map((bt, idx) => `
                <div class="box-type-item" style="background:var(--gray-light); border-radius:12px; padding:12px; margin-bottom:8px; border-left:3px solid var(--primary);">
                    <div class="box-type-info">
                        <strong style="color:var(--primary);">${bt.name}</strong>
                        <span style="display:inline-block; font-size:11px; color:var(--gray); margin-right:12px;">📏 ${bt.width}x${bt.height}x${bt.depth} cm</span>
                        <span style="display:inline-block; font-size:11px; color:var(--gray); margin-right:12px;">⚖️ ${bt.weight} kg</span>
                        <span style="display:inline-block; font-size:11px; color:var(--gray); margin-right:12px;">🔢 SL: ${bt.quantity}</span>
                        ${bt.fragile ? '<span class="badge fragile" style="background:#fef3c7; color:#d97706; padding:2px 8px; border-radius:12px; font-size:10px;">⚠️ Dễ vỡ</span>' : ''}
                        ${bt.hazardous ? '<span class="badge hazardous" style="background:#fee2e2; color:#dc2626; padding:2px 8px; border-radius:12px; font-size:10px;">☠️ Nguy hiểm</span>' : ''}
                    </div>
                    <div class="box-type-actions" style="display:flex; gap:8px; margin-top:10px;">
                        <button class="create-batch" data-idx="${idx}" style="background:white; border:1px solid var(--gray-light); padding:6px 12px; border-radius:8px; font-size:11px; cursor:pointer;">📦 Tạo thùng</button>
                        <button class="remove-type" data-idx="${idx}" style="background:white; border:1px solid var(--gray-light); padding:6px 12px; border-radius:8px; font-size:11px; cursor:pointer;">🗑️ Xóa loại</button>
                    </div>
                </div>
            `).join('');
            
            document.querySelectorAll('.create-batch').forEach(btn => {
                btn.addEventListener('click', () => {
                    const idx = parseInt(btn.dataset.idx);
                    const bt = boxTypes[idx];
                    const maxBoxes = currentUser?.subscription?.features?.maxBoxes || 50;
                    if (boxes.length + bt.quantity > maxBoxes && maxBoxes !== Infinity) {
                        showNotification(`Giới hạn ${maxBoxes} thùng. Vui lòng nâng cấp!`, 'warning');
                        return;
                    }
                    for (let i = 0; i < bt.quantity; i++) {
                        const pos = new THREE.Vector3(
                            -currentContainer.w/2 + bt.width/2 + (Math.random() - 0.5) * 200,
                            bt.height/2,
                            -currentContainer.d/2 + bt.depth/2 + (Math.random() - 0.5) * 400
                        );
                        createBox(bt, pos);
                    }
                    updateStats();
                    showNotification(`Đã tạo ${bt.quantity} thùng ${bt.name}`, 'success');
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
        }
        
        function compareContainers() {
            if (boxTypes.length === 0 && boxes.length === 0) {
                showNotification('Vui lòng thêm thùng hàng trước', 'warning');
                return;
            }
            
            const allBoxes = [];
            if (boxTypes.length > 0) {
                boxTypes.forEach(bt => {
                    for (let i = 0; i < bt.quantity; i++) {
                        allBoxes.push({ volume: bt.width * bt.height * bt.depth, weight: bt.weight });
                    }
                });
            } else {
                boxes.forEach(b => {
                    allBoxes.push({ volume: b.userData.width * b.userData.height * b.userData.depth, weight: b.userData.weight });
                });
            }
            
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
                    
                    const boxesToDelete = [...boxes];
                    boxesToDelete.forEach(box => deleteBox(box));
                    boxes = [];
                    
                    if (data.container) {
                        currentContainer = {
                            ...currentContainer,
                            w: data.container.dimensions.width,
                            h: data.container.dimensions.height,
                            d: data.container.dimensions.depth,
                            maxLoad: data.container.maxLoad
                        };
                        updateContainerVisual();
                        
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
                            ));
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
                contSelect.innerHTML = '';
                Object.entries(CONTAINER_TYPES).forEach(([key, val]) => {
                    const opt = document.createElement('option');
                    opt.value = key;
                    opt.textContent = `${val.name} (${val.w}x${val.h}x${val.d} cm)`;
                    contSelect.appendChild(opt);
                });
                contSelect.value = '40hc';
                contSelect.onchange = (e) => {
                    currentContainer = { ...CONTAINER_TYPES[e.target.value] };
                    const cw = document.getElementById('cw');
                    const ch = document.getElementById('ch');
                    const cd = document.getElementById('cd');
                    if (cw) cw.value = currentContainer.w;
                    if (ch) ch.value = currentContainer.h;
                    if (cd) cd.value = currentContainer.d;
                    updateContainerVisual();
                    updateStats();
                    updateCOG();
                    showNotification(`Đã chuyển sang ${currentContainer.name}`, 'info');
                };
            }
            
            const cwInput = document.getElementById('cw');
            const chInput = document.getElementById('ch');
            const cdInput = document.getElementById('cd');
            
            if (cwInput) cwInput.onchange = () => {
                currentContainer.w = parseFloat(cwInput.value);
                updateContainerVisual();
                updateStats();
            };
            if (chInput) chInput.onchange = () => {
                currentContainer.h = parseFloat(chInput.value);
                updateContainerVisual();
                updateStats();
            };
            if (cdInput) cdInput.onchange = () => {
                currentContainer.d = parseFloat(cdInput.value);
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
                    
                    if (!width || !height || !depth || !weight || !quantity) {
                        showNotification('Vui lòng nhập đầy đủ thông tin', 'warning');
                        return;
                    }
                    
                    boxTypes.push({
                        name: name || `Thùng ${boxTypes.length + 1}`,
                        width, height, depth, weight, quantity,
                        fixedOrientation: document.getElementById('fixedOrientation').checked,
                        fragile: document.getElementById('fragile').checked,
                        hazardous: document.getElementById('hazardous').checked,
                        category: document.getElementById('boxCategory').value
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
                    document.getElementById('fragile').checked = false;
                    document.getElementById('hazardous').checked = false;
                };
            }
            
            // AI buttons
            const btnAI = document.getElementById('btnAI');
            const btnAIPro = document.getElementById('btnAIPro');
            if (btnAI) btnAI.onclick = runAIBasic;
            if (btnAIPro) btnAIPro.onclick = runAIPro;
            
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
                    showNotification('Chế độ xoay (Giữ Shift + kéo để xoay)', 'info', 1500);
                };
            }
            
            // Export
            const exportPDFBtn = document.getElementById('exportPDF');
            const exportCSVBtn = document.getElementById('exportCSV');
            const btnScreenshot = document.getElementById('btnScreenshot');
            
            if (exportPDFBtn) exportPDFBtn.onclick = exportPDF;
            if (exportCSVBtn) exportCSVBtn.onclick = exportCSV;
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
        
        // Show selection info bar
        function showSelectionInfoBar(box) {
            const bar = document.getElementById('selectionInfoBar');
            const text = document.getElementById('selectionInfoText');
            if (bar && text && box) {
                text.innerHTML = `📦 ${box.userData.name || `Thùng ${box.userData.id}`} | ${box.userData.weight}kg`;
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
        
        function showQuickAddPanel() {
            const panel = document.getElementById('quickAddPanel');
            const list = document.getElementById('quickAddList');
            if (panel && list) {
                list.innerHTML = QUICK_BOX_TEMPLATES.map((template, idx) => `
                    <div class="quick-add-item" data-idx="${idx}">
                        <span>${template.name}</span>
                        <span style="font-size:11px; color:var(--gray);">${template.width}x${template.height}x${template.depth}</span>
                    </div>
                `).join('');
                document.querySelectorAll('.quick-add-item').forEach(item => {
                    item.addEventListener('click', () => {
                        const idx = parseInt(item.dataset.idx);
                        const template = QUICK_BOX_TEMPLATES[idx];
                        const maxBoxes = currentUser?.subscription?.features?.maxBoxes || 50;
                        if (boxes.length >= maxBoxes && maxBoxes !== Infinity) {
                            showNotification(`Giới hạn ${maxBoxes} thùng!`, 'warning');
                            return;
                        }
                        const pos = new THREE.Vector3(
                            -currentContainer.w/2 + template.width/2,
                            template.height/2,
                            -currentContainer.d/2 + template.depth/2
                        );
                        createBox(template, pos);
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
                category: selectedBox.userData.category
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
            if (selectionMoveUp) selectionMoveUp.onclick = () => { if (selectedBox) moveBoxUp(selectedBox); };
            if (selectionMoveDown) selectionMoveDown.onclick = () => { if (selectedBox) moveBoxDown(selectedBox); };
            if (selectionDelete) selectionDelete.onclick = () => { if (selectedBox) { deleteBox(selectedBox); selectedBox = null; hideSelectionInfoBar(); document.getElementById('infoPanel').style.display = 'none'; } };
            if (selectionCenter) selectionCenter.onclick = () => { if (selectedBox) centerOnBox(selectedBox); };
            
            window.addEventListener('keydown', (e) => {
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
            init3D();
            setupEventHandlers();
            setupNewEventHandlers();
            checkAuth();
            loadFromLocal();
            
            setTimeout(() => {
                if (boxTypes.length === 0 && boxes.length === 0) {
                    boxTypes = [
                        { name: 'Hàng tiêu chuẩn A', width: 60, height: 50, depth: 80, weight: 25, quantity: 6, fixedOrientation: false, fragile: false, hazardous: false, category: 'normal' },
                        { name: 'Hàng dễ vỡ B', width: 45, height: 40, depth: 60, weight: 15, quantity: 4, fixedOrientation: true, fragile: true, hazardous: false, category: 'fragile' },
                        { name: 'Hàng nặng C', width: 100, height: 60, depth: 80, weight: 80, quantity: 2, fixedOrientation: false, fragile: false, hazardous: false, category: 'heavy' }
                    ];
                    updateBoxTypeList();
                }
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
        }
        
        init();
    });
})();