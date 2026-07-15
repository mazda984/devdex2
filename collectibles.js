import * as THREE from 'three';
import { generateCollectiblePositions, createCollectibleMesh } from "./worldGeneration.js";

export class CollectibleManager {
    constructor(scene, room, experienceId) {
        this.scene = scene;
        this.room = room;
        this.experienceId = experienceId;

        this.collectiblesGroup = new THREE.Group();
        this.collectiblesGroup.name = 'collectiblesGroup';
        this.scene.add(this.collectiblesGroup);

        if (this.shouldHaveCollectibles() && !this.room.roomState.collectibles) {
            const collectiblePositions = generateCollectiblePositions(25);
            this.room.updateRoomState({ collectibles: collectiblePositions });
        }
    }

    shouldHaveCollectibles() {
        return this.experienceId === 'main-world';
    }

    sync(collectiblesData) {
        if (!this.shouldHaveCollectibles()) {
            // If this world shouldn't have collectibles, ensure none are shown
            this.collectiblesGroup.children.slice().forEach(child => this.collectiblesGroup.remove(child));
            return;
        }

        const existingIds = new Set();
        if (collectiblesData) {
            for (const id in collectiblesData) {
                existingIds.add(id);
                let mesh = this.collectiblesGroup.children.find(c => c.name === id);
                
                if (!mesh) {
                    const pos = collectiblesData[id];
                    mesh = createCollectibleMesh();
                    mesh.name = id;
                    mesh.position.set(pos.x, pos.y, pos.z);
                    this.collectiblesGroup.add(mesh);
                }
            }
        }

        const toRemove = this.collectiblesGroup.children.filter(child => !existingIds.has(child.name));
        toRemove.forEach(child => this.collectiblesGroup.remove(child));
    }
    
    animate() {
        this.collectiblesGroup.children.forEach(collectible => {
            collectible.rotation.y += 0.02;
            collectible.position.y += Math.sin(performance.now() * 0.002 + collectible.position.x) * 0.005;
        });
    }
}