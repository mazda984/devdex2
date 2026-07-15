import * as THREE from 'three';
import { createPlayerModel } from './player.js';

export class WorldSyncManager {
    constructor(scene) {
        this.scene = scene;
        this.worldGroup = new THREE.Group();
        this.worldGroup.name = 'worldObjects';
        this.scene.add(this.worldGroup);
    }

    sync(worldObjectsData) {
        const existingIds = new Set();
        if (worldObjectsData) {
            for (const id in worldObjectsData) {
                existingIds.add(id);
                const data = worldObjectsData[id];
                let mesh = this.worldGroup.children.find(c => c.name === id);
                
                if (!mesh) {
                    mesh = this.createMeshForObject(data);
                    if (mesh) { // createMesh can return null
                        mesh.name = id;
                        mesh.position.set(data.position.x, data.position.y, data.position.z);
                        this.worldGroup.add(mesh);
                    }
                } else {
                    // Update existing mesh properties, like color
                    if (data.type === 'box' && data.color && mesh.material && mesh.material.color && mesh.material.color.getHex() !== data.color) {
                        mesh.material.color.setHex(data.color);
                    }
                    // Update sign text if changed
                    if (data.type === 'sign' && data.text !== undefined && mesh.userData.currentText !== data.text) {
                        this.updateSignText(mesh, data.text);
                    }
                }
            }
        }

        const toRemove = this.worldGroup.children.filter(child => !existingIds.has(child.name));
        toRemove.forEach(child => this.worldGroup.remove(child));
    }

    createMeshForObject(data) {
        switch(data.type) {
            case 'sword':
                return this.createSwordMesh();
            case 'bazooka':
                return this.createBazookaMesh();
            case 'sign':
                return this.createSignMesh(data);
            case 'house':
                return this.createHouseMesh();
            case 'horse':
                return this.createHorseMesh(data);
            case 'box':
            default:
                return this.createBoxMesh(data);
        }
    }

    createBoxMesh(data) {
        const geometry = new THREE.BoxGeometry(1, 1, 1);
        const color = data.color || 0xcccccc;
        const material = new THREE.MeshStandardMaterial({ color: color });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.userData.isBarrier = true; // For collision
        mesh.userData.isWorldObject = true;
        return mesh;
    }
    
    createSwordMesh() {
        const sword = new THREE.Group();

        // Hilt
        const hiltGeometry = new THREE.CylinderGeometry(0.05, 0.05, 0.2, 8);
        const hiltMaterial = new THREE.MeshStandardMaterial({ color: 0x5C3D2E });
        const hilt = new THREE.Mesh(hiltGeometry, hiltMaterial);
        hilt.position.y = 0.1;
        sword.add(hilt);

        // Guard
        const guardGeometry = new THREE.BoxGeometry(0.04, 0.04, 0.3);
        const guardMaterial = new THREE.MeshStandardMaterial({ color: 0x808080 });
        const guard = new THREE.Mesh(guardGeometry, guardMaterial);
        guard.position.y = 0.2;
        sword.add(guard);

        // Blade
        const bladeGeometry = new THREE.BoxGeometry(0.03, 0.6, 0.15);
        const bladeMaterial = new THREE.MeshStandardMaterial({ color: 0xC0C0C0, metalness: 0.8, roughness: 0.3 });
        const blade = new THREE.Mesh(bladeGeometry, bladeMaterial);
        blade.position.y = 0.52; // 0.2 (hilt) + 0.3 (half blade height)
        sword.add(blade);

        sword.userData.isWorldObject = true;
        sword.userData.isInteractable = true;
        sword.userData.isSword = true;

        sword.scale.set(1.5, 1.5, 1.5);
        sword.rotation.x = Math.PI / 4;
        
        return sword;
    }

    createBazookaMesh() {
        const bazooka = new THREE.Group();
        const tubeGeo = new THREE.CylinderGeometry(0.1, 0.1, 1, 12);
        const material = new THREE.MeshStandardMaterial({ color: 0x4f7942 });
        const tube = new THREE.Mesh(tubeGeo, material);
        tube.rotation.z = Math.PI / 2;
        bazooka.add(tube);
        
        const stockGeo = new THREE.BoxGeometry(0.2, 0.3, 0.1);
        const stockMat = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
        const stock = new THREE.Mesh(stockGeo, stockMat);
        stock.position.set(-0.5, -0.1, 0);
        bazooka.add(stock);

        bazooka.userData.isWorldObject = true;
        bazooka.userData.isInteractable = true;
        bazooka.userData.isBazooka = true;

        bazooka.scale.set(1.2, 1.2, 1.2);
        bazooka.rotation.x = Math.PI / 6;

        return bazooka;
    }

    createHouseMesh() {
        const group = new THREE.Group();

        const baseMat = new THREE.MeshStandardMaterial({ color: 0xdddddd });
        const base = new THREE.Mesh(new THREE.BoxGeometry(2, 1.2, 2), baseMat);
        base.position.y = 0.6;
        base.castShadow = true;
        base.receiveShadow = true;
        group.add(base);

        const roofMat = new THREE.MeshStandardMaterial({ color: 0x8b5a2b });
        const roof = new THREE.Mesh(new THREE.ConeGeometry(1.5, 0.9, 4), roofMat);
        roof.position.y = 1.6;
        roof.rotation.y = Math.PI / 4;
        roof.castShadow = true;
        group.add(roof);

        group.userData.isWorldObject = true;
        group.userData.isBarrier = true;

        return group;
    }

    createHorseMesh(data) {
        const username = 'NPC Horse';
        const npcModel = createPlayerModel(THREE, username);
        npcModel.userData.isWorldObject = true;
        npcModel.userData.isNPC = true;
        npcModel.userData.type = 'horse';
        npcModel.userData.health = data.health || 100;
        return npcModel;
    }

    createSignMesh(data) {
        const group = new THREE.Group();
        const boardMat = new THREE.MeshStandardMaterial({ color: 0x8b5a2b });
        const postMat = new THREE.MeshStandardMaterial({ color: 0x5C3D2E });
        group.userData.currentText = data?.text || '';
 
        const board = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.6, 0.06), boardMat);
        board.position.y = 0.3;
        group.add(board);
 
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.0, 0.08), postMat);
        // place post behind and slightly lower than the board to avoid covering text
        post.position.set(0, -0.35, -0.25);
        group.add(post);
 
        // Text plane
        if (data.text) {
            // If stored as HTML, extract plain text for canvas rendering
            const tmp = document.createElement('div');
            tmp.innerHTML = data.text;
            const renderText = tmp.textContent || tmp.innerText || '';

            const canvas = document.createElement('canvas');
            canvas.width = 512; canvas.height = 256;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#000000';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.font = '36px Arial';
            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            wrapText(ctx, renderText, canvas.width / 2, canvas.height / 2, 460, 40);
            const tex = new THREE.CanvasTexture(canvas);
            const txtMat = new THREE.MeshBasicMaterial({ map: tex, transparent: true });
            const plane = new THREE.Mesh(new THREE.PlaneGeometry(1.08, 0.48), txtMat);
            plane.position.y = 0.31;
            plane.position.z = 0.035;
            group.add(plane);
        }
 
        group.userData.isWorldObject = true;
        group.userData.type = 'sign';
        return group;
    }

    updateSignText(signGroup, text) {
        // remove existing text plane(s)
        const existingPlane = signGroup.children.find(c => c.geometry && c.geometry.type === 'PlaneGeometry');
        if (existingPlane) {
            signGroup.remove(existingPlane);
            if (existingPlane.material && existingPlane.material.map) {
                existingPlane.material.map.dispose();
            }
            if (existingPlane.material) existingPlane.material.dispose();
        }

        // If provided text looks like HTML, extract plain text for canvas rendering
        const tmp = document.createElement('div');
        tmp.innerHTML = text;
        const renderText = tmp.textContent || tmp.innerText || '';

        // create new canvas texture with updated text
        const canvas = document.createElement('canvas');
        canvas.width = 512; canvas.height = 256;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.font = '36px Arial';
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        wrapText(ctx, renderText, canvas.width / 2, canvas.height / 2, 460, 40);
        const tex = new THREE.CanvasTexture(canvas);
        const txtMat = new THREE.MeshBasicMaterial({ map: tex, transparent: true });
        const plane = new THREE.Mesh(new THREE.PlaneGeometry(1.08, 0.48), txtMat);
        plane.position.y = 0.31;
        plane.position.z = 0.035;
        signGroup.add(plane);
        signGroup.userData.currentText = text;
    }
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
    const words = text.split(' ');
    let line = '';
    let testY = y - lineHeight;
    for (let n = 0; n < words.length; n++) {
        const testLine = line + words[n] + ' ';
        const metrics = ctx.measureText(testLine);
        if (metrics.width > maxWidth && n > 0) {
            testY += lineHeight;
            ctx.fillText(line, x, testY);
            line = words[n] + ' ';
        } else {
            line = testLine;
        }
    }
    testY += lineHeight;
    ctx.fillText(line, x, testY);
}