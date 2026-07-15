import * as THREE from 'three';
import { audioManager } from './audioManager.js';
import { createPlayerModel } from './player.js';

const HORSE_SPEED = 0.05;
const HORSE_ATTACK_RANGE = 2.0;
const HORSE_ATTACK_COOLDOWN = 1500; // ms
const HORSE_DAMAGE = 15; // Base damage

export class NPCManager {
    constructor(room, playerManager, experienceId, scene, playerControls) {
        this.room = room;
        this.playerManager = playerManager;
        this.experienceId = experienceId;
        this.scene = scene;
        this.playerControls = playerControls;
        this.npcs = new Map();
        this.lastAttackTime = new Map();

        // Determine if this client is responsible for simulating NPCs
        this.isHost = false; 

        // Listen to presence changes to determine host role dynamically
        this.room.subscribePresence(() => this.determineHost());
        this.determineHost(); // Initial determination
    }

    determineHost() {
        // Find the client with the lowest ID among all connected peers. This ensures deterministic hosting.
        const peers = Object.keys(this.room.peers).sort();
        if (peers.length > 0 && peers[0] === this.room.clientId) {
            this.isHost = true;
        } else {
            this.isHost = false;
        }
    }

    sync(worldObjectsData) {
        const worldGroup = this.scene.getObjectByName('worldObjects');

        if (!worldGroup || !worldObjectsData) return;

        // Find all NPC objects in the world group
        const npcObjects = worldGroup.children.filter(c => c.userData.isNPC);
        const currentNpcIds = new Set();

        // Update local NPC map based on world objects
        for (const npcMesh of npcObjects) {
            const id = npcMesh.name;
            currentNpcIds.add(id);
            const data = worldObjectsData[id];

            if (data?.type !== 'horse') continue; // Only handle horse NPCs here

            if (!this.npcs.has(id)) {
                this.npcs.set(id, {
                    mesh: npcMesh,
                    data: data, // Persistent data
                    health: data.health || 100,
                    type: npcMesh.userData.type,
                    velocity: new THREE.Vector3(),
                    lastSyncPosition: npcMesh.position.clone()
                });
                // Mark NPC mesh as a barrier for collision detection
                npcMesh.userData.isBarrier = true;
            } else {
                const npc = this.npcs.get(id);
                // Update NPC properties if needed (e.g., health, for visual feedback)
                npc.health = data.health || 0;

                // If we are not the host, we should interpolate the position broadcasted by the host
                if (!this.isHost && data.position) {
                    const targetPos = new THREE.Vector3(
                        data.position.x,
                        data.position.y,
                        data.position.z
                    );
                    // Smooth movement from remote sync
                    npcMesh.position.lerp(targetPos, 0.3);
                }
            }
        }

        // Remove non-existent NPCs from map (they are already removed from scene by WorldSyncManager)
        for (const id of this.npcs.keys()) {
            if (!currentNpcIds.has(id)) {
                this.npcs.delete(id);
                this.lastAttackTime.delete(id);
            }
        }
    }

    // NPC Host Logic (AI and World State updates)
    hostUpdate(deltaTime) {
        if (!this.isHost || !this.playerControls.testMode) return;
        const now = Date.now();

        for (const [id, npc] of this.npcs.entries()) {
            if (npc.type === 'horse') {
                this.updateHorseAI(id, npc, deltaTime, now);
            }
        }
    }

    updateHorseAI(id, npc, deltaTime, now) {
        if (npc.health <= 0) return;

        const allPlayers = this.playerManager.getPlayers();
        const localPlayerModel = this.playerManager.localPlayerModel;

        let target = null;
        let minDistance = Infinity;

        // Find the closest active player (including self)
        const peerIds = Object.keys(this.room.peers);
        for (const clientId of peerIds) {
            const playerData = this.room.presence[clientId];
            const playerMesh = clientId === this.room.clientId ? localPlayerModel : allPlayers[clientId]?.model;

            if (playerMesh && playerData && playerData.health > 0) {
                const distance = npc.mesh.position.distanceTo(playerMesh.position);
                if (distance < minDistance) {
                    minDistance = distance;
                    target = { mesh: playerMesh, clientId: clientId };
                }
            }
        }

        if (target) {
            const direction = target.mesh.position.clone().sub(npc.mesh.position);
            direction.y = 0; // Keep movement horizontal

            // Check for attack range
            if (minDistance < HORSE_ATTACK_RANGE) {
                this.attemptAttack(id, target.clientId, npc, now);
                direction.set(0, 0, 0); // Stop moving while attacking
            }

            if (direction.lengthSq() > 0.01) {
                direction.normalize().multiplyScalar(HORSE_SPEED * deltaTime * 60); // Speed multiplied by FPS factor
                npc.mesh.position.add(direction);
            }

            // Update rotation to face target
            if (direction.lengthSq() > 0) {
                const angle = Math.atan2(direction.x, direction.z);
                npc.mesh.rotation.y = angle;
            }

            // Broadcast updated position if it moved significantly OR rotation changed
            if (npc.lastSyncPosition.distanceTo(npc.mesh.position) > 0.1 || npc.mesh.rotation.y !== npc.lastRotationY) {
                this.room.updateRoomState({
                    worlds: {
                        [this.experienceId]: {
                            worldObjects: {
                                [id]: {
                                    position: { 
                                        x: npc.mesh.position.x, 
                                        y: npc.mesh.position.y, 
                                        z: npc.mesh.position.z 
                                    },
                                    rotation: npc.mesh.rotation.y
                                }
                            }
                        }
                    }
                });
                npc.lastSyncPosition.copy(npc.mesh.position);
                npc.lastRotationY = npc.mesh.rotation.y;
            }
        }
    }

    attemptAttack(npcId, targetClientId, npc, now) {
        const lastAttack = this.lastAttackTime.get(npcId) || 0;

        if (now - lastAttack > HORSE_ATTACK_COOLDOWN) {
            this.lastAttackTime.set(npcId, now);

            const eventId = `npc_dmg_${npcId}_${targetClientId}_${now}`;

            // Create damage event in Room State
            this.room.updateRoomState({
                damageEvents: {
                    [eventId]: {
                        targetId: targetClientId,
                        attackerId: npcId, // NPC is the attacker ID
                        damage: HORSE_DAMAGE
                    }
                }
            });

            // Play attack sound locally (not synced)
            audioManager.playSound('sword'); 
        }
    }

    // New method to save NPC positions to room state
    saveNPCPositions() {
        const updates = {};
        for (const [id, npc] of this.npcs.entries()) {
            updates[id] = {
                position: { 
                    x: npc.mesh.position.x, 
                    y: npc.mesh.position.y, 
                    z: npc.mesh.position.z 
                }
            };
        }
        if (Object.keys(updates).length > 0) {
            const worldObjects = {};
            for (const id in updates) {
                worldObjects[id] = updates[id];
            }
            this.room.updateRoomState({
                worlds: {
                    [this.experienceId]: { worldObjects }
                }
            });
        }
    }

    // Client-side visual update (for animation, regardless of host status)
    clientUpdate(deltaTime) {
        const walkSpeed = 5;
        const walkAmplitude = 0.3;
        const animationPhase = performance.now() * 0.01 * walkSpeed;

        for (const [id, npc] of this.npcs.entries()) {

            // Check health visibility
            if (npc.health <= 0 && npc.mesh.visible) {
                npc.mesh.visible = false;
                // If host, initiate cleanup (already handled in hostUpdate, but safe to check here too)
                if (this.isHost) {
                     setTimeout(() => {
                        this.room.updateRoomState({ 
                            worlds: { [this.experienceId]: { worldObjects: { [id]: null } } }
                        });
                     }, 5000); 
                }
            } else if (npc.health > 0 && !npc.mesh.visible) {
                 npc.mesh.visible = true;
            }

            // Animate legs based on test mode (only move if chasing)
            const isMoving = this.playerControls.testMode && this.isHost;

            const leftLeg = npc.mesh.getObjectByName("leftLeg");
            const rightLeg = npc.mesh.getObjectByName("rightLeg");
            
            if (leftLeg && rightLeg) {
                if (isMoving) {
                    leftLeg.rotation.x = Math.sin(animationPhase) * walkAmplitude;
                    rightLeg.rotation.x = Math.sin(animationPhase + Math.PI) * walkAmplitude;
                } else {
                    leftLeg.rotation.x = 0;
                    rightLeg.rotation.x = 0;
                }
            }
        }
    }
}