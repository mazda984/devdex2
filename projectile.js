import * as THREE from 'three';
import { audioManager } from './audioManager.js';

const ROCKET_SPEED = 1; // Units per frame update
const ROCKET_LIFESPAN = 5000; // 5 seconds
const EXPLOSION_RADIUS = 5;
const EXPLOSION_DAMAGE = 40;
const EXPLOSION_DURATION = 500; // ms

function createRocketMesh() {
    const group = new THREE.Group();

    // Body
    const bodyGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.8, 8);
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x888888 });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.rotation.x = Math.PI / 2;
    group.add(body);

    // Tip
    const tipGeo = new THREE.ConeGeometry(0.1, 0.2, 8);
    const tipMat = new THREE.MeshStandardMaterial({ color: 0xef4444 });
    const tip = new THREE.Mesh(tipGeo, tipMat);
    tip.position.z = 0.5;
    tip.rotation.x = Math.PI / 2;
    group.add(tip);

    // Fins
    for (let i = 0; i < 4; i++) {
        const finGeo = new THREE.BoxGeometry(0.05, 0.2, 0.2);
        const fin = new THREE.Mesh(finGeo, bodyMat);
        const angle = i * Math.PI / 2;
        fin.position.set(Math.cos(angle) * 0.15, Math.sin(angle) * 0.15, -0.3);
        fin.rotation.z = angle;
        group.add(fin);
    }
    
    // Flame particle (simple sprite)
    const textureLoader = new THREE.TextureLoader();
    const flameTexture = textureLoader.load('/rocket.png'); // Using rocket png as a flame sprite, it has a flame
    const flameMaterial = new THREE.SpriteMaterial({ map: flameTexture, color: 0xffddaa, blending: THREE.AdditiveBlending });
    const flame = new THREE.Sprite(flameMaterial);
    flame.scale.set(1, 1, 1);
    flame.position.z = -0.6;
    group.add(flame);

    group.scale.set(0.7, 0.7, 0.7);
    return group;
}

function createExplosionEffect() {
    const geometry = new THREE.SphereGeometry(1, 16, 16);
    const material = new THREE.MeshBasicMaterial({ 
        color: 0xffa500, 
        transparent: true, 
        opacity: 0.8 
    });
    const sphere = new THREE.Mesh(geometry, material);
    sphere.scale.set(0.1, 0.1, 0.1);
    return sphere;
}

export class ProjectileManager {
    constructor(scene, room, playerManager) {
        this.scene = scene;
        this.room = room;
        this.playerManager = playerManager;
        this.projectiles = new Map();
        this.explosions = new Map();

        this.projectileGroup = new THREE.Group();
        this.scene.add(this.projectileGroup);
        
        this.explosionGroup = new THREE.Group();
        this.scene.add(this.explosionGroup);
    }

    sync(projectilesData, explosionsData) {
        const existingIds = new Set();
        if (projectilesData) {
            for (const id in projectilesData) {
                existingIds.add(id);
                const data = projectilesData[id];
                if (!this.projectiles.has(id)) {
                    this.spawnProjectile(id, data);
                } else {
                    // Update position for non-owner clients
                    const proj = this.projectiles.get(id);
                    if (proj.ownerId !== this.room.clientId) {
                        proj.mesh.position.lerp(new THREE.Vector3(data.position.x, data.position.y, data.position.z), 0.3);
                    }
                }
            }
        }
        
        // Remove projectiles that no longer exist in state
        for (const id of this.projectiles.keys()) {
            if (!existingIds.has(id)) {
                this.removeProjectile(id, false); // Don't create explosion, it's handled by explosion sync
            }
        }
        
        if (explosionsData) {
            for(const id in explosionsData) {
                if(!this.explosions.has(id)) {
                    this.spawnExplosion(id, explosionsData[id]);
                }
            }
        }
    }

    spawnProjectile(id, data) {
        const mesh = createRocketMesh();
        mesh.position.set(data.position.x, data.position.y, data.position.z);
        
        const direction = new THREE.Vector3(data.direction.x, data.direction.y, data.direction.z);
        mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), direction);
        
        this.projectileGroup.add(mesh);
        this.projectiles.set(id, {
            ...data,
            id,
            mesh,
            spawnTime: Date.now()
        });
        audioManager.playSound('rocket_launch');
    }
    
    spawnExplosion(id, data) {
        const effect = createExplosionEffect();
        effect.position.set(data.position.x, data.position.y, data.position.z);
        this.explosionGroup.add(effect);
        this.explosions.set(id, {
            id,
            effect,
            startTime: Date.now()
        });
        audioManager.playSound('explosion');

        // The creator of the explosion is responsible for removing it from state
        if (data.ownerId === this.room.clientId) {
            setTimeout(() => {
                this.room.updateRoomState({ explosions: { [id]: null } });
            }, EXPLOSION_DURATION);
        }
    }

    removeProjectile(id, createExplosion = true, impactPosition) {
        if (!this.projectiles.has(id)) return;
        const proj = this.projectiles.get(id);
        this.projectileGroup.remove(proj.mesh);
        this.projectiles.delete(id);

        if (createExplosion && proj.ownerId === this.room.clientId) {
            const explosionId = `expl_${this.room.clientId}_${Date.now()}`;
            this.room.updateRoomState({
                projectiles: { [id]: null },
                explosions: {
                    [explosionId]: {
                        position: impactPosition,
                        ownerId: this.room.clientId
                    }
                }
            });
            this.handleExplosionDamage(impactPosition);
        }
    }

    handleExplosionDamage(position) {
        const damageEvents = {};
        const allPlayers = {
            ...this.playerManager.getPlayers(),
            // a little hacky but need to include self
            [this.room.clientId]: { model: this.playerManager.localPlayerModel }
        };

        for (const clientId in allPlayers) {
            const player = allPlayers[clientId];
            if (player.model && player.model.visible) {
                const distance = player.model.position.distanceTo(position);
                if (distance < EXPLOSION_RADIUS) {
                    const damage = Math.round(EXPLOSION_DAMAGE * (1 - distance / EXPLOSION_RADIUS));
                    if (damage > 0) {
                        const eventId = `dmg_${this.room.clientId}_${clientId}_${Date.now()}`;
                        damageEvents[eventId] = {
                            targetId: clientId,
                            attackerId: this.room.clientId,
                            damage: damage,
                        };
                    }
                }
            }
        }
        if (Object.keys(damageEvents).length > 0) {
            this.room.updateRoomState({ damageEvents });
        }
    }

    animate() {
        const now = Date.now();
        // Animate projectiles
        for (const [id, proj] of this.projectiles.entries()) {
            if (proj.ownerId === this.room.clientId) {
                const direction = new THREE.Vector3(proj.direction.x, proj.direction.y, proj.direction.z);
                const newPos = proj.mesh.position.clone().add(direction.multiplyScalar(ROCKET_SPEED));
                proj.mesh.position.copy(newPos);
                
                // update state
                this.room.updateRoomState({ projectiles: { [id]: { position: {x: newPos.x, y: newPos.y, z: newPos.z} } } });

                // Check collision
                const hit = this.checkCollision(newPos);
                if (hit || (now - proj.spawnTime > ROCKET_LIFESPAN)) {
                    this.removeProjectile(id, true, hit || newPos);
                }
            }
        }
        
        // Animate explosions
        for (const [id, explosion] of this.explosions.entries()) {
            const elapsedTime = now - explosion.startTime;
            if (elapsedTime > EXPLOSION_DURATION) {
                this.explosionGroup.remove(explosion.effect);
                this.explosions.delete(id);
            } else {
                const progress = elapsedTime / EXPLOSION_DURATION;
                const scale = Math.sin(progress * Math.PI) * EXPLOSION_RADIUS;
                explosion.effect.scale.set(scale, scale, scale);
                explosion.effect.material.opacity = 1 - progress;
            }
        }
    }

    checkCollision(pos) {
        // Simple check against other players
        const allPlayers = this.playerManager.getPlayers();
        for (const clientId in allPlayers) {
            const player = allPlayers[clientId];
            if (player.model && player.model.visible) {
                 if (pos.distanceTo(player.model.position) < 1.0) {
                    return player.model.position.clone();
                 }
            }
        }

        // Check against world objects
        const worldObjects = this.scene.getObjectByName('worldObjects');
        if (worldObjects) {
             for(const obj of worldObjects.children) {
                 const box = new THREE.Box3().setFromObject(obj);
                 if(box.containsPoint(pos)) {
                     return pos;
                 }
             }
        }

        // Check against static world geometry (barriers, trees)
        for (const obj of this.scene.children) {
            if (obj.userData.isBarrier || obj.userData.isTree) {
                const box = new THREE.Box3().setFromObject(obj);
                if (box.containsPoint(pos)) {
                    return pos;
                }
            }
        }

        // Check against ground
        if (pos.y <= 0) {
            return new THREE.Vector3(pos.x, 0, pos.z);
        }

        return null;
    }
}