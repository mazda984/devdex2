import * as THREE from 'three';
import { createPlayerModel } from './player.js';
import { audioManager } from './audioManager.js';

function createEquippedSwordMesh() {
    const sword = new THREE.Group();
    // Simplified model for equipped version
    const bladeGeometry = new THREE.BoxGeometry(0.03, 0.8, 0.15);
    const bladeMaterial = new THREE.MeshStandardMaterial({ color: 0xC0C0C0, metalness: 0.8, roughness: 0.3 });
    const blade = new THREE.Mesh(bladeGeometry, bladeMaterial);
    blade.position.y = 0.4;
    sword.add(blade);
    return sword;
}

function createEquippedBazookaMesh() {
    const bazooka = new THREE.Group();
    const tubeGeo = new THREE.CylinderGeometry(0.1, 0.1, 1.2, 8);
    const material = new THREE.MeshStandardMaterial({ color: 0x4f7942 });
    const tube = new THREE.Mesh(tubeGeo, material);
    bazooka.add(tube);
    return bazooka;
}

export class PlayerManager {
    constructor(scene, room, uiManager) {
        this.scene = scene;
        this.room = room;
        this.uiManager = uiManager;
        this.otherPlayers = {};
        this.localPlayerModel = null;
    }

    update(presence) {
        const connectedClients = new Set();
        const myExperienceId = this.room.presence[this.room.clientId]?.experienceId;

        for (const clientId in presence) {
            if (clientId === this.room.clientId) continue;

            const playerData = presence[clientId];
            if (!playerData) continue;

            // Only show players from the same experience
            if (myExperienceId && playerData.experienceId !== myExperienceId) {
                if (this.otherPlayers[clientId]) {
                    this.removePlayer(clientId);
                }
                continue; // Skip this player, they are in another experience
            }
            
            connectedClients.add(clientId);

            if (!this.otherPlayers[clientId] && playerData.x !== undefined && playerData.z !== undefined) {
                // Player joined
                this.addPlayer(clientId, playerData);
            } else if (this.otherPlayers[clientId]) {
                // Player moved or chatted
                this.updatePlayer(clientId, playerData);
            }
        }

        // Remove disconnected players
        for (const clientId in this.otherPlayers) {
            if (!connectedClients.has(clientId)) {
                this.removePlayer(clientId);
            }
        }
    }

    addPlayer(clientId, playerData) {
        const peerInfo = this.room.peers[clientId] || {};
        const peerName = peerInfo.username || `Player${clientId.substring(0, 4)}`;
        
        const playerModel = createPlayerModel(THREE, peerName);
        playerModel.position.set(playerData.x, playerData.y || 0.5, playerData.z);
        if (playerData.rotation !== undefined) {
            playerModel.rotation.y = playerData.rotation;
        }
        playerModel.userData.isPlayer = true;
        playerModel.userData.clientId = clientId;
        this.scene.add(playerModel);
        
        this.otherPlayers[clientId] = { model: playerModel, isMoving: false };
        this.updatePlayerWeapon(clientId, playerData.equippedWeapon);

        this.uiManager.addPlayerUI(clientId, peerName);
    }

    updatePlayer(clientId, playerData) {
        const player = this.otherPlayers[clientId];
        if (!player) return;

        if (playerData.x !== undefined && playerData.z !== undefined) {
            // Smooth interpolation
            player.model.position.lerp(new THREE.Vector3(playerData.x, playerData.y || 0, playerData.z), 0.3);
        }
        if (playerData.rotation !== undefined) {
            const targetQuaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, playerData.rotation, 0));
            player.model.quaternion.slerp(targetQuaternion, 0.3);
        }
        player.isMoving = playerData.moving;
        
        // Update visibility based on health
        player.model.visible = playerData.health === undefined || playerData.health > 0;

        // Handle weapon equipping
        const currentWeapon = player.equippedWeapon;
        if (currentWeapon !== playerData.equippedWeapon) {
            this.updatePlayerWeapon(clientId, playerData.equippedWeapon);
            player.equippedWeapon = playerData.equippedWeapon;
        }

        // Handle chat
        if (playerData.chat && playerData.chat.timestamp) {
            if (!player.lastChatTimestamp || playerData.chat.timestamp > player.lastChatTimestamp) {
                this.uiManager.showChatMessage(clientId, playerData.chat.message);
                player.lastChatTimestamp = playerData.chat.timestamp;
            }
        }

        // Handle attack animation
        if(playerData.attack && playerData.attack.timestamp) {
            if (!player.lastAttackTimestamp || playerData.attack.timestamp > player.lastAttackTimestamp) {
                this.triggerAttackAnimation(clientId, playerData.attack.weapon);
                player.lastAttackTimestamp = playerData.attack.timestamp;
            }
        }
    }

    updatePlayerWeapon(clientId, weaponType) {
        const player = this.otherPlayers[clientId];
        if (!player) return;
        const hand = player.model.getObjectByName("rightHand");
        if (!hand) return;

        // Clear existing weapon
        while (hand.children.length) {
            hand.remove(hand.children[0]);
        }

        if (weaponType === 'sword') {
            const sword = createEquippedSwordMesh();
            sword.rotation.x = -Math.PI / 2;
            sword.position.set(0.1, 0, 0.4);
            hand.add(sword);
        } else if (weaponType === 'bazooka') {
            const bazooka = createEquippedBazookaMesh();
            bazooka.rotation.z = Math.PI / 2;
            bazooka.position.set(0, 0.2, 0); // Position on shoulder
            hand.add(bazooka);
        }
    }

    triggerAttackAnimation(clientId, weaponType) {
        const player = this.otherPlayers[clientId];
        if (!player) return;
        const hand = player.model.getObjectByName("rightHand");
        if (!hand || hand.children.length === 0) return;

        if (weaponType === 'sword') {
            audioManager.playSound('sword');
            const weapon = hand; // animate the whole hand group
            // Simple swing animation
            const startRotation = weapon.rotation.z;
            const attackRotation = startRotation - Math.PI / 2;

            // Quick swing out
            let t = 0;
            const swingOut = () => {
                if (t > 1) { swingIn(); return; }
                weapon.rotation.z = THREE.MathUtils.lerp(startRotation, attackRotation, t);
                t += 0.2;
                requestAnimationFrame(swingOut);
            };
            
            // Slower return
            const swingIn = () => {
                if (t < 0) return;
                weapon.rotation.z = THREE.MathUtils.lerp(startRotation, attackRotation, t);
                t -= 0.05;
                requestAnimationFrame(swingIn);
            };
            
            swingOut();
        }
        // No special animation for bazooka, sound is handled by projectile manager
    }

    removePlayer(clientId) {
        if (this.otherPlayers[clientId]) {
            this.scene.remove(this.otherPlayers[clientId].model);
            delete this.otherPlayers[clientId];
            this.uiManager.removePlayerUI(clientId);
        }
    }
    
    animateLegs() {
        for (const clientId in this.otherPlayers) {
            const player = this.otherPlayers[clientId];
            const leftLeg = player.model.getObjectByName("leftLeg");
            const rightLeg = player.model.getObjectByName("rightLeg");

            if (leftLeg && rightLeg) {
                if (player.isMoving) {
                    const walkSpeed = 5;
                    const walkAmplitude = 0.3;
                    const animationPhase = performance.now() * 0.01 * walkSpeed;
                    leftLeg.rotation.x = Math.sin(animationPhase) * walkAmplitude;
                    rightLeg.rotation.x = Math.sin(animationPhase + Math.PI) * walkAmplitude;
                } else {
                    leftLeg.rotation.x = 0;
                    rightLeg.rotation.x = 0;
                }
            }
        }
    }

    getPlayers() {
        return this.otherPlayers;
    }
}