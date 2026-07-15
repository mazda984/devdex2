import * as THREE from "three";
import { PlayerControls } from "./controls.js";
import { createPlayerModel } from "./player.js";
import { createWorldForExperience } from './worldGeneration.js';
import { setupScene } from './sceneSetup.js';
import { PlayerManager } from './playerManager.js';
import { UIManager } from './ui.js';
import { CollectibleManager } from './collectibles.js';
import { StudioManager } from './studio.js';
import { WorldSyncManager } from './worldSync.js';
import { ProjectileManager } from './projectile.js';
import { NPCManager } from './npcManager.js';
import { audioManager } from './audioManager.js';
import { TimeManager } from './timeManager.js';

export async function initGame(roomId, experienceId, isStudio = false) {
  // Initialize a simple local Git-like room (persisted to localStorage) instead of WebsimSocket.
  class SimpleRoom {
      constructor(roomId = 'lobby') {
          this.roomId = roomId;
          this.roomState = {};
          this.presence = {};
          this.peers = {};
          this.clientId = 'local_' + Math.floor(Math.random() * 1000000);
          this._roomStateSubscribers = [];
          this._presenceSubscribers = [];
      }
      async initialize() {
          try {
              const raw = localStorage.getItem(`gh_data_${this.roomId}`);
              this.roomState = raw ? JSON.parse(raw) : {};
          } catch (e) { this.roomState = {}; }
          this.presence = { [this.clientId]: { x:0, y:0, z:0, score:0, health:100, maxHealth:100, experienceId } };
          this.peers = { [this.clientId]: { username: 'You', avatarUrl: '' } };
          this._notifyRoomState();
          this._notifyPresence();
      }
      _persist() {
          try { localStorage.setItem(`gh_data_${this.roomId}`, JSON.stringify(this.roomState)); } catch(e){}
      }
      updateRoomState(patch) {
          this.roomState = this.roomState || {};
          for (const k in patch) {
              if (typeof patch[k] === 'object' && !Array.isArray(patch[k])) {
                  this.roomState[k] = { ...(this.roomState[k] || {}), ...patch[k] };
              } else {
                  this.roomState[k] = patch[k];
              }
          }
          this._persist();
          this._notifyRoomState();
      }
      updatePresence(p) {
          this.presence[this.clientId] = { ...(this.presence[this.clientId] || {}), ...p };
          this._notifyPresence();
      }
      send(event) {
          if (event && event.type === 'webrtc_save' && event.payload) this.updateRoomState(event.payload);
      }
      subscribeRoomState(cb) { this._roomStateSubscribers.push(cb); cb(this.roomState); return ()=>{ this._roomStateSubscribers = this._roomStateSubscribers.filter(f=>f!==cb); }; }
      subscribePresence(cb) { this._presenceSubscribers.push(cb); cb(this.presence); return ()=>{ this._presenceSubscribers = this._presenceSubscribers.filter(f=>f!==cb); }; }
      subscribePresenceUpdateRequests() { return ()=>{}; }
      _notifyRoomState() { this._roomStateSubscribers.forEach(cb=>{ try{cb(this.roomState)}catch(e){} }); }
      _notifyPresence() { this._presenceSubscribers.forEach(cb=>{ try{cb(this.presence)}catch(e){} }); }
  }

  const room = new SimpleRoom(roomId);
  await room.initialize();

  // Handle realtime incoming events (chat + basic connect/disconnect)
  room.onmessage = (event) => {
    const data = event.data || {};
    switch (data.type) {
      case 'chat':
        try {
          const senderName = data.username || room.peers[data.clientId]?.username || 'Player';
          // uiManager may not be created yet; guard before calling
          if (uiManager) uiManager.addMessageToLog(senderName, data.message);
        } catch (e) { console.warn('Failed to display chat message', e); }
        break;
      case 'connected':
      case 'disconnected':
        // Optionally show connection events in chat log
        if (uiManager) {
          const label = data.type === 'connected' ? 'joined' : 'left';
          const name = data.username || room.peers[data.clientId]?.username || 'Player';
          uiManager.addMessageToLog('System', `${name} ${label} the room.`);
        }
        break;
      case 'webrtc_save':
        try {
          // Determine host (lowest client id) and let host persist incoming save payload to room state
          const peerIds = Object.keys(room.peers || {}).sort();
          const isHost = peerIds.length > 0 && peerIds[0] === room.clientId;
          if (isHost && data.payload && typeof data.payload === 'object') {
            // Merge payload into room state under updateRoomState so sync propagates to everyone
            room.updateRoomState(data.payload);
          }
        } catch (e) {
          console.warn('Failed to process webrtc_save', e);
        }
        break;
      default:
        // ignore other event types by default
        break;
    }
  };
  
  // No external realtime socket in local Git-like mode; skip external connections.
  // Setup Three.js scene, camera, renderer, and lights
  const { scene, camera, renderer } = setupScene();
  
  // Fetch local creator metadata when launching studio experiences (stored under gh_creator_meta)
  if (isStudio) {
    try {
      const rawCreator = localStorage.getItem('gh_creator_meta');
      const creator = rawCreator ? JSON.parse(rawCreator) : null;
      if (creator && creator.username) {
        document.title = `${creator.username} — ${document.title}`;
      }
    } catch (e) {
      // ignore metadata fetch errors
    }
  }
  
  // Generate a random player name if not available
  const playerInfo = room.peers[room.clientId] || {};
  const playerName = playerInfo.username || `Player${Math.floor(Math.random() * 1000)}`;
  
  // Create world elements
  if (experienceId.startsWith('exp_')) {
      // User-created world, handle via WorldSyncManager
      if (!room.roomState.worlds?.[experienceId]?.worldObjects) {
          // If the world is new, initialize it with an empty object
          room.updateRoomState({ worlds: { [experienceId]: { worldObjects: {} } } });
      }
  } else {
      createWorldForExperience(experienceId, scene);
  }

  // Create local player
  const playerModel = createPlayerModel(THREE, playerName);
  scene.add(playerModel);
  
  // Hide player model initially if in studio mode (will be shown when test is pressed)
  if (isStudio) {
    playerModel.visible = false;
  }
  
  // Initialize player controls, passing the created camera
  const uiManager = new UIManager(room, null, camera, renderer);
  const playerControls = new PlayerControls(scene, room, {
    renderer: renderer,
    camera: camera, 
    playerModel: playerModel,
    initialPosition: {
      x: (Math.random() * 10) - 5,
      y: 0.5,
      z: (Math.random() * 10) - 5
    },
    experienceId: experienceId,
    uiManager: uiManager
  });
  uiManager.setPlayerControls(playerControls);

  // Initialize managers for different game aspects
  const collectibleManager = new CollectibleManager(scene, room, experienceId);
  const playerManager = new PlayerManager(scene, room, uiManager);
  playerManager.localPlayerModel = playerModel; // Give player manager a reference to local player model
  const worldSyncManager = new WorldSyncManager(scene);
  const projectileManager = new ProjectileManager(scene, room, playerManager);
  const npcManager = new NPCManager(room, playerManager, experienceId, scene, playerControls); // Pass playerControls
  const timeManager = new TimeManager(scene);

  let studioManager = null;
  if (isStudio) {
      studioManager = new StudioManager(scene, camera, renderer.domElement, room, playerControls, experienceId);
      // Pass npcManager reference to studioManager so it can save positions on test end
      studioManager.npcManager = npcManager;
  }

  // A set to track processed damage events to avoid applying damage multiple times.
  const processedDamageEvents = new Set();
    
  // Store the currently playing background music to manage stops/starts
  let currentBackgroundMusic = null;

  // Function to handle music playback based on room state
  function updateBackgroundMusic(musicTrack) {
      // Handle default music if we are in a non-studio experience, 
      // OR if the user is in studio but hasn't set custom music yet.
      const effectiveMusicTrack = musicTrack || 'explore_roblox';

      if (currentBackgroundMusic === effectiveMusicTrack) return;
      
      // Stop previously playing music
      if (currentBackgroundMusic && currentBackgroundMusic !== 'none') {
          audioManager.stopSound(currentBackgroundMusic);
      }
      
      currentBackgroundMusic = effectiveMusicTrack;

      if (effectiveMusicTrack && effectiveMusicTrack !== 'none') {
          audioManager.playSound(effectiveMusicTrack, { loop: true, volume: 0.6 });
      }
  }

  // Subscribe to room state for collectibles
  room.subscribeRoomState((state) => {
      collectibleManager.sync(state.collectibles);
      projectileManager.sync(state.projectiles, state.explosions);
      
      let backgroundMusic;

      if (experienceId.startsWith('exp_')) {
          worldSyncManager.sync(state.worlds?.[experienceId]?.worldObjects);
          npcManager.sync(state.worlds?.[experienceId]?.worldObjects);
          
          const worldConfig = state.worlds?.[experienceId];
          
          // Apply time of day if set
          const timeOfDay = worldConfig?.timeOfDay;
          if (timeOfDay) {
              timeManager.setTimeOfDay(timeOfDay);
          }
          
          // Get background music from state
          backgroundMusic = worldConfig?.backgroundMusic;

      } else {
          // Built-in worlds default to fixed music/config
          backgroundMusic = 'explore_roblox';
      }
      
      // Update music based on state (or default)
      updateBackgroundMusic(backgroundMusic);


      // Process damage events
      if (state.damageEvents) {
          for (const eventId in state.damageEvents) {
              if (!processedDamageEvents.has(eventId)) {
                  const event = state.damageEvents[eventId];
                  if (event.targetId === room.clientId) {
                      playerControls.takeDamage(event.damage);
                  }
                  processedDamageEvents.add(eventId);
                  // Optional: Clean up old events from room state if you are the one who created it
                  // This is a simple cleanup strategy. A more robust one might be needed for a real game.
                  if (event.attackerId === room.clientId) {
                      setTimeout(() => {
                           room.updateRoomState({ damageEvents: { [eventId]: null } });
                      }, 2000); // Remove event after 2 seconds
                  }
              }
          }
      }
  });
  // Initial sync for collectibles
  collectibleManager.sync(room.roomState.collectibles);
  if (experienceId.startsWith('exp_')) {
      worldSyncManager.sync(room.roomState.worlds?.[experienceId]?.worldObjects);
      npcManager.sync(room.roomState.worlds?.[experienceId]?.worldObjects);
  }

  // Subscribe to presence updates for other players and UI
  room.subscribePresence((presence) => {
    // Also update self for chat messages
    const selfPresence = presence[room.clientId];
    if (selfPresence && selfPresence.chat && selfPresence.chat.timestamp) {
        if (!playerModel.lastChatTimestamp || selfPresence.chat.timestamp > playerModel.lastChatTimestamp) {
            uiManager.showChatMessage(room.clientId, selfPresence.chat.message);
            playerModel.lastChatTimestamp = selfPresence.chat.timestamp;
        }
    }
    
    playerManager.update(presence);
    uiManager.updateLeaderboard(presence);
    uiManager.updateHealthBar(selfPresence?.health, selfPresence?.maxHealth);
  });

  // Animation loop
  let lastTime = 0;
  function animate(currentTime) {
    requestAnimationFrame(animate);

    const deltaTime = currentTime - lastTime;
    lastTime = currentTime;

    playerControls.update();
    
    if (studioManager) {
        studioManager.update();
    }
    
    collectibleManager.animate();
    playerManager.animateLegs();
    projectileManager.animate();
    
    // NPC Host logic update (only runs if this client is designated host)
    npcManager.hostUpdate(deltaTime / 1000);
    // NPC Client logic update (animations/interpolation)
    npcManager.clientUpdate(deltaTime / 1000);

    // Update UI elements based on 3D positions
    const playersToUpdate = { ...playerManager.getPlayers(), [room.clientId]: { model: playerModel } };
    uiManager.updateLabelsAndMessages(playersToUpdate);

    renderer.render(scene, camera);
  }

  animate();
}