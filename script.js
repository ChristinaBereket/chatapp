// Frontend JavaScript for Chat App
class ChatApp {
    constructor() {
        this.socket = null;
        this.username = '';
        this.room = '';
        this.isTyping = false;
        this.typingTimeout = null;
        this.init();
    }

    init() {
        this.bindEvents();
        this.connectToServer();
    }

    connectToServer() {
        try {
            // Try to connect to Socket.IO server
            this.socket = io('http://localhost:3000');
            this.setupSocketEvents();
        } catch (error) {
            console.log('Socket.IO server not available, using demo mode');
            this.setupDemoMode();
        }
    }

    setupSocketEvents() {
        const statusElement = document.getElementById('connectionStatus');

        this.socket.on('connect', () => {
            statusElement.className = 'connection-status connected';
            statusElement.innerHTML = '<i class="fas fa-circle"></i><span>Connected</span>';
        });

        this.socket.on('disconnect', () => {
            statusElement.className = 'connection-status disconnected';
            statusElement.innerHTML = '<i class="fas fa-circle"></i><span>Disconnected</span>';
        });

        this.socket.on('message', (data) => {
            this.displayMessage(data);
        });

        this.socket.on('userJoined', (data) => {
            this.displaySystemMessage(`${data.username} joined the chat`);
            this.updateUsersList(data.users);
        });

        this.socket.on('userLeft', (data) => {
            this.displaySystemMessage(`${data.username} left the chat`);
            this.updateUsersList(data.users);
        });

        this.socket.on('roomUsers', (data) => {
            this.updateUsersList(data.users);
            document.getElementById('userCount').textContent = `${data.users.length} users online`;
        });

        this.socket.on('typing', (data) => {
            this.showTypingIndicator(data.username);
        });

        this.socket.on('stopTyping', () => {
            this.hideTypingIndicator();
        });
    }

    setupDemoMode() {
        const statusElement = document.getElementById('connectionStatus');
        statusElement.className = 'connection-status disconnected';
        statusElement.innerHTML = '<i class="fas fa-circle"></i><span>Demo Mode</span>';
        
        // Add some demo messages
        setTimeout(() => {
            this.displaySystemMessage('Welcome to the chat demo!');
            this.displayMessage({
                username: 'Demo Bot',
                message: 'This is a demo message. Start the backend server to enable real-time chat!',
                time: new Date().toLocaleTimeString()
            });
        }, 1000);
    }

    bindEvents() {
        // Join form
        document.getElementById('joinForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.joinChat();
        });

        // Message form
        document.getElementById('messageForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.sendMessage();
        });

        // Leave button
        document.getElementById('leaveBtn').addEventListener('click', () => {
            this.leaveChat();
        });

        // Typing indicator
        const messageInput = document.getElementById('messageInput');
        messageInput.addEventListener('input', () => {
            this.handleTyping();
        });

        messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });
    }

    joinChat() {
        const usernameInput = document.getElementById('username');
        const roomSelect = document.getElementById('room');
        
        this.username = usernameInput.value.trim();
        this.room = roomSelect.value;

        if (!this.username) {
            alert('Please enter your name');
            return;
        }

        // Hide join form, show chat
        document.getElementById('joinContainer').style.display = 'none';
        document.getElementById('chatContainer').style.display = 'grid';
        
        // Update room name
        document.getElementById('roomName').textContent = roomSelect.options[roomSelect.selectedIndex].text;

        if (this.socket && this.socket.connected) {
            // Join room via socket
            this.socket.emit('joinRoom', {
                username: this.username,
                room: this.room
            });
        } else {
            // Demo mode
            this.displaySystemMessage(`You joined ${roomSelect.options[roomSelect.selectedIndex].text} as ${this.username}`);
            document.getElementById('userCount').textContent = '1 user online (demo mode)';
            this.updateUsersList([{ username: this.username, id: 'demo' }]);
        }
    }

    sendMessage() {
        const messageInput = document.getElementById('messageInput');
        const message = messageInput.value.trim();

        if (!message) return;

        const messageData = {
            username: this.username,
            message: message,
            room: this.room,
            time: new Date().toLocaleTimeString()
        };

        if (this.socket && this.socket.connected) {
            this.socket.emit('chatMessage', messageData);
        } else {
            // Demo mode - display own message
            this.displayMessage(messageData, true);
        }

        messageInput.value = '';
        this.stopTyping();
    }

    displayMessage(data, isOwn = false) {
        const messagesContainer = document.getElementById('messages');
        const messageElement = document.createElement('div');
        
        messageElement.className = `message ${isOwn || data.username === this.username ? 'own' : ''}`;
        messageElement.innerHTML = `
            <div class="message-header">
                <span class="message-username">${data.username}</span>
                <span class="message-time">${data.time}</span>
            </div>
            <div class="message-content">${this.escapeHtml(data.message)}</div>
        `;

        messagesContainer.appendChild(messageElement);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    displaySystemMessage(message) {
        const messagesContainer = document.getElementById('messages');
        const messageElement = document.createElement('div');
        
        messageElement.className = 'message system';
        messageElement.innerHTML = `
            <div class="message-content">${message}</div>
        `;

        messagesContainer.appendChild(messageElement);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    updateUsersList(users) {
        const usersList = document.getElementById('usersList');
        usersList.innerHTML = users.map(user => `
            <div class="user-item ${user.username === this.username ? 'current-user' : ''}">
                <div class="user-status"></div>
                <span>${user.username}</span>
            </div>
        `).join('');
    }

    handleTyping() {
        if (!this.isTyping && this.socket && this.socket.connected) {
            this.isTyping = true;
            this.socket.emit('typing', {
                username: this.username,
                room: this.room
            });
        }

        clearTimeout(this.typingTimeout);
        this.typingTimeout = setTimeout(() => {
            this.stopTyping();
        }, 1000);
    }

    stopTyping() {
        if (this.isTyping && this.socket && this.socket.connected) {
            this.isTyping = false;
            this.socket.emit('stopTyping', {
                room: this.room
            });
        }
    }

    showTypingIndicator(username) {
        const indicator = document.getElementById('typingIndicator');
        const text = indicator.querySelector('.typing-text');
        text.textContent = `${username} is typing...`;
        indicator.style.display = 'flex';
    }

    hideTypingIndicator() {
        document.getElementById('typingIndicator').style.display = 'none';
    }

    leaveChat() {
        if (this.socket && this.socket.connected) {
            this.socket.emit('leaveRoom', {
                username: this.username,
                room: this.room
            });
        }

        // Reset UI
        document.getElementById('joinContainer').style.display = 'flex';
        document.getElementById('chatContainer').style.display = 'none';
        document.getElementById('messages').innerHTML = '';
        document.getElementById('username').value = '';
        
        this.username = '';
        this.room = '';
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize the chat app
let chatApp;
document.addEventListener('DOMContentLoaded', () => {
    chatApp = new ChatApp();
});

// Handle page unload
window.addEventListener('beforeunload', () => {
    if (chatApp && chatApp.socket) {
        chatApp.socket.disconnect();
    }
});