import * as THREE from 'three';
import { audioManager } from './audioManager.js'; // new import

const PALETTE = [0xcccccc, 0xef4444, 0xf97316, 0xeab308, 0x22c55e, 0x3b82f6, 0x8b5cf6, 0xec4899];

function createGhostSword() {
    const sword = new THREE.Group();
    const bladeGeometry = new THREE.BoxGeometry(0.03, 0.8, 0.15);
    const material = new THREE.MeshBasicMaterial({ 
        color: 0xC0C0C0, 
        opacity: 0.5, 
        transparent: true,
        wireframe: true
    });
    const blade = new THREE.Mesh(bladeGeometry, material);
    blade.position.y = 0.4;
    sword.add(blade);
    sword.scale.set(1.5, 1.5, 1.5);
    sword.rotation.x = Math.PI / 4;
    return sword;
}

function createGhostBazooka() {
    const bazooka = new THREE.Group();
    const material = new THREE.MeshBasicMaterial({ 
        color: 0x22c55e,
        opacity: 0.5,
        transparent: true,
        wireframe: true
    });
    const tubeGeo = new THREE.BoxGeometry(0.2, 0.2, 1.2);
    const tube = new THREE.Mesh(tubeGeo, material);
    bazooka.add(tube);
    bazooka.scale.set(1.5, 1.5, 1.5);
    bazooka.rotation.x = Math.PI / 4;
    return bazooka;
}

// New ghost house preview
function createGhostHouse() {
    const house = new THREE.Group();
    const baseMat = new THREE.MeshBasicMaterial({ color: 0xcccccc, opacity: 0.5, transparent: true, wireframe: true });
    const base = new THREE.Mesh(new THREE.BoxGeometry(2, 1.2, 2), baseMat);
    base.position.y = 0.6;
    house.add(base);
    const roofMat = new THREE.MeshBasicMaterial({ color: 0x333333, opacity: 0.5, transparent: true, wireframe: true });
    const roof = new THREE.Mesh(new THREE.ConeGeometry(1.5, 0.8, 4), roofMat);
    roof.position.y = 1.6;
    roof.rotation.y = Math.PI / 4;
    house.add(roof);
    house.visible = false;
    return house;
}

// new ghost boombox preview
function createGhostBoombox() {
    const box = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ color: 0x222222, opacity: 0.6, transparent: true, wireframe: true });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.5, 0.35), mat);
    body.position.y = 0.25;
    box.add(body);
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.05, 0.05), mat);
    handle.position.set(0, 0.5, 0);
    box.add(handle);
    box.scale.set(1.6, 1.6, 1.6);
    box.visible = false;
    return box;
}

// New ghost horse preview
function createGhostHorse() {
    const horse = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ 
        color: 0x8b5a2b, 
        opacity: 0.5, 
        transparent: true,
        wireframe: true
    });

    // Body (larger box)
    const bodyGeo = new THREE.BoxGeometry(1.2, 0.8, 0.4);
    const body = new THREE.Mesh(bodyGeo, mat);
    body.position.y = 0.4;
    horse.add(body);

    // Head (smaller box forward)
    const headGeo = new THREE.BoxGeometry(0.4, 0.4, 0.4);
    const head = new THREE.Mesh(headGeo, mat);
    head.position.set(0, 0.7, 0.7);
    horse.add(head);

    // Legs (cylinders, positioned below body)
    const legGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.8, 8);
    for (let i = 0; i < 4; i++) {
        const leg = new THREE.Mesh(legGeo, mat);
        let x = (i % 2 === 0 ? -0.4 : 0.4);
        let z = (i < 2 ? -0.1 : 0.1);
        leg.position.set(x, -0.4, z);
        body.add(leg);
    }

    horse.scale.set(1.5, 1.5, 1.5);
    horse.visible = false;
    return horse;
}


export class StudioManager {
    constructor(scene, camera, domElement, room, playerControls, experienceId) {
        this.scene = scene;
        this.camera = camera;
        this.domElement = domElement;
        this.room = room;
        this.playerControls = playerControls;
        this.experienceId = experienceId; // Store experienceId

        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        
        this.ghostBlock = this.createGhostBlock();
        this.ghostSign = this.createGhostSign(); // added ghostSign
        this.ghostSword = createGhostSword();
        this.ghostBazooka = createGhostBazooka();
        this.ghostHouse = createGhostHouse(); // added ghostHouse
        this.ghostBoombox = createGhostBoombox(); // added ghostBoombox
        this.ghostHorse = createGhostHorse(); // added ghostHorse
        this.scene.add(this.ghostBlock);
        this.scene.add(this.ghostSign);
        this.scene.add(this.ghostSword);
        this.scene.add(this.ghostBazooka);
        this.scene.add(this.ghostHouse);
        this.scene.add(this.ghostBoombox);
        this.scene.add(this.ghostHorse);

        this.domElement.addEventListener('mousemove', this.onMouseMove.bind(this));
        this.domElement.addEventListener('mousedown', this.onMouseDown.bind(this));
        this.domElement.addEventListener('contextmenu', e => e.preventDefault());
        document.addEventListener('keydown', this.onKeyDown.bind(this));

        this.isBuildMode = true;
        this.playerControls.controls.enableRotate = false;
        this.selectedColor = PALETTE[0];
        this.selectedTool = 'block'; // 'block', 'sword', or 'bazooka'
        // Studio UI has been moved to the Create screen in the menu (app.js),
        // so we no longer auto-create the HUD here. keep updateTool to set ghost visibility.
        this.updateTool();

        // Play studio music (looped). AudioManager will initialize on first user interaction if needed.
        // audioManager.playSound('explore_roblox', { loop: true, volume: 0.6 });
    }

    createGhostBlock() {
        const geometry = new THREE.BoxGeometry(1.01, 1.01, 1.01);
        const material = new THREE.MeshBasicMaterial({ 
            color: this.selectedColor, 
            opacity: 0.5, 
            transparent: true,
            wireframe: true
        });
        const ghost = new THREE.Mesh(geometry, material);
        ghost.visible = false;
        return ghost;
    }
    
    createGhostSign() {
        const group = new THREE.Group();
        const board = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.6, 0.06), new THREE.MeshBasicMaterial({ color: 0x8b5a2b, opacity: 0.6, transparent: true }));
        board.position.y = 0.3;
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.0, 0.08), new THREE.MeshBasicMaterial({ color: 0x5C3D2E, opacity: 0.6, transparent: true }));
        // move post down and slightly behind the board so it doesn't overlap the writing surface
        post.position.set(0, -0.35, -0.25);
        group.add(board);
        group.add(post);
        group.visible = false;
        return group;
    }

    setupStudioUI() {
        // Simplified Studio UI: two choices and an iframe webview for "Create"
        const hud = document.createElement('div');
        hud.className = 'studio-hud';
        hud.innerHTML = `
            <h3>Studio</h3>
            <div id="studio-choices" style="display:flex;flex-direction:column;gap:8px;">
                <button id="studio-share-button" style="width:100%;padding:10px;background:#3b82f6;color:white;border:none;border-radius:6px;cursor:pointer;font-weight:bold;">Paylaş</button>
                <button id="studio-create-button" style="width:100%;padding:10px;background:#4CAF50;color:white;border:none;border-radius:6px;cursor:pointer;font-weight:bold;">Oluştur</button>
            </div>
        `;
        document.getElementById('game-container').appendChild(hud);

        // Create iframe container (hidden initially)
        this.iframeOverlay = document.createElement('div');
        this.iframeOverlay.style.position = 'fixed';
        this.iframeOverlay.style.inset = '0';
        this.iframeOverlay.style.background = 'rgba(0,0,0,0.85)';
        this.iframeOverlay.style.display = 'none';
        this.iframeOverlay.style.zIndex = '12000';
        this.iframeOverlay.style.justifyContent = 'center';
        this.iframeOverlay.style.alignItems = 'center';
        this.iframeOverlay.innerHTML = `
            <div style="width:90%;height:86%;background:#fff;border-radius:8px;overflow:hidden;display:flex;flex-direction:column;">
                <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;background:#111;color:#fff;">
                    <div style="font-weight:bold">Studio - Oluştur</div>
                    <div>
                        <button id="iframe-back-button" style="margin-right:8px;padding:6px 10px;border-radius:6px;border:none;background:#ef4444;color:white;cursor:pointer;">Geri Dön</button>
                        <a id="iframe-open-new" target="_blank" rel="noopener" style="padding:6px 10px;border-radius:6px;border:none;background:#222;color:#fff;text-decoration:none;font-size:13px;">Yeni Sekmede Aç</a>
                    </div>
                </div>
                <iframe id="studio-iframe" src="" style="flex:1;border:0;"></iframe>
            </div>
        `;
        document.body.appendChild(this.iframeOverlay);

        // Wire up buttons
        const createBtn = document.getElementById('studio-create-button');
        const shareBtn = document.getElementById('studio-share-button');
        const iframeBack = this.iframeOverlay.querySelector('#iframe-back-button');
        const iframeElem = this.iframeOverlay.querySelector('#studio-iframe');
        const iframeOpenNew = this.iframeOverlay.querySelector('#iframe-open-new');

        // Share button: currently will prompt to send a webrtc_save share request (host persists)
        shareBtn.addEventListener('click', () => {
            // Simple share request: ask host to add a share flag in experience metadata
            this.room.send({
                type: 'webrtc_save',
                echo: true,
                payload: {
                    worlds: {
                        [this.experienceId]: {
                            shared: true,
                            shared_at: Date.now()
                        }
                    }
                }
            });
            alert('Paylaşma isteği gönderildi (host uygulayacak).');
        });

        // Create button: open external studio page inside iframe
        createBtn.addEventListener('click', () => {
            // Hide choices and show iframe overlay
            document.getElementById('studio-choices').style.display = 'none';
            this.iframeOverlay.style.display = 'flex';
            // Set iframe src to requested external studio page
            const url = 'https://mazda984.github.io/studio/';
            iframeElem.src = url;
            iframeOpenNew.href = url;
        });

        // Back button returns to choice view and unloads iframe
        iframeBack.addEventListener('click', () => {
            this.iframeOverlay.style.display = 'none';
            document.getElementById('studio-choices').style.display = 'flex';
            // unload iframe to free resources
            iframeElem.src = 'about:blank';
        });

        // Ensure initial time/music sync controls still reflect room state, but we no longer expose build tools
        this.initialTimeSync();
        this.initialMusicSync();
    }
    
    // New method to sync time from room state upon initialization
    initialTimeSync() {
        const timeOfDay = this.room.roomState.worlds?.[this.experienceId]?.timeOfDay || 'noon';
        const timeSelect = document.getElementById('time-of-day-select');
        if (timeSelect) {
            timeSelect.value = timeOfDay;
        }
    }

    // New method to update time of day in room state
    setTimeOfDayInWorld(time) {
        // Request host to persist time-of-day via WebRTC save
        this.room.send({
            type: 'webrtc_save',
            echo: true,
            payload: {
                worlds: {
                    [this.experienceId]: {
                        timeOfDay: time
                    }
                }
            }
        });
    }

    // New method to sync music from room state upon initialization
    initialMusicSync() {
        const musicTrack = this.room.roomState.worlds?.[this.experienceId]?.backgroundMusic || 'explore_roblox';
        const musicSelect = document.getElementById('music-select');
        if (musicSelect) {
            musicSelect.value = musicTrack;
        }
        this.updateStudioMusic(musicTrack);
    }

    // New method to update background music in room state and play locally
    setMusicInWorld(musicTrack) {
        // Request host to persist music selection via WebRTC save
        this.room.send({
            type: 'webrtc_save',
            echo: true,
            payload: {
                worlds: {
                    [this.experienceId]: {
                        backgroundMusic: musicTrack
                    }
                }
            }
        });
        this.updateStudioMusic(musicTrack);
    }

    updateStudioMusic(musicTrack) {
        // Stop all known background music tracks
        audioManager.stopSound('explore_roblox');
        audioManager.stopSound('the_great_strategy');
        
        if (musicTrack && musicTrack !== 'none') {
            audioManager.playSound(musicTrack, { loop: true, volume: 0.6 });
        }
    }

    updateTool() {
        document.querySelectorAll('.tool-item').forEach(item => {
            item.classList.toggle('active', item.dataset.tool === this.selectedTool);
        });
        document.getElementById('palette-container').style.display = this.selectedTool === 'block' ? 'block' : 'none';
        
        this.ghostBlock.visible = this.selectedTool === 'block' && this.isBuildMode;
        this.ghostSword.visible = this.selectedTool === 'sword' && this.isBuildMode;
        this.ghostBazooka.visible = this.selectedTool === 'bazooka' && this.isBuildMode;
        this.ghostHouse.visible = this.selectedTool === 'house' && this.isBuildMode; // show house ghost
        this.ghostBoombox.visible = this.selectedTool === 'boombox' && this.isBuildMode;
        this.ghostSign.visible = this.selectedTool === 'sign' && this.isBuildMode;
        this.ghostHorse.visible = this.selectedTool === 'horse' && this.isBuildMode;
        
        // If code tool selected, keep ghost sign hidden but indicate code mode via HUD
        if (this.selectedTool === 'code') {
            this.ghostBlock.visible = false;
            this.ghostSword.visible = false;
            this.ghostBazooka.visible = false;
            this.ghostHouse.visible = false;
            this.ghostBoombox.visible = false;
            this.ghostSign.visible = false;
            this.ghostHorse.visible = false;
        }
    }

    selectColor(color) {
        this.selectedColor = color;
        this.ghostBlock.material.color.setHex(color);
        
        document.querySelectorAll('.color-swatch').forEach(sw => {
            sw.classList.toggle('active', parseInt(sw.dataset.color) === color);
        });
    }

    onKeyDown(e) {
        if (e.key.toLowerCase() === 'b') {
            this.toggleBuildMode();
        }
    }

    toggleBuildMode() {
        this.isBuildMode = !this.isBuildMode;
        this.playerControls.controls.enableRotate = !this.isBuildMode;
        this.updateTool(); // This will correctly set ghost visibility
        console.log(`Build mode: ${this.isBuildMode}`);

        // Keep studio music playing for the entire studio session; ensure it's started when entering build mode
        if (this.isBuildMode) {
            const musicTrack = document.getElementById('music-select')?.value || 'explore_roblox';
            this.updateStudioMusic(musicTrack);
        }
    }

    toggleTestMode() {
        this.testMode = !this.testMode;
        const testButton = document.getElementById('studio-test-button');
        
        if (this.testMode) {
            testButton.textContent = '⏹ Stop Test';
            testButton.style.background = '#ef4444';
            this.playerControls.playerModel.visible = true;
            this.playerControls.enabled = true;
            this.playerControls.controls.enableRotate = true;
            this.playerControls.setTestMode(true); // Set test mode
            this.playerControls.setNoclip(false); // Disable noclip when testing
        } else {
            testButton.textContent = '▶ Test';
            testButton.style.background = '#4CAF50';
            this.playerControls.playerModel.visible = false;
            this.playerControls.enabled = false;
            this.playerControls.controls.enableRotate = false;
            this.playerControls.setTestMode(false); // Disable test mode
            this.playerControls.setNoclip(true); // Enable noclip when building
            // Save NPC positions before exiting test mode
            if (this.npcManager) {
                this.npcManager.saveNPCPositions();
            }
        }
    }

    onMouseMove(event) {
        if (!this.isBuildMode) return;
        this.updateMouse(event);
        this.updateGhostObject();
    }

    onMouseDown(event) {
        if (!this.isBuildMode) return;

        event.preventDefault();
        this.updateMouse(event);
        
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const worldObjects = this.scene.getObjectByName('worldObjects');
        const ground = this.scene.children.find(c => c.geometry instanceof THREE.PlaneGeometry);
        const intersectables = [ground, ...(worldObjects?.children || [])].filter(Boolean);
        const intersects = this.raycaster.intersectObjects(intersectables, true);

        if (event.button === 0) { // Left click to add
            this.addObject(intersects);
        } else if (event.button === 2) { // Right click to remove
            this.removeObject(intersects);
        } else if (event.button === 1) { // Middle click to paint
            if (this.selectedTool === 'block') {
              this.paintBlock(intersects);
            }
        }
    }

    addObject(intersects) {
        const intersect = intersects[0];
        if (!intersect) return;

        // If code-tool is active, open global script creator
        if (this.selectedTool === 'code') {
            // create a new script id and prefill (or edit global script)
            this.openCodeEditor({ targetType: 'global' });
            return;
        }

        const pos = intersect.point.add(intersect.face.normal.multiplyScalar(0.5));

        const newObjectPos = {
            x: Math.round(pos.x - 0.5) + 0.5,
            y: Math.max(0.5, Math.round(pos.y - 0.5) + 0.5),
            z: Math.round(pos.z - 0.5) + 0.5
        };

        const objectId = 'obj_' + Date.now();
        let newObjectData;

        if (this.selectedTool === 'block') {
            newObjectData = {
                id: objectId,
                type: 'box',
                position: newObjectPos,
                color: this.selectedColor
            };
        } else if (this.selectedTool === 'sword') {
             newObjectData = {
                id: objectId,
                type: 'sword',
                position: { x: pos.x, y: pos.y, z: pos.z }, // swords can be placed more freely
            };
        } else if (this.selectedTool === 'bazooka') {
            newObjectData = {
                id: objectId,
                type: 'bazooka',
                position: { x: pos.x, y: pos.y, z: pos.z },
            };
        } else if (this.selectedTool === 'boombox') {
            // Boombox: a small music-emitting object
            newObjectData = {
                id: objectId,
                type: 'boombox',
                position: { x: pos.x, y: Math.max(0.25, pos.y), z: pos.z },
                song: 'explore_roblox',
                volume: 0.8
            };
        } else if (this.selectedTool === 'house') {
            // house occupies a 2x2 base and sits on rounded grid
            const housePos = {
                x: Math.round(pos.x - 1) + 1,
                y: Math.max(0.6, Math.round(pos.y - 0.6) + 0.6),
                z: Math.round(pos.z - 1) + 1
            };
            newObjectData = {
                id: objectId,
                type: 'house',
                position: housePos,
                color: this.selectedColor
            };
        } else if (this.selectedTool === 'parkour') {
            // place a parkour platform (small flat platform)
            const platformPos = {
                x: Math.round(pos.x - 0.5) + 0.5,
                y: Math.max(0.3, Math.round(pos.y - 0.3) + 0.3),
                z: Math.round(pos.z - 0.5) + 0.5
            };
            newObjectData = {
                id: objectId,
                type: 'parkour_platform',
                position: platformPos,
                size: { w: 1 + (Math.random() * 1.5), d: 1 + (Math.random() * 1.0) }
            };
        } else if (this.selectedTool === 'sign') {
            // place a sign
            const signPos = {
                x: Math.round(pos.x - 0.5) + 0.5,
                y: Math.max(0.3, Math.round(pos.y - 0.3) + 0.3),
                z: Math.round(pos.z - 0.5) + 0.5
            };
            newObjectData = {
                id: objectId,
                type: 'sign',
                position: signPos,
                text: ''
            };
        } else if (this.selectedTool === 'horse') {
            const horsePos = {
                x: Math.round(pos.x - 0.5) + 0.5,
                y: Math.max(0, Math.round(pos.y)),
                z: Math.round(pos.z - 0.5) + 0.5
            };
            newObjectData = {
                id: objectId,
                type: 'horse',
                position: horsePos,
                health: 100, // Initialize NPC health
                attackDamage: 15
            };
        }

        if (newObjectData) {
            // Ask host to persist new world object via WebRTC save
            this.room.send({
                type: 'webrtc_save',
                echo: true,
                payload: {
                    worlds: {
                        [this.experienceId]: {
                            worldObjects: { [objectId]: newObjectData }
                        }
                    }
                }
            });
            // If this is a sign, immediately prompt the user to enter text (studio-only)
            if (newObjectData.type === 'sign' && this.isBuildMode) {
                setTimeout(() => {
                    const text = prompt("Enter sign text:", "") || "";
                    const html = `<div>${this.escapeHtml(text)}</div>`;
                    this.room.send({
                        type: 'webrtc_save',
                        echo: true,
                        payload: {
                            worlds: {
                                [this.experienceId]: {
                                    worldObjects: {
                                        [objectId]: {
                                            ...newObjectData,
                                            text: html
                                        }
                                    }
                                }
                            }
                        }
                    });
                    // After creating a sign, offer to add a script attached to this sign
                    setTimeout(() => {
                        if (confirm('Add a script to this sign? (Studio only)')) {
                            this.openCodeEditor({ targetType: 'object', objectId: objectId });
                        }
                    }, 100);
                }, 100);
            }
        }
    }

    removeObject(intersects) {
        let objectToRemove = null;
        for (const intersect of intersects) {
            let current = intersect.object;
            while(current) {
                if (current.userData.isWorldObject) {
                    objectToRemove = current;
                    break;
                }
                current = current.parent;
            }
            if (objectToRemove) break;
        }

        if (objectToRemove) {
            // Request host to remove object
            this.room.send({
                type: 'webrtc_save',
                echo: true,
                payload: {
                    worlds: {
                        [this.experienceId]: {
                            worldObjects: { [objectToRemove.name]: null }
                        }
                    }
                }
            });
        }
    }

    paintBlock(intersects) {
        const worldObject = intersects.find(i => i.object.userData.isWorldObject)?.object;
        if (worldObject) {
            const currentData = this.room.roomState.worlds?.[this.experienceId]?.worldObjects?.[worldObject.name];
            if (currentData && currentData.type === 'box' && currentData.color !== this.selectedColor) {
                // Request host to update block color
                this.room.send({
                    type: 'webrtc_save',
                    echo: true,
                    payload: {
                        worlds: {
                            [this.experienceId]: {
                                worldObjects: {
                                    [worldObject.name]: {
                                        ...currentData,
                                        color: this.selectedColor
                                    }
                                }
                            }
                        }
                    }
                });
            }
        }
    }

    updateMouse(event) {
        this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    }

    updateGhostObject() {
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const worldObjects = this.scene.getObjectByName('worldObjects');
        const ground = this.scene.children.find(c => c.geometry instanceof THREE.PlaneGeometry);
        const intersectables = [ground, ...(worldObjects?.children || [])].filter(Boolean);
        const intersect = this.raycaster.intersectObjects(intersectables, true)[0];
        
        let ghost;
        switch(this.selectedTool) {
            case 'sword': ghost = this.ghostSword; break;
            case 'bazooka': ghost = this.ghostBazooka; break;
            case 'sign': ghost = this.ghostSign; break;
            case 'horse': ghost = this.ghostHorse; break;
            default: ghost = this.ghostBlock;
        }

        if (intersect) {
            ghost.visible = true;
            const pos = intersect.point.add(intersect.face.normal.multiplyScalar(0.5));

            if (this.selectedTool === 'block') {
                 ghost.position.set(
                    Math.round(pos.x - 0.5) + 0.5,
                    Math.max(0.5, Math.round(pos.y - 0.5) + 0.5),
                    Math.round(pos.z - 0.5) + 0.5
                );
            } else if (this.selectedTool === 'sign') {
                 // place the sign slightly above ground and snap to half-grid
                 ghost.position.set(
                    Math.round(pos.x - 0.5) + 0.5,
                    Math.max(0.3, Math.round(pos.y - 0.3) + 0.3),
                    Math.round(pos.z - 0.5) + 0.5
                 );
            } else if (this.selectedTool === 'horse') {
                 // Snap horse to ground level
                 ghost.position.set(
                    Math.round(pos.x - 0.5) + 0.5,
                    0,
                    Math.round(pos.z - 0.5) + 0.5
                 );
            } else { // sword or bazooka
                ghost.position.copy(intersect.point);
            }
        } else {
            ghost.visible = false;
        }
    }

    update() {
        // This can be used for continuous updates if needed
    }

    // Open code editor. options: { targetType: 'object'|'global', objectId?: string }
    openCodeEditor(options = {}) {
        this.currentScriptTarget = options;
        // Load existing script if present
        const worldScripts = this.room.roomState.worlds?.[this.experienceId]?.scripts || {};
        if (options.targetType === 'object' && options.objectId) {
            const existing = worldScripts[options.objectId]?.html || worldScripts[options.objectId]?.code || '';
            this.codeArea.value = existing;
        } else {
            const existing = worldScripts['__global__']?.html || worldScripts['__global__']?.code || '';
            this.codeArea.value = existing;
        }
        this.codeEditorModal.classList.remove('hidden');
    }

    closeCodeEditor() {
        this.currentScriptTarget = null;
        this.codeEditorModal.classList.add('hidden');
    }

    // small helper to avoid HTML injection when building stored HTML
    escapeHtml(str) {
        return String(str || '').replace(/[&<>"']/g, (m) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
    }

    saveScriptFromEditor() {
        const code = this.codeArea.value || '';
        const target = this.currentScriptTarget || { targetType: 'global' };
        const scriptId = target.targetType === 'object' && target.objectId ? target.objectId : '__global__';

        // persist script as HTML under worlds[experienceId].scripts[scriptId] = { html, updated_at }
        const htmlContent = `<pre style="white-space:pre-wrap;font-family:inherit;">${this.escapeHtml(code)}</pre>`;
        const payload = {
            worlds: {
                [this.experienceId]: {
                    scripts: {
                        [scriptId]: { html: htmlContent, updated_at: Date.now() }
                    }
                }
            }
        };
        // Send script save request to host via WebRTC
        this.room.send({
            type: 'webrtc_save',
            echo: true,
            payload
        });
        this.closeCodeEditor();
        alert('Script save requested (host will persist to experience state).');
    }
}