import * as THREE from 'three';

export class UIManager {
    constructor(room, playerControls, camera, renderer) {
        this.room = room;
        this.playerControls = playerControls;
        this.camera = camera;
        this.renderer = renderer;
        this.healthBar = document.getElementById('health-bar');
        this.inventoryBar = document.getElementById('inventory-bar');
        this.crosshair = document.getElementById('crosshair');

        this.playerLabels = {};
        this.chatMessages = {};
        this.chatLogList = document.getElementById('chat-log-list');

        this.setupChat();
        this.setupInventory();
    }

    setPlayerControls(playerControls) {
        this.playerControls = playerControls;
    }

    setupChat() {
        const gameContainer = document.getElementById('game-container');
        
        // Create chat UI elements
        const chatInputContainer = document.createElement('div');
        chatInputContainer.id = 'chat-input-container';
        const chatInput = document.createElement('input');
        chatInput.id = 'chat-input';
        chatInput.type = 'text';
        chatInput.maxLength = 100;
        chatInput.placeholder = 'Type a message...';
        chatInputContainer.appendChild(chatInput);

        const closeChat = document.createElement('div');
        closeChat.id = 'close-chat';
        closeChat.innerHTML = '✕';
        chatInputContainer.appendChild(closeChat);
        gameContainer.appendChild(chatInputContainer);

        const chatButton = document.createElement('div');
        chatButton.id = 'chat-button';
        chatButton.innerText = 'CHAT';
        gameContainer.appendChild(chatButton);

        // Chat Event Listeners
        const openChat = () => {
            chatInputContainer.style.display = 'block';
            chatInput.focus();
            this.playerControls.enabled = false;
        };

        const closeChatFunc = () => {
            chatInputContainer.style.display = 'none';
            chatInput.value = '';
            this.playerControls.enabled = true;
        };
        
        const sendMessage = () => {
            const message = chatInput.value.trim();
            if (message) {
                // Broadcast chat message to other clients (realtime)
                try {
                    this.room.send({ type: 'chat', message, echo: true });
                } catch (e) {
                    // Fallback to presence update if send isn't available
                    this.room.updatePresence({
                        chat: { message: message, timestamp: Date.now() }
                    });
                }
                // No need to call showChatMessage for self, presence update will handle it now.
                // this.showChatMessage(this.room.clientId, message);
                closeChatFunc();
            }
        };

        document.addEventListener('keydown', (e) => {
            if (e.key === '/' && chatInputContainer.style.display !== 'block') {
                e.preventDefault();
                openChat();
            } else if (e.key === 'Escape' && chatInputContainer.style.display === 'block') {
                closeChatFunc();
            } else if (e.key === 'Enter' && chatInputContainer.style.display === 'block') {
                sendMessage();
            }
        });
        
        document.getElementById('close-chat').addEventListener('click', closeChatFunc);

        chatButton.addEventListener('click', (e) => {
            e.preventDefault();
            chatInputContainer.style.display === 'block' ? closeChatFunc() : openChat();
        });
        
        chatInput.addEventListener('keydown', (e) => e.stopPropagation());

        this.addPlayerUI(this.room.clientId, this.room.peers[this.room.clientId]?.username);
    }

    setupInventory() {
        if (!this.inventoryBar) return;
        this.inventoryBar.innerHTML = ''; // Clear existing
        for (let i = 1; i <= 5; i++) {
            const slot = document.createElement('div');
            slot.className = 'inventory-slot';
            slot.dataset.slot = i;
            slot.innerHTML = `<span class="slot-number">${i}</span>`;
            this.inventoryBar.appendChild(slot);
        }
    }

    updateInventory(equippedWeapon) {
        if (!this.inventoryBar) return;

        if (equippedWeapon) {
            this.inventoryBar.style.display = 'flex';
            if (equippedWeapon === 'bazooka') {
                this.crosshair.classList.remove('hidden');
            } else {
                this.crosshair.classList.add('hidden');
            }
        } else {
            this.inventoryBar.style.display = 'none';
            this.crosshair.classList.add('hidden');
        }

        const slots = this.inventoryBar.querySelectorAll('.inventory-slot');
        slots.forEach((slot, index) => {
            // Clear slot
            slot.innerHTML = `<span class="slot-number">${index + 1}</span>`;
            slot.classList.remove('equipped');

            if (index === 0 && equippedWeapon === 'sword') {
                slot.innerHTML += `<img src="/sword-icon.png" alt="Sword">`;
                slot.classList.add('equipped');
            }
            if (index === 0 && equippedWeapon === 'bazooka') {
                slot.innerHTML += `<img src="/bazooka-icon.png" alt="Bazooka">`;
                slot.classList.add('equipped');
            }
        });
    }

    addPlayerUI(clientId, username) {
        const gameContainer = document.getElementById('game-container');
        
        const label = document.createElement('div');
        label.className = 'player-name';
        label.textContent = username || `Player...`;
        gameContainer.appendChild(label);
        this.playerLabels[clientId] = label;

        const message = document.createElement('div');
        message.className = 'chat-message';
        message.style.display = 'none';
        gameContainer.appendChild(message);
        this.chatMessages[clientId] = message;
    }

    removePlayerUI(clientId) {
        if (this.playerLabels[clientId]) {
            this.playerLabels[clientId].remove();
            delete this.playerLabels[clientId];
        }
        if (this.chatMessages[clientId]) {
            this.chatMessages[clientId].remove();
            delete this.chatMessages[clientId];
        }
    }

    addMessageToLog(username, message) {
        if (!this.chatLogList) return;

        const li = document.createElement('li');
        
        const usernameSpan = document.createElement('span');
        usernameSpan.className = 'chat-username';
        usernameSpan.textContent = `${username}: `;
        
        const messageSpan = document.createElement('span');
        messageSpan.className = 'chat-log-message';
        messageSpan.textContent = message;

        li.appendChild(usernameSpan);
        li.appendChild(messageSpan);
        this.chatLogList.appendChild(li);

        // Auto-scroll to the bottom
        this.chatLogList.parentElement.scrollTop = this.chatLogList.parentElement.scrollHeight;

        // Limit chat log to 50 messages
        while (this.chatLogList.children.length > 50) {
            this.chatLogList.removeChild(this.chatLogList.firstChild);
        }
    }

    showChatMessage(clientId, message) {
        const username = this.room.peers[clientId]?.username || `Player...`;
        this.addMessageToLog(username, message);
        
        if (this.chatMessages[clientId]) {
            const chatEl = this.chatMessages[clientId];
            chatEl.textContent = message;
            chatEl.style.display = 'block';
            
            if (chatEl.timeout) clearTimeout(chatEl.timeout);
            chatEl.timeout = setTimeout(() => {
                chatEl.style.display = 'none';
            }, 5000);
        }
    }

    updateLeaderboard(presence) {
        const scoreDisplay = document.getElementById('score-display');
        const leaderboardList = document.getElementById('leaderboard-list');

        const myPresence = presence[this.room.clientId];
        scoreDisplay.textContent = `Score: ${myPresence?.score || 0}`;

        const playersWithScores = Object.entries(presence)
            .filter(([id, data]) => this.room.peers[id] && data)
            .map(([id, data]) => ({
                id,
                username: this.room.peers[id]?.username || `Player...`,
                score: data.score || 0
            }))
            .sort((a, b) => b.score - a.score);

        leaderboardList.innerHTML = '';
        playersWithScores.slice(0, 10).forEach(player => {
            const li = document.createElement('li');
            li.textContent = `${player.username}: ${player.score}`;
            if (player.id === this.room.clientId) {
                li.style.fontWeight = 'bold';
                li.style.color = '#4CAF50';
            }
            leaderboardList.appendChild(li);
        });
    }

    updateHealthBar(health, maxHealth) {
        if (health === undefined || maxHealth === undefined || !this.healthBar) return;
        const healthPercentage = (health / maxHealth) * 100;
        this.healthBar.style.width = `${healthPercentage}%`;
    }

    updateLabelsAndMessages(players) {
        for (const clientId in players) {
            const player = players[clientId];
            if (!player.model) continue;

            const screenPos = this.getScreenPosition(player.model.position);
            
            if (this.playerLabels[clientId]) {
                const label = this.playerLabels[clientId];
                if (screenPos) {
                    label.style.left = `${screenPos.x}px`;
                    label.style.top = `${screenPos.y - 20}px`;
                    label.style.display = screenPos.visible ? 'block' : 'none';
                } else {
                    label.style.display = 'none';
                }
            }

            if (this.chatMessages[clientId]) {
                const message = this.chatMessages[clientId];
                if (screenPos && message.style.display === 'block') {
                    message.style.left = `${screenPos.x}px`;
                    message.style.top = `${screenPos.y - 45}px`;
                }
            }
        }
    }

    getScreenPosition(position) {
        const vector = new THREE.Vector3();
        vector.copy(position).y += 1.5; // Position above player's head
        vector.project(this.camera);

        const widthHalf = this.renderer.domElement.width / 2;
        const heightHalf = this.renderer.domElement.height / 2;

        return {
            x: (vector.x * widthHalf) + widthHalf,
            y: -(vector.y * heightHalf) + heightHalf,
            visible: vector.z < 1
        };
    }
}