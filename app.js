import * as THREE from "three";
import { PlayerControls } from "./controls.js";
import { createPlayerModel } from "./player.js";
import { createBarriers, createTrees, createClouds, generateCollectiblePositions, createCollectibleMesh } from "./worldGeneration.js";
import { initGame } from './game.js';

// removed MathRandom class
// removed startGame() function

async function setupMenu() {
  // Simple local Git-like room backed by localStorage to avoid external websim dependencies.
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
      // Load persisted state from localStorage (simulate a git-backed dataset)
      try {
        const raw = localStorage.getItem(`gh_data_${this.roomId}`);
        const parsed = raw ? JSON.parse(raw) : null;
        this.roomState = parsed || {};
      } catch (e) {
        this.roomState = {};
      }
      // Set initial presence and peers (single local client)
      this.presence = { [this.clientId]: { x:0, y:0, z:0, score:0, health:100, maxHealth:100, experienceId: 'main-world' } };
      this.peers = { [this.clientId]: { username: 'You', avatarUrl: '' } };
      // Notify subscribers immediately
      this._notifyRoomState();
      this._notifyPresence();
    }

    _persist() {
      try {
        localStorage.setItem(`gh_data_${this.roomId}`, JSON.stringify(this.roomState));
      } catch (e) { /* ignore */ }
    }

    updateRoomState(patch) {
      // shallow merge for top-level keys (matches prior usage pattern)
      this.roomState = this.roomState || {};
      for (const key in patch) {
        if (!patch[key]) {
          // setting null for nested items expects object-of-objects pattern in callers
          if (this.roomState[key] && typeof patch[key] === 'object') {
            // handled by caller using nested object patterns
            this.roomState[key] = { ...this.roomState[key], ...patch[key] };
          } else {
            this.roomState[key] = patch[key];
          }
        } else if (typeof patch[key] === 'object' && !Array.isArray(patch[key])) {
          this.roomState[key] = { ...(this.roomState[key] || {}), ...patch[key] };
        } else {
          this.roomState[key] = patch[key];
        }
      }
      this._persist();
      this._notifyRoomState();
    }

    updatePresence(pres) {
      this.presence[this.clientId] = { ...(this.presence[this.clientId] || {}), ...pres };
      this._notifyPresence();
    }

    send(event) {
      // Local broadcast simulation: treat as a roomState update if payload exists (webrtc_save style)
      if (event && event.type === 'webrtc_save' && event.payload) {
        this.updateRoomState(event.payload);
      }
    }

    subscribeRoomState(cb) {
      this._roomStateSubscribers.push(cb);
      cb(this.roomState);
      return () => {
        this._roomStateSubscribers = this._roomStateSubscribers.filter(f => f !== cb);
      };
    }

    subscribePresence(cb) {
      this._presenceSubscribers.push(cb);
      cb(this.presence);
      return () => {
        this._presenceSubscribers = this._presenceSubscribers.filter(f => f !== cb);
      };
    }

    subscribePresenceUpdateRequests() {
      // no-op for this simple implementation
      return () => {};
    }

    _notifyRoomState() {
      this._roomStateSubscribers.forEach(cb => {
        try { cb(this.roomState); } catch (e) {}
      });
    }

    _notifyPresence() {
      this._presenceSubscribers.forEach(cb => {
        try { cb(this.presence); } catch (e) {}
      });
    }
  }

  const room = new SimpleRoom('lobby');
  await room.initialize();

  // Try to load local project metadata stored under gh_project_meta (optional)
  try {
    const rawProject = localStorage.getItem('gh_project_meta');
    if (rawProject) {
      const project = JSON.parse(rawProject);
      if (project && project.title) {
        const headerTitle = document.getElementById('welcome-message');
        if (headerTitle) headerTitle.innerHTML = `Welcome back, <span id="welcome-username">Player</span> — <small style="opacity:0.85">${project.title}</small>`;
      }
    }
  } catch (e) {
    console.warn('Could not load local project metadata', e);
  }

  // Local storage based "realtime" is immediate — no external socket to connect.
  
  // Small helper to avoid injection in text fields
  function escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, (m) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  }

  // Set initial state if the lobby room is empty
  if (!room.roomState.experiences) {
    room.updateRoomState({
      experiences: {
        'main-world': { id: 'main-world', title: 'Main World', desc: 'Explore a vibrant world with friends.', thumbnail: '/experience-thumbnail.png', defaultServerId: 'server-1' },
        'studio-demo': { id: 'studio-demo', title: 'Studio Demo', desc: 'A small creative playground.', thumbnail: '', defaultServerId: 'server-3' },
        'parkour': { id: 'parkour', title: 'Parkour Challenge', desc: 'A timed parkour course — reach the finish!', thumbnail: '/experience-thumbnail.png', defaultServerId: 'server-4' }
      },
      servers: {
        'server-1': { id: 'server-1', name: 'North America', players: 0, capacity: 16, experienceId: 'main-world' },
        'server-2': { id: 'server-2', name: 'Europe', players: 0, capacity: 12, experienceId: 'main-world' },
        'server-3': { id: 'server-3', name: 'Studio Server', players: 0, capacity: 8, experienceId: 'studio-demo' },
        'server-4': { id: 'server-4', name: 'Parkour Server', players: 0, capacity: 12, experienceId: 'parkour' }
      }
    });
  }

  let selectedExperienceId = 'main-world'; // Default selection
  let experiences = {};
  let servers = {};
  
  // Centralized function to join a game
  function joinGame(server, isStudio = false) {
    if (!server) {
      console.error("Cannot join server. It might be full or invalid.");
      return;
    }

    // If experience has a public gameUrl, open it in an iframe overlay instead of launching the 3D engine
    const exp = experiences[server.experienceId];
    if (exp && exp.public && exp.gameUrl) {
      // hide menu
      document.getElementById('menu-overlay').style.display = 'none';

      // show mobile controls
      const joystickContainer = document.getElementById('joystick-container');
      const jumpButton = document.getElementById('jump-button');
      if (joystickContainer) joystickContainer.style.display = 'block';
      if (jumpButton) jumpButton.style.display = 'block';

      // Create or reuse iframe overlay
      let iframeOverlay = document.getElementById('experience-iframe-overlay');
      if (!iframeOverlay) {
        iframeOverlay = document.createElement('div');
        iframeOverlay.id = 'experience-iframe-overlay';
        iframeOverlay.style.position = 'fixed';
        iframeOverlay.style.inset = '0';
        iframeOverlay.style.background = 'rgba(0,0,0,0.85)';
        iframeOverlay.style.display = 'flex';
        iframeOverlay.style.zIndex = '14000';
        iframeOverlay.style.justifyContent = 'center';
        iframeOverlay.style.alignItems = 'center';
        iframeOverlay.innerHTML = `
          <div style="width:95%;height:92%;background:#fff;border-radius:8px;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 8px 30px rgba(0,0,0,0.6);">
            <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;background:#111;color:#fff;">
              <div style="font-weight:bold">Playing: ${exp.title ? escapeHtml(exp.title) : 'Experience'}</div>
              <div>
                <button id="experience-close-iframe" style="margin-right:8px;padding:6px 10px;border-radius:6px;border:none;background:#ef4444;color:white;cursor:pointer;">Kapat</button>
                <a id="experience-open-new" target="_blank" rel="noopener" style="padding:6px 10px;border-radius:6px;border:none;background:#222;color:#fff;text-decoration:none;font-size:13px;">Yeni Sekmede Aç</a>
              </div>
            </div>
            <iframe id="experience-iframe" src="" style="flex:1;border:0;background:#fff;"></iframe>
          </div>
        `;
        document.body.appendChild(iframeOverlay);

        iframeOverlay.querySelector('#experience-close-iframe').addEventListener('click', () => {
          document.getElementById('menu-overlay').style.display = 'flex';
          iframeOverlay.style.display = 'none';
          const iframe = iframeOverlay.querySelector('#experience-iframe');
          if (iframe) iframe.src = 'about:blank';
          // hide mobile controls
          if (joystickContainer) joystickContainer.style.display = 'none';
          if (jumpButton) jumpButton.style.display = 'none';
        });
      }

      const iframe = iframeOverlay.querySelector('#experience-iframe');
      const openNew = iframeOverlay.querySelector('#experience-open-new');
      if (iframe) iframe.src = exp.gameUrl;
      if (openNew) openNew.href = exp.gameUrl;
      iframeOverlay.style.display = 'flex';
      return;
    }

    // Default behavior: launch the in-engine 3D experience
    document.getElementById('menu-overlay').style.display = 'none';
    const joystickContainer = document.getElementById('joystick-container');
    const jumpButton = document.getElementById('jump-button');
    if (joystickContainer) joystickContainer.style.display = 'block';
    if (jumpButton) jumpButton.style.display = 'block';

    initGame(server.id, server.experienceId, isStudio);
  }

  function renderExperiencesGrid() {
    const experiencesGrid = document.getElementById('experiences-grid');
    experiencesGrid.innerHTML = '';

    // Build ordered list: first show public (shared/published) experiences as recommendations,
    // then fall back to other experiences.
    const allExps = Object.values(experiences || {});
    const publicExps = allExps.filter(e => e.public);
    const privateExps = allExps.filter(e => !e.public);
    const ordered = [...publicExps, ...privateExps];

    // If there are no public experiences, keep existing behavior (show all).
    // Show all experiences on the homepage (public ones first)
    ordered.forEach(exp => {
      const card = document.createElement('div');
      card.className = 'experience-card';
      card.dataset.experienceId = exp.id;
      card.innerHTML = `
        <div class="experience-thumbnail">${exp.thumbnail ? `<img src="${exp.thumbnail}" alt="${escapeHtml(exp.title)}">` : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:#888">No Image</div>`}</div>
        <div class="experience-info"><h3>${escapeHtml(exp.title)}</h3><p>${escapeHtml(exp.desc)}</p></div>
        <button class="play-button" data-default-server="${exp.defaultServerId}">▶</button>
      `;

      // visually mark public experiences so users notice (subtle badge)
      if (exp.public) {
        const badge = document.createElement('div');
        badge.textContent = 'Public';
        badge.style.position = 'absolute';
        badge.style.top = '10px';
        badge.style.left = '10px';
        badge.style.background = 'rgba(76,175,80,0.12)';
        badge.style.color = '#bde5c8';
        badge.style.padding = '4px 8px';
        badge.style.borderRadius = '6px';
        badge.style.fontSize = '12px';
        badge.style.pointerEvents = 'none';
        card.appendChild(badge);
      }

      experiencesGrid.appendChild(card);
      
      const playBtn = card.querySelector('.play-button');
      if (playBtn) {
        playBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const serverId = e.currentTarget.dataset.defaultServer;
            const server = servers[serverId];
            if (server) {
                joinGame(server, false);
            }
        });
      }

      card.addEventListener('click', () => {
        selectedExperienceId = exp.id;
        renderServerList();
      });
    });
  }

  const serverListEl = document.getElementById('server-list');
  function renderServerList() {
    serverListEl.innerHTML = '';
    const filteredServers = Object.values(servers).filter(s => s.experienceId === selectedExperienceId);

    filteredServers.forEach(s => {
      const li = document.createElement('li');
      li.className = 'server-item';
      if (s.players >= s.capacity) {
          li.classList.add('full');
      }
      li.dataset.serverId = s.id;
      // Note: `s.players` isn't updated in this implementation yet. Would require more work.
      li.innerHTML = `<span>${escapeHtml(s.name)} — ${s.players || 0}/${s.capacity} players</span><button class="join-server-button">Join</button>`;
      
      const joinButton = li.querySelector('.join-server-button');

      const handleJoin = (e) => {
          e.stopPropagation();
          const server = servers[s.id];
          if (server) {
              joinGame(server, false);
          }
      };

      joinButton.addEventListener('click', handleJoin);
      li.addEventListener('click', handleJoin);

      serverListEl.appendChild(li);
    });
  }
  
  function renderCreationsGrid() {
      const creationsGrid = document.getElementById('creations-grid');
      creationsGrid.innerHTML = '';
      
      const myCreations = Object.values(experiences).filter(exp => exp.creatorId === room.clientId);

      if (myCreations.length === 0) {
          creationsGrid.innerHTML = `<p>You haven't created any experiences yet. Click "Create New" to get started!</p>`;
          return;
      }

      myCreations.forEach(exp => {
          const server = servers[exp.defaultServerId];
          const card = document.createElement('div');
          card.className = 'experience-card';
          card.innerHTML = `
            <div class="experience-thumbnail">${exp.thumbnail ? `<img src="${exp.thumbnail}" alt="${escapeHtml(exp.title)}">` : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:#888;font-size:14px;">Studio</div>`}</div>
            <div class="experience-info"><h3>${escapeHtml(exp.title)}</h3></div>
            <div class="experience-actions">
              <button class="edit-button">EDIT</button>
              <button class="play-button-small">PLAY</button>
            </div>
          `;
          
          card.querySelector('.play-button-small').addEventListener('click', (e) => {
              e.stopPropagation();
              if(server) joinGame(server, false);
          });
          card.querySelector('.edit-button').addEventListener('click', (e) => {
              e.stopPropagation();
              if(server) joinGame(server, true);
          });

          creationsGrid.appendChild(card);
      });
  }

  // Reusable centered Studio choices overlay:
  function showStudioCenterChoices(server) {
    const serverToUse = server || servers['server_' + selectedExperienceId] || null;
    const centerChoices = document.createElement('div');
    centerChoices.style.position = 'fixed';
    centerChoices.style.inset = '0';
    centerChoices.style.display = 'flex';
    centerChoices.style.alignItems = 'center';
    centerChoices.style.justifyContent = 'center';
    centerChoices.style.background = 'rgba(0,0,0,0.45)';
    centerChoices.style.zIndex = '12500';
    centerChoices.innerHTML = `
      <div style="width:360px;max-width:92%;background:#0f1720;color:#fff;border-radius:8px;padding:16px;text-align:center;">
        <h3 style="margin:0 0 8px 0;">Studio</h3>
        <p style="color:#ccc;font-size:13px;margin-bottom:12px;">Your experience is saved; choose how you want to proceed.</p>
        <div style="display:flex;gap:8px;justify-content:center;">
          <button id="center-open-studio" style="padding:8px 12px;border-radius:6px;border:none;background:#3b82f6;color:#fff;">Open Studio</button>
          <button id="center-play-now" style="padding:8px 12px;border-radius:6px;border:none;background:#4CAF50;color:#fff;font-weight:bold;">Play Now</button>
        </div>
      </div>
    `;
    document.body.appendChild(centerChoices);

    centerChoices.querySelector('#center-open-studio').addEventListener('click', () => {
      centerChoices.remove();
      if (serverToUse) joinGame(serverToUse, true);
    });
    centerChoices.querySelector('#center-play-now').addEventListener('click', () => {
      centerChoices.remove();
      if (serverToUse) joinGame(serverToUse, false);
    });
  }

  room.subscribeRoomState((state) => {
    experiences = state.experiences || {};
    servers = state.servers || {};
    renderExperiencesGrid();
    renderCreationsGrid();
    renderServerList();
  });

  // Initial render
  experiences = room.roomState.experiences || {};
  servers = room.roomState.servers || {};
  if(Object.keys(experiences).length > 0) {
      selectedExperienceId = Object.keys(experiences)[0];
  }
  renderExperiencesGrid();
  renderCreationsGrid();
  renderServerList();


  // Exit button returns to menu (reload to clean up running game)
  const exitButton = document.getElementById('exit-button');
  if (exitButton) {
    exitButton.addEventListener('click', (e) => {
      e.preventDefault();
      document.body.innerHTML = ''; // Clear everything to stop the game loop
      location.reload();
    });
  }
  
  const homeTab = document.getElementById('home-tab');
  const createTab = document.getElementById('create-tab');
  const mainContent = document.getElementById('main-content');
  const studioContent = document.getElementById('studio-content');

  homeTab.addEventListener('click', (e) => {
    e.preventDefault();
    mainContent.style.display = 'block';
    studioContent.style.display = 'none';
    homeTab.parentElement.classList.add('active');
    createTab.parentElement.classList.remove('active');
  });

  createTab.addEventListener('click', (e) => {
    e.preventDefault();
    mainContent.style.display = 'none';
    studioContent.style.display = 'block';
    createTab.parentElement.classList.add('active');
    homeTab.parentElement.classList.remove('active');
    // No additional "Paylaş / Oluştur" HUD injected here — Create screen already provides the Create flow.
  });

  // Studio editor UI: open modal and create a simple experience card
  const createNewBtn = document.getElementById('create-new-experience-button');
  if (createNewBtn) {
    // Add adjacent "Oluştur" button next to Create New that opens the Studio choices overlay
    const createAdjacent = document.createElement('button');
    createAdjacent.id = 'open-create-adjacent';
    createAdjacent.textContent = 'Oluştur';
    createAdjacent.style.marginLeft = '8px';
    createAdjacent.style.padding = '10px 14px';
    createAdjacent.style.fontSize = '1em';
    createAdjacent.style.fontWeight = 'bold';
    createAdjacent.style.background = '#3b82f6';
    createAdjacent.style.color = '#fff';
    createAdjacent.style.border = 'none';
    createAdjacent.style.borderRadius = '6px';
    createAdjacent.style.cursor = 'pointer';
    createNewBtn.parentElement.insertBefore(createAdjacent, createNewBtn.nextSibling);

    // Clicking the adjacent Oluştur button now directly opens the external studio page in an iframe
    const STUDIO_URL = 'https://mazda984.github.io/studio/';

    function openStudioIframe(url = STUDIO_URL) {
      // hide menu
      document.getElementById('menu-overlay').style.display = 'none';

      // show mobile controls
      const joystickContainer = document.getElementById('joystick-container');
      const jumpButton = document.getElementById('jump-button');
      if (joystickContainer) joystickContainer.style.display = 'block';
      if (jumpButton) jumpButton.style.display = 'block';

      // Create or reuse iframe overlay
      let iframeOverlay = document.getElementById('experience-iframe-overlay');
      if (!iframeOverlay) {
        iframeOverlay = document.createElement('div');
        iframeOverlay.id = 'experience-iframe-overlay';
        iframeOverlay.style.position = 'fixed';
        iframeOverlay.style.inset = '0';
        iframeOverlay.style.background = 'rgba(0,0,0,0.85)';
        iframeOverlay.style.display = 'flex';
        iframeOverlay.style.zIndex = '14000';
        iframeOverlay.style.justifyContent = 'center';
        iframeOverlay.style.alignItems = 'center';
        iframeOverlay.innerHTML = `
          <div style="width:95%;height:92%;background:#fff;border-radius:8px;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 8px 30px rgba(0,0,0,0.6);">
            <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;background:#111;color:#fff;">
              <div style="font-weight:bold">Studio</div>
              <div>
                <button id="experience-close-iframe" style="margin-right:8px;padding:6px 10px;border-radius:6px;border:none;background:#ef4444;color:white;cursor:pointer;">Kapat</button>
                <a id="experience-open-new" target="_blank" rel="noopener" style="padding:6px 10px;border-radius:6px;border:none;background:#222;color:#fff;text-decoration:none;font-size:13px;">Yeni Sekmede Aç</a>
              </div>
            </div>
            <iframe id="experience-iframe" src="" style="flex:1;border:0;background:#fff;"></iframe>
          </div>
        `;
        document.body.appendChild(iframeOverlay);

        iframeOverlay.querySelector('#experience-close-iframe').addEventListener('click', () => {
          document.getElementById('menu-overlay').style.display = 'flex';
          iframeOverlay.style.display = 'none';
          const iframe = iframeOverlay.querySelector('#experience-iframe');
          if (iframe) iframe.src = 'about:blank';
          // hide mobile controls
          if (joystickContainer) joystickContainer.style.display = 'none';
          if (jumpButton) jumpButton.style.display = 'none';
        });
      }

      const iframe = iframeOverlay.querySelector('#experience-iframe');
      const openNew = iframeOverlay.querySelector('#experience-open-new');
      if (iframe) iframe.src = url;
      if (openNew) openNew.href = url;
      iframeOverlay.style.display = 'flex';
    }

    createAdjacent.addEventListener('click', (e) => {
      e.preventDefault();
      openStudioIframe();
    });

    const studioEditor = document.getElementById('studio-editor');
    const studioTitle = document.getElementById('studio-title');
    const studioDesc = document.getElementById('studio-desc');
    const studioCreate = document.getElementById('studio-create');
    const studioCancel = document.getElementById('studio-cancel');
    const studioClose = document.getElementById('studio-close');
    const creationsGrid = document.getElementById('creations-grid');

    const openEditor = () => {
      if (studioEditor) studioEditor.classList.remove('hidden');
      studioTitle.value = '';
      studioDesc.value = '';
      studioTitle.focus();
    };
    const closeEditor = () => {
      if (studioEditor) studioEditor.classList.add('hidden');
    };

    createNewBtn.addEventListener('click', (e) => {
      e.preventDefault();
      openEditor();
    });

    studioCancel.addEventListener('click', (e) => {
      e.preventDefault();
      closeEditor();
    });
    studioClose.addEventListener('click', (e) => {
      e.preventDefault();
      closeEditor();
    });

    studioCreate.addEventListener('click', (e) => {
      e.preventDefault();
      const title = (studioTitle.value || 'Untitled Experience').trim();
      const desc = (studioDesc.value || 'No description').trim();

      const experienceId = 'exp_' + room.clientId + '_' + Date.now();
      const serverId = 'server_' + experienceId;
      const creatorUsername = room.peers[room.clientId]?.username || 'A player';

      // Prepare base experience/server objects but don't publish yet
      const newExperience = {
        id: experienceId,
        title: title,
        desc: desc,
        thumbnail: '', // will be filled after image upload (base64)
        defaultServerId: serverId,
        creator: creatorUsername,
        creatorId: room.clientId,
        public: false
      };

      const newServer = {
        id: serverId,
        name: `${title.substring(0, 20)} Server`,
        players: 0,
        capacity: 8,
        experienceId: experienceId
      };

      // Build and show centered publish modal requesting Game URL and Image
      const publishModal = document.createElement('div');
      publishModal.style.position = 'fixed';
      publishModal.style.inset = '0';
      publishModal.style.display = 'flex';
      publishModal.style.alignItems = 'center';
      publishModal.style.justifyContent = 'center';
      publishModal.style.background = 'rgba(0,0,0,0.6)';
      publishModal.style.zIndex = '13000';

      publishModal.innerHTML = `
        <div style="width:420px;max-width:92%;background:#121212;color:#fff;border-radius:8px;padding:16px;">
          <h3 style="margin:0 0 8px 0;">Publish Experience</h3>
          <p style="margin:0 0 12px 0;color:#ccc;font-size:13px;">Provide the game's public URL and a thumbnail image to make your experience public.</p>
          <label style="display:block;margin-bottom:6px;font-size:13px;color:#ddd;">Game URL</label>
          <input id="publish-game-url" type="text" placeholder="https://example.com/play" style="width:100%;padding:8px;border-radius:6px;border:1px solid #333;background:#1b1b1b;color:#fff;margin-bottom:10px;">
          <label style="display:block;margin-bottom:6px;font-size:13px;color:#ddd;">Thumbnail Image</label>
          <input id="publish-image-input" type="file" accept="image/*" style="width:100%;margin-bottom:12px;color:#fff;">
          <div style="display:flex;gap:8px;justify-content:flex-end;">
            <button id="publish-cancel" style="padding:8px 12px;border-radius:6px;border:none;background:#555;color:#fff;">Cancel</button>
            <button id="publish-save" style="padding:8px 12px;border-radius:6px;border:none;background:#4CAF50;color:#fff;font-weight:bold;">Save & Publish</button>
          </div>
        </div>
      `;

      document.body.appendChild(publishModal);

      const fileInput = publishModal.querySelector('#publish-image-input');
      const urlInput = publishModal.querySelector('#publish-game-url');
      const cancelBtn = publishModal.querySelector('#publish-cancel');
      const saveBtn = publishModal.querySelector('#publish-save');

      cancelBtn.addEventListener('click', () => {
        publishModal.remove();
      });

      // Helper to convert file to base64 data URL
      function fileToDataUrl(file) {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = (err) => reject(err);
          reader.readAsDataURL(file);
        });
      }

      saveBtn.addEventListener('click', async (ev) => {
        ev.preventDefault();
        const gameUrl = (urlInput.value || '').trim();
        const file = fileInput.files && fileInput.files[0];

        // Validate required fields
        if (!gameUrl) {
          alert('Please enter the Game URL.');
          return;
        }
        if (!file) {
          alert('Please choose a thumbnail image.');
          return;
        }

        // Convert image to base64 data URL
        let dataUrl = '';
        try {
          dataUrl = await fileToDataUrl(file);
        } catch (err) {
          console.error('Failed to read image file', err);
          alert('Could not read the image file.');
          return;
        }

        // Attach required fields and mark public
        newExperience.thumbnail = dataUrl;
        newExperience.public = true;
        newExperience.gameUrl = gameUrl;

        // Persist the new experience and server directly into the room state so it's immediately visible on the homepage.
        try {
          room.updateRoomState({
            experiences: { [experienceId]: newExperience },
            servers: { [serverId]: newServer },
            worlds: {
              [experienceId]: {
                worldObjects: {},
                backgroundMusic: 'explore_roblox',
                timeOfDay: 'noon'
              }
            }
          });
        } catch (e) {
          // Fallback to send for older hosts if direct update fails
          console.warn('Direct updateRoomState failed, falling back to webrtc_save send.', e);
          room.send({
            type: 'webrtc_save',
            echo: true,
            payload: {
              experiences: { [experienceId]: newExperience },
              servers: { [serverId]: newServer },
              worlds: {
                [experienceId]: {
                  worldObjects: {},
                  backgroundMusic: 'explore_roblox',
                  timeOfDay: 'noon'
                }
              }
            }
          });
        }

        publishModal.remove();
        closeEditor();

        // Return to the menu and refresh the lists so the newly published experience appears on the homepage.
        document.getElementById('menu-overlay').style.display = 'flex';

        // Ensure local caches are refreshed from the updated room state
        experiences = room.roomState.experiences || experiences;
        servers = room.roomState.servers || servers;
        selectedExperienceId = experienceId;
        renderExperiencesGrid();
        renderCreationsGrid();
        renderServerList();

        // Friendly confirmation
        setTimeout(() => {
          alert('Experience published and added to the homepage. Click Play to open the Game URL.');
        }, 50);
      });
    });
  }

  // Personalize menu from local settings if available
  try {
    const rawUser = localStorage.getItem('gh_user_meta');
    const user = rawUser ? JSON.parse(rawUser) : null;
    if (user && user.username) {
      document.getElementById('user-avatar').src = user.avatarUrl || '';
      document.getElementById('user-username').textContent = user.username;
      document.getElementById('welcome-username').textContent = user.username;
    }
  } catch (e) {
    console.error("Could not load local user info for menu.", e);
  }
}

setupMenu();
