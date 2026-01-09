// Backend Server for Chat App
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 3000;

// Store active users and rooms
const users = new Map();
const rooms = new Map();

// Serve static files
app.use(express.static(path.join(__dirname)));

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/health', (req, res) => {
    res.json({ status: 'OK', message: 'Chat server is running' });
});

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    // Handle user joining a room
    socket.on('joinRoom', (data) => {
        const { username, room } = data;
        
        // Store user info
        users.set(socket.id, {
            id: socket.id,
            username,
            room
        });

        // Join the room
        socket.join(room);

        // Initialize room if it doesn't exist
        if (!rooms.has(room)) {
            rooms.set(room, new Set());
        }
        rooms.get(room).add(socket.id);

        // Get room users
        const roomUsers = getRoomUsers(room);

        // Welcome message to user
        socket.emit('message', {
            username: 'System',
            message: `Welcome to ${room}, ${username}!`,
            time: new Date().toLocaleTimeString()
        });

        // Broadcast to room that user joined
        socket.to(room).emit('userJoined', {
            username,
            users: roomUsers
        });

        // Send room users to all clients in room
        io.to(room).emit('roomUsers', {
            room,
            users: roomUsers
        });

        console.log(`${username} joined room: ${room}`);
    });

    // Handle chat messages
    socket.on('chatMessage', (data) => {
        const user = users.get(socket.id);
        if (user) {
            const messageData = {
                username: user.username,
                message: data.message,
                time: new Date().toLocaleTimeString()
            };

            // Broadcast message to room
            io.to(user.room).emit('message', messageData);
            console.log(`Message from ${user.username} in ${user.room}: ${data.message}`);
        }
    });

    // Handle typing indicators
    socket.on('typing', (data) => {
        const user = users.get(socket.id);
        if (user) {
            socket.to(user.room).emit('typing', {
                username: user.username
            });
        }
    });

    socket.on('stopTyping', () => {
        const user = users.get(socket.id);
        if (user) {
            socket.to(user.room).emit('stopTyping');
        }
    });

    // Handle user leaving room
    socket.on('leaveRoom', () => {
        handleUserLeave(socket);
    });

    // Handle disconnect
    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
        handleUserLeave(socket);
    });
});

// Helper function to handle user leaving
function handleUserLeave(socket) {
    const user = users.get(socket.id);
    
    if (user) {
        const { username, room } = user;
        
        // Remove user from room
        if (rooms.has(room)) {
            rooms.get(room).delete(socket.id);
            
            // If room is empty, delete it
            if (rooms.get(room).size === 0) {
                rooms.delete(room);
            }
        }
        
        // Remove user from users map
        users.delete(socket.id);
        
        // Get updated room users
        const roomUsers = getRoomUsers(room);
        
        // Broadcast to room that user left
        socket.to(room).emit('userLeft', {
            username,
            users: roomUsers
        });
        
        // Update room users list
        io.to(room).emit('roomUsers', {
            room,
            users: roomUsers
        });
        
        console.log(`${username} left room: ${room}`);
    }
}

// Helper function to get users in a room
function getRoomUsers(room) {
    const roomUserIds = rooms.get(room) || new Set();
    const roomUsers = [];
    
    roomUserIds.forEach(userId => {
        const user = users.get(userId);
        if (user) {
            roomUsers.push({
                id: user.id,
                username: user.username
            });
        }
    });
    
    return roomUsers;
}

// API endpoints for monitoring
app.get('/api/stats', (req, res) => {
    res.json({
        totalUsers: users.size,
        totalRooms: rooms.size,
        rooms: Array.from(rooms.keys()).map(room => ({
            name: room,
            userCount: rooms.get(room).size
        }))
    });
});

app.get('/api/rooms', (req, res) => {
    const roomStats = Array.from(rooms.keys()).map(room => ({
        name: room,
        users: getRoomUsers(room)
    }));
    res.json(roomStats);
});

// Start server
server.listen(PORT, () => {
    console.log(`🚀 Chat server running on http://localhost:${PORT}`);
    console.log(`📊 Stats available at http://localhost:${PORT}/api/stats`);
    console.log(`🏠 Rooms info at http://localhost:${PORT}/api/rooms`);
});