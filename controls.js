import * as THREE from "three";
import { PointerLockControls } from "three/addons/controls/PointerLockControls.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { audioManager } from './audioManager.js';

// Movement constants
const SPEED = 0.08;
const GRAVITY = 0.01;
const JUMP_FORCE = 0.25;
const MOBILE_SPEED_MULTIPLIER = 1.0;
const RESPAWN_TIME = 3000; // 3 seconds
const SWORD_DAMAGE = 20;
const BAZOOKA_COOLDOWN = 2000; // 2 seconds

export class PlayerControls {
  constructor(scene, room, options = {}) {
    this.scene = scene;
    this.room = room;
    this.camera = options.camera || new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.renderer = options.renderer;
    this.domElement = this.renderer ? this.renderer.domElement : document.body;
    this.playerModel = options.playerModel;
    this.lastPosition = new THREE.Vector3();
    this.isMoving = false;
    this.experienceId = options.experienceId; // Added for filtering
    this.uiManager = options.uiManager; // Added for UI updates
    this.isStudio = options.isStudio || false; // only allow flying in studio
    this.noclipEnabled = options.isStudio || false; // Enable noclip in studio by default
    
    // Player state
    this.velocity = new THREE.Vector3();
    this.canJump = true;
    this.keysPressed = new Set();
    this.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    // Mobile control variables
    this.joystick = null;
    this.touchStartX = 0;
    this.touchStartY = 0;
    this.touchSensitivity = 0.005;
    this.moveVector = { x: 0, z: 0 };
    this.jumpButtonPressed = false;
    this.moveForward = 0;
    this.moveRight = 0;
    
    // Player combat state
    this.health = 100;
    this.maxHealth = 100;
    this.isDead = false;
    this.equippedWeapon = null;
    this.lastAttackTime = 0;
    this.attackCooldown = 500; // ms

    // cooldown for touching world objects to avoid spamming presence updates
    this.lastTouchTime = 0;
    this.touchCooldown = 1000; // 1 second
    
    // Initial player position
    const initialPos = options.initialPosition || {};
    this.playerX = initialPos.x || (Math.random() * 10) - 5;
    this.playerY = initialPos.y || 0.5;
    this.playerZ = initialPos.z || (Math.random() * 10) - 5;
    
    // Set initial player model position if it exists
    if (this.playerModel) {
      this.playerModel.position.set(this.playerX, this.playerY, this.playerZ);
      this.lastPosition.set(this.playerX, this.playerY, this.playerZ);
    }
    
    // Set camera to third-person perspective
    this.camera.position.set(this.playerX, this.playerY + 2, this.playerZ + 5);
    this.camera.lookAt(this.playerX, this.playerY + 1, this.playerZ);
    // Store the initial camera offset (relative to player's target position)
    this.cameraOffset = new THREE.Vector3();
    this.cameraOffset.copy(this.camera.position).sub(new THREE.Vector3(this.playerX, this.playerY + 1, this.playerZ));
    
    // Initialize controls based on device
    this.initializeControls();
    
    // Setup event listeners
    this.setupEventListeners();
    
    // If room is provided, initialize multiplayer presence
    if (this.room) {
      // Initialize player presence in the room
      this.room.updatePresence({
        x: this.playerX,
        y: this.playerY,
        z: this.playerZ,
        rotation: 0,
        moving: false,
        score: 0,
        experienceId: this.experienceId,
        health: this.health,
        maxHealth: this.maxHealth,
        equippedWeapon: this.equippedWeapon,
      });
    }
    
    this.enabled = true; // Add enabled flag for chat input
    this.testMode = false; // Add test mode tracking
  }
  
  initializeControls() {
    this.initializeJoystickControls(); // Always initialize joystick
    if (this.isMobile) {
      this.initializeMobileControls();
    } else {
      this.initializeDesktopControls();
    }
  }
  
  initializeDesktopControls() {
    // Use OrbitControls for third-person view
    this.controls = new OrbitControls(this.camera, this.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.1;
    this.controls.maxPolarAngle = Math.PI * 0.9; // Prevent going below ground
    this.controls.minDistance = 3; // Minimum zoom distance
    this.controls.maxDistance = 10; // Maximum zoom distance
    
    // Increase sensitivity for Safari
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    if (isSafari) {
      this.controls.rotateSpeed = 2.0; // Double sensitivity for Safari
    }
    
    // Add instructions for desktop
    const instructionsDiv = document.createElement("div");
    instructionsDiv.className = "instructions";
    instructionsDiv.innerHTML = "Click to begin. <br>Use WASD to move, Space to jump.";
    document.getElementById('game-container').appendChild(instructionsDiv);
    
    // Hide instructions on first click
    document.addEventListener('click', () => {
      if (document.querySelector(".instructions")) {
        document.querySelector(".instructions").style.display = 'none';
      }
    }, { once: true });
    
    // Update camera offset when controls change
    this.controls.addEventListener('change', () => {
      this.cameraOffset.copy(this.camera.position).sub(this.controls.target);
    });
  }
  
  initializeMobileControls() {
    // Setup camera position first with safe values
    this.camera.position.set(this.playerX, this.playerY + 2, this.playerZ + 5);
    this.camera.lookAt(this.playerX, this.playerY + 1, this.playerZ);
    
    // Initialize OrbitControls for camera rotation (similar to desktop)
    this.controls = new OrbitControls(this.camera, this.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.1;
    this.controls.maxPolarAngle = Math.PI * 0.9; // Prevent going below ground
    this.controls.minDistance = 3; // Minimum zoom distance
    this.controls.maxDistance = 10; // Maximum zoom distance
    
    // Store the initial camera offset for mobile too
    this.cameraOffset = new THREE.Vector3();
    this.cameraOffset.copy(this.camera.position).sub(new THREE.Vector3(this.playerX, this.playerY + 1, this.playerZ));
    
    // Update camera offset when controls change
    this.controls.addEventListener('change', () => {
      this.cameraOffset.copy(this.camera.position).sub(this.controls.target);
    });
    
    // Add joystick container for mobile
    const joystickContainer = document.getElementById('joystick-container');
    if (!joystickContainer) {
      const newJoystickContainer = document.createElement('div');
      newJoystickContainer.id = 'joystick-container';
      document.body.appendChild(newJoystickContainer);
    }
    
    // Add event listeners for jump button
    const jumpButton = document.getElementById('jump-button');
    jumpButton.addEventListener('touchstart', (event) => {
      this.handleJumpPress();
      event.preventDefault();
    });
    
    jumpButton.addEventListener('touchend', (event) => {
      this.handleJumpRelease();
      event.preventDefault();
    });
  }
  
  initializeJoystickControls() {
    // Jump button event listeners for mouse clicks
    const jumpButton = document.getElementById('jump-button');
    jumpButton.addEventListener('mousedown', (event) => {
      this.handleJumpPress();
      event.preventDefault();
    });
    
    jumpButton.addEventListener('mouseup', (event) => {
      this.handleJumpRelease();
      event.preventDefault();
    });

    // Initialize joystick with improved behavior
    this.joystick = nipplejs.create({
      zone: document.getElementById('joystick-container'),
      mode: 'static',
      position: { left: '50%', top: '50%' },
      color: 'rgba(255, 255, 255, 0.5)',
      size: 120
    });
    
    // Joystick move event with better movement handling
    this.joystick.on('move', (evt, data) => {
      const force = Math.min(data.force, 1); // Normalize force between 0 and 1
      const angle = data.angle.radian;
      
      // Calculate movement values using the joystick - fixed direction mapping
      this.moveForward = -Math.sin(angle) * force * SPEED * 5; 
      this.moveRight = Math.cos(angle) * force * SPEED * 5;    
    });
    
    // Joystick end event
    this.joystick.on('end', () => {
      console.log('Joystick released');
      this.moveForward = 0;
      this.moveRight = 0;
    });
  }
  
  handleJumpPress() {
    this.jumpButtonPressed = true;
    if (this.canJump) {
      this.velocity.y = JUMP_FORCE;
      this.canJump = false;
    }
  }

  handleJumpRelease() {
    this.jumpButtonPressed = false;
  }
  
  setupEventListeners() {
    // Listen for key events (for desktop controls)
    document.addEventListener("keydown", (e) => {
      this.keysPressed.add(e.key.toLowerCase());
      
      // Handle jump with spacebar
      if (e.key === " " && this.canJump) {
        this.velocity.y = JUMP_FORCE;
        this.canJump = false;
      }
      
      // Toggle flying with F
      if (e.key.toLowerCase() === 'f') {
        // Only allow toggling fly when in a studio experience
        if (this.isStudio) {
          this.isFlying = !this.isFlying;
          // reset vertical velocity when toggling
          this.velocity.y = 0;
        } else {
          // Optionally provide brief feedback via UIManager if available
          if (this.uiManager) this.uiManager.addMessageToLog('System', 'Flying is only available in the Studio.');
        }
      }
    });

    document.addEventListener("keyup", (e) => {
      this.keysPressed.delete(e.key.toLowerCase());
    });

    this.domElement.addEventListener('mousedown', (e) => {
        if (e.button === 0) { // Left click
            this.handleAttack();
        }
    });
    
    // Handle window resize
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      if (this.renderer) {
        this.renderer.setSize(window.innerWidth, window.innerHeight);
      }
    });
  }
  
  processMovement() {
    // Skip movement processing if controls are disabled (e.g. when chat is open)
    if (!this.enabled || this.isDead) return;
    
    // Check for collectible collision
    this.checkCollectibleCollision();
    // Check for item pickup
    this.checkItemPickup();

    // Get current position
    let x = this.playerModel ? this.playerModel.position.x : this.camera.position.x;
    let y = this.playerModel ? this.playerModel.position.y : (this.camera.position.y - 1.2);
    let z = this.playerModel ? this.playerModel.position.z : this.camera.position.z;
    
    // Create movement vector
    const moveDirection = new THREE.Vector3(0, 0, 0);
    
    // Joystick movement
    if (this.moveForward !== 0 || this.moveRight !== 0) {
      const forward = new THREE.Vector3();
      this.camera.getWorldDirection(forward);
      forward.y = 0;
      forward.normalize();
      
      const right = new THREE.Vector3(-forward.z, 0, forward.x);
      
      moveDirection.addScaledVector(forward, -this.moveForward); // Reversed direction
      moveDirection.addScaledVector(right, this.moveRight);
      moveDirection.normalize().multiplyScalar(SPEED * MOBILE_SPEED_MULTIPLIER); // Standardized speed
    }
    
    // Keyboard movement (desktop)
    if (!this.isMobile) {
      const keyMoveDirection = new THREE.Vector3(0, 0, 0);
      if (this.keysPressed.has("w") || this.keysPressed.has("arrowup")) {
        keyMoveDirection.z = 1; 
      } else if (this.keysPressed.has("s") || this.keysPressed.has("arrowdown")) {
        keyMoveDirection.z = -1; 
      }
      
      if (this.keysPressed.has("a") || this.keysPressed.has("arrowleft")) {
        keyMoveDirection.x = 1; 
      } else if (this.keysPressed.has("d") || this.keysPressed.has("arrowright")) {
        keyMoveDirection.x = -1; 
      }
       
      if (keyMoveDirection.length() > 0) {
        const cameraDirection = new THREE.Vector3();
        this.camera.getWorldDirection(cameraDirection);
        cameraDirection.y = 0; 
        cameraDirection.normalize();
        
        const rightVector = new THREE.Vector3();
        rightVector.crossVectors(this.camera.up, cameraDirection).normalize();
        
        const movementFromKeys = new THREE.Vector3();
        if (keyMoveDirection.z !== 0) {
          movementFromKeys.add(cameraDirection.clone().multiplyScalar(keyMoveDirection.z));
        }
        if (keyMoveDirection.x !== 0) {
          movementFromKeys.add(rightVector.clone().multiplyScalar(keyMoveDirection.x));
        }

        movementFromKeys.normalize().multiplyScalar(SPEED);
        moveDirection.add(movementFromKeys);
      }
    }
    
    const movement = moveDirection;

    this.velocity.y -= GRAVITY;
    
    let newX = x + movement.x;
    let newY = y + this.velocity.y;
    let newZ = z + movement.z;
    
    // Flying behavior: when flying disable gravity and allow vertical control
    if (this.isFlying) {
      // cancel gravity effect
      this.velocity.y = 0;
      // ascend with space / jump button, descend with shift
      if (this.keysPressed.has(' ') || this.jumpButtonPressed) {
        newY = y + 0.25;
      } else if (this.keysPressed.has('shift')) {
        newY = y - 0.25;
      } else {
        newY = y;
      }
    }
    
    const blockMeshes = this.scene.children.filter(child => 
      child.userData.isBlock || child.userData.isBarrier || 
      (child.type === "Group" && child.userData.isTree));
    // Also include objects that live under the worldObjects group (user-built world)
    const worldGroup = this.scene.getObjectByName('worldObjects');
    if (worldGroup) {
      blockMeshes.push(...worldGroup.children.filter(c => 
        c.userData.isBarrier || c.userData.isWorldObject || c.userData.isNPC
      ));
    }
    
    const playerRadius = 0.3;
    const playerHeight = 1.8;
    
    let standingOnBlock = false;
    blockMeshes.forEach(block => {
      if (block.type === "Group" && block.userData.isTree) {
        checkCollision.call(this, block, 1.0, 2.0, 1.0); 
      } else if (block.userData.isNPC) {
        // NPC has child parts, check bounding box
        checkNPCCollision.call(this, block);
      } else {
        checkCollision.call(this, block);
      }
    });
    
    function checkCollision(block, overrideWidth, overrideHeight, overrideDepth) {
      const blockSize = new THREE.Vector3();
      if (block.geometry) {
        const boundingBox = new THREE.Box3().setFromObject(block);
        boundingBox.getSize(blockSize);
      } else {
        blockSize.set(1, 1, 1);
      }
      
      const blockWidth = overrideWidth || blockSize.x;
      const blockHeight = overrideHeight || blockSize.y;
      const blockDepth = overrideDepth || blockSize.z;
      
      if (
        this.velocity.y <= 0 &&
        Math.abs(newX - block.position.x) < (blockWidth / 2 + playerRadius) &&
        Math.abs(newZ - block.position.z) < (blockDepth / 2 + playerRadius) &&
        Math.abs(y - (block.position.y + blockHeight / 2)) < 0.2 &&
        y >= block.position.y
      ) {
        standingOnBlock = true;
        newY = block.position.y + blockHeight / 2 + 0.01;
        this.velocity.y = 0;
        this.canJump = true;
      } else if (
        Math.abs(newX - block.position.x) < (blockWidth / 2 + playerRadius) &&
        Math.abs(newZ - block.position.z) < (blockDepth / 2 + playerRadius) &&
        newY < block.position.y + blockHeight / 2 &&
        newY + playerHeight > block.position.y - blockHeight / 2
      ) {
        if (Math.abs(movement.x) > 0) {
          newX = x;
        }
        if (Math.abs(movement.z) > 0) {
          newZ = z;
        }
      }
    }

    function checkNPCCollision(npc) {
      const npcBox = new THREE.Box3().setFromObject(npc);
      const playerBox = new THREE.Box3().setFromCenterAndSize(
        new THREE.Vector3(newX, newY + playerHeight / 2, newZ),
        new THREE.Vector3(playerRadius * 2, playerHeight, playerRadius * 2)
      );

      if (playerBox.intersectsBox(npcBox)) {
        // Push player out of NPC
        const npcCenter = npcBox.getCenter(new THREE.Vector3());
        const playerCenter = playerBox.getCenter(new THREE.Vector3());
        const pushDirection = playerCenter.clone().sub(npcCenter).normalize();
        
        const npcSize = npcBox.getSize(new THREE.Vector3());
        const maxDim = Math.max(npcSize.x, npcSize.z) / 2;
        const pushDistance = maxDim + playerRadius + 0.05;
        
        newX = npcCenter.x + pushDirection.x * pushDistance;
        newZ = npcCenter.z + pushDirection.z * pushDistance;
      }
    }
    
    if (newY <= 0 && !standingOnBlock) {
      newY = 0;
      this.velocity.y = 0;
      this.canJump = true;
    }
    
    const isMovingNow = movement.length() > 0;
    this.isMoving = isMovingNow;
    
    if (this.playerModel) {
      this.playerModel.position.set(newX, newY, newZ);
      
      if (movement.length() > 0) {
        const angle = Math.atan2(movement.x, movement.z);
        this.playerModel.rotation.y = angle;
        
        const leftLeg = this.playerModel.getObjectByName("leftLeg");
        const rightLeg = this.playerModel.getObjectByName("rightLeg");
        
        if (leftLeg && rightLeg) {
          const walkSpeed = 5; 
          const walkAmplitude = 0.3;
          leftLeg.rotation.x = Math.sin(this.time * walkSpeed) * walkAmplitude;
          rightLeg.rotation.x = Math.sin(this.time * walkSpeed + Math.PI) * walkAmplitude;
        }
      } else {
        const leftLeg = this.playerModel.getObjectByName("leftLeg");
        const rightLeg = this.playerModel.getObjectByName("rightLeg");
        
        if (leftLeg && rightLeg) {
          leftLeg.rotation.x = 0;
          rightLeg.rotation.x = 0;
        }
      }
      
      const newTarget = new THREE.Vector3(this.playerModel.position.x, this.playerModel.position.y + 1, this.playerModel.position.z);
      if (this.controls) {
        this.controls.target.copy(newTarget);
      }
      this.camera.position.copy(newTarget).add(this.cameraOffset);
      
      if (this.room && (
          Math.abs(this.lastPosition.x - newX) > 0.01 ||
          Math.abs(this.lastPosition.y - newY) > 0.01 ||
          Math.abs(this.lastPosition.z - newZ) > 0.01 ||
          this.isMoving !== this.wasMoving
        )) {
        this.room.updatePresence({
          x: newX,
          y: newY,
          z: newZ,
          rotation: this.playerModel.rotation.y,
          moving: this.isMoving
        });
        
        this.lastPosition.set(newX, newY, newZ);
        this.wasMoving = this.isMoving;
      }
    } else {
      this.camera.position.set(newX, newY + 1.2, newZ);
    }
    
    if (this.isMobile && this.controls) {
      this.controls.target.set(newX, newY + 1, newZ);
      this.controls.update();
    } else if (!this.isMobile && this.controls) {
      this.controls.update();
    }
  }

  handleAttack() {
      if (!this.equippedWeapon || Date.now() - this.lastAttackTime < this.attackCooldown || this.isDead) return;
      
      this.lastAttackTime = Date.now();
      
      if (this.equippedWeapon === 'sword') {
          this.handleSwordAttack();
      } else if (this.equippedWeapon === 'bazooka') {
          this.handleBazookaAttack();
      }
  }

  handleSwordAttack() {
      this.attackCooldown = 500; // ms
      // Play sound
      audioManager.playSound('sword');

      // Send attack presence update for animation
      this.room.updatePresence({
          attack: {
              timestamp: this.lastAttackTime,
              weapon: this.equippedWeapon
          }
      });

      // Client-side hit detection
      const myPos = this.playerModel.position;
      const attackRange = 2.5;
      const attackAngle = Math.PI / 2; // 90 degree arc in front

      const myForward = new THREE.Vector3(0, 0, 1);
      myForward.applyQuaternion(this.playerModel.quaternion);

      const players = this.scene.children.filter(c => c.userData.isPlayer && c !== this.playerModel);
      players.forEach(otherPlayer => {
          if (!otherPlayer.visible) return; // Can't hit dead/invisible players
          const otherPos = otherPlayer.position;
          const distance = myPos.distanceTo(otherPos);

          if (distance < attackRange) {
              const toOther = otherPos.clone().sub(myPos).normalize();
              const angle = myForward.angleTo(toOther);

              if (angle < attackAngle / 2) {
                  // It's a hit!
                  const targetId = otherPlayer.userData.clientId;
                  console.log(`Hit player ${targetId}`);
                  const eventId = `${this.room.clientId}_${Date.now()}`;
                  this.room.updateRoomState({
                      damageEvents: {
                          [eventId]: {
                              targetId,
                              attackerId: this.room.clientId,
                              damage: SWORD_DAMAGE
                          }
                      }
                  });
              }
          }
      });
  }
  
  handleBazookaAttack() {
      this.attackCooldown = BAZOOKA_COOLDOWN;
      this.room.updatePresence({
          attack: {
              timestamp: this.lastAttackTime,
              weapon: this.equippedWeapon
          }
      });

      const projectileId = `proj_${this.room.clientId}_${Date.now()}`;
      
      // Get camera direction
      const direction = new THREE.Vector3();
      this.camera.getWorldDirection(direction);

      const startPosition = this.playerModel.position.clone().add(new THREE.Vector3(0, 1.2, 0));
      // Start a bit further away to reduce chance of self-hit
      startPosition.add(direction.clone().multiplyScalar(2.2)); // increased offset from 1 -> 2.2

      const newProjectile = {
          ownerId: this.room.clientId,
          position: { x: startPosition.x, y: startPosition.y, z: startPosition.z },
          direction: { x: direction.x, y: direction.y, z: direction.z },
      };
      
      this.room.updateRoomState({
          projectiles: { [projectileId]: newProjectile }
      });
  }
  
  takeDamage(damage) {
      if (this.isDead) return;
      this.health -= damage;
      if (this.health <= 0) {
          this.health = 0;
          this.die();
      }
      this.room.updatePresence({ health: this.health });
      if (this.uiManager) this.uiManager.updateHealthBar(this.health, this.maxHealth);
  }

  die() {
      console.log('You died!');
      this.isDead = true;
      this.health = 0;
      this.equippedWeapon = null;
      if(this.uiManager) this.uiManager.updateInventory(this.equippedWeapon);
      this.room.updatePresence({ health: 0, equippedWeapon: null });
      this.playerModel.visible = false; // Hide player model
      
      // Respawn timer
      setTimeout(() => this.respawn(), RESPAWN_TIME);
  }

  respawn() {
      this.isDead = false;
      this.health = this.maxHealth;
      
      const newX = (Math.random() * 10) - 5;
      const newY = 0.5;
      const newZ = (Math.random() * 10) - 5;
      this.playerModel.position.set(newX, newY, newZ);
      this.playerModel.visible = true;

      this.room.updatePresence({
          x: newX,
          y: newY,
          z: newZ,
          health: this.health,
          maxHealth: this.maxHealth,
      });
      if (this.uiManager) this.uiManager.updateHealthBar(this.health, this.maxHealth);
  }

  checkItemPickup() {
    if (!this.playerModel) return;

    const worldGroup = this.scene.getObjectByName('worldObjects');
    if (!worldGroup) return;

    const playerPosition = this.playerModel.position;
    for (const item of worldGroup.children) {
        if (this.equippedWeapon) continue; // Don't pick up if already holding something

        let pickedUpType = null;
        if (item.userData.isSword && playerPosition.distanceTo(item.position) < 1.5) {
            pickedUpType = 'sword';
        } else if (item.userData.isBazooka && playerPosition.distanceTo(item.position) < 1.5) {
            pickedUpType = 'bazooka';
        }

        if (pickedUpType) {
            const itemId = item.name;
            // Remove from world state
            this.room.updateRoomState({
                worlds: {
                    [this.experienceId]: { worldObjects: { [itemId]: null } }
                }
            });

            // Equip weapon
            this.equippedWeapon = pickedUpType;
            this.room.updatePresence({ equippedWeapon: pickedUpType });
            if (this.uiManager) this.uiManager.updateInventory(this.equippedWeapon);
            break; // only pick one
        }
    }

    // Touch detection for non-pickup world objects (blocks, houses, parkour platforms, boomboxes, etc.)
    const now = Date.now();
    if (now - this.lastTouchTime > this.touchCooldown) {
      for (const obj of worldGroup.children) {
        if (!obj.userData.isWorldObject) continue;
        // skip items that are explicitly pickup weapons (they're handled above)
        if (obj.userData.isSword || obj.userData.isBazooka) continue;
        const dist = playerPosition.distanceTo(obj.position);
        if (dist < 1.5) {
          this.lastTouchTime = now;
          // Broadcast a simple presence touch event so other clients / UI can react
          this.room.updatePresence({
            lastTouch: {
              id: obj.name || null,
              type: obj.userData.type || 'worldObject',
              timestamp: now
            }
          });
          // provide local feedback (optional): add chat message locally so player sees it
          if (this.uiManager) this.uiManager.addMessageToLog('System', `You touched ${obj.userData.type || 'an object'}`);
          break;
        }
      }
    }
  }
  
  checkCollectibleCollision() {
    if (!this.playerModel || !this.room) return;

    const collectiblesGroup = this.scene.getObjectByName('collectiblesGroup');
    if (!collectiblesGroup) return;

    const playerPosition = this.playerModel.position;

    for (const collectible of collectiblesGroup.children) {
        const distance = playerPosition.distanceTo(collectible.position);
        if (distance < 1.0) { // Collision threshold
            const collectibleId = collectible.name;
            
            // Optimistically remove from scene, will be confirmed by room state
            // collectiblesGroup.remove(collectible);
            
            // Update room state to remove it
            this.room.updateRoomState({ collectibles: { [collectibleId]: null } });

            // Update player score
            const currentPresence = this.room.presence[this.room.clientId];
            const currentScore = currentPresence.score || 0;
            this.room.updatePresence({ score: currentScore + 1 });
            
            // Only collect one per frame to prevent multiple updates
            break; 
        }
    }
  }
  
  update() {
    const now = performance.now();
    this.time = (now * 0.01) % 1000; // Use performance.now() for consistent timing
    
    if (this.enabled) {
      this.processMovement();
    }
    
    // Always update controls even when movement is disabled
    if (this.controls) {
      this.controls.update();
    }
  }
  
  getCamera() {
    return this.camera;
  }
  
  getPlayerModel() {
    return this.playerModel;
  }

  setNoclip(enabled) {
    this.noclipEnabled = enabled;
  }

  setTestMode(enabled) {
    this.testMode = enabled;
  }
}