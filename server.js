const http = require('http');
const express = require('express');
const cors = require('cors');
const { Server } = require('socket.io');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);

// Environment variables
const PORT = process.env.PORT || 3001;
const NODE_ENV = process.env.NODE_ENV || 'development';
const isProd = NODE_ENV === 'production';

// CORS configuration based on environment
const corsOptions = isProd
  ? {
      origin: function (origin, callback) {
        // In production, allow any origin (this can be restricted later)
        callback(null, true);
      },
      methods: ["GET", "POST"],
      credentials: true
    }
  : {
      origin: "http://localhost:3000",
      methods: ["GET", "POST"],
      credentials: true
    };

app.use(cors(corsOptions));

// For production, serve the Next.js build
if (isProd) {
  const nextPath = path.join(__dirname, '.next');
  const publicPath = path.join(__dirname, 'public');
  
  // Serve static files from the Next.js build
  app.use(express.static(publicPath));
  app.use(express.static(path.join(__dirname, '.next/static'), {
    maxAge: '1y',
    immutable: true
  }));
  
  // Handle Next.js pages
  app.get('/_next/*', (req, res) => {
    const filePath = path.join(nextPath, req.url.replace('/_next', ''));
    res.sendFile(filePath);
  });
}

// Socket.io setup
const io = new Server(server, {
  cors: corsOptions,
  pingTimeout: 60000
});

// Game state
const games = new Map();

// Player interface
class Player {
  constructor(id, name, isHost = false) {
    this.id = id;
    this.name = name || 'Player';
    this.isReady = isHost; // Host is automatically ready
    this.isHost = isHost;
  }
}

// Game class
class Game {
  constructor(id, hostPlayer) {
    this.id = id;
    this.players = [hostPlayer];
    this.state = 'waiting';
    this.result = null;
    this.winner = null;
    this.clicks = [];
  }
}

// Function to update and emit lobby state
function updateLobbyState(gameId) {
  const game = games.get(gameId);
  if (!game) return;

  // Only send state information to clients
  const lobbyState = {
    players: game.players,
    state: game.state
  };

  io.to(gameId).emit('lobbyState', lobbyState);
}

// Function to send game results to players
function sendGameResults(gameId) {
  const game = games.get(gameId);
  if (!game || !game.winner) return;

  // Send results to each player
  game.players.forEach(player => {
    const result = player.id === game.winner ? 'win' : 'lose';
    io.to(player.id).emit('gameResult', { 
      winner: player.id === game.winner ? player.id : null,
      result 
    });
  });
}

// Socket.io connection handler
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  // Create a new lobby
  socket.on('createLobby', (playerName) => {
    try {
      const lobbyId = uuidv4().substring(0, 6);
      const player = new Player(socket.id, playerName, true);
      const game = new Game(lobbyId, player);
      
      games.set(lobbyId, game);
      socket.join(lobbyId);
      
      console.log(`Lobby created: ${lobbyId} by ${playerName} (${socket.id})`);
      socket.emit('lobbyCreated', lobbyId);
      
      // Update lobby state after creation
      updateLobbyState(lobbyId);
    } catch (error) {
      console.error('Error creating lobby:', error);
      socket.emit('error', 'Failed to create lobby');
    }
  });

  // Join an existing lobby
  socket.on('joinLobby', ({ lobbyId, playerName }) => {
    try {
      console.log(`Player ${playerName} (${socket.id}) trying to join lobby: ${lobbyId}`);
      
      if (!lobbyId) {
        socket.emit('error', 'Lobby ID is required');
        return;
      }

      const game = games.get(lobbyId);
      
      if (!game) {
        console.log(`Lobby ${lobbyId} not found`);
        socket.emit('error', 'Lobby not found');
        return;
      }

      // Check if player is already in the game
      const existingPlayerIndex = game.players.findIndex(p => p.id === socket.id);
      if (existingPlayerIndex >= 0) {
        console.log(`Player ${socket.id} already in lobby ${lobbyId}`);
        socket.join(lobbyId);
        updateLobbyState(lobbyId);
        return;
      }

      // Check if lobby is full (max 2 players)
      if (game.players.length >= 2) {
        console.log(`Lobby ${lobbyId} is full`);
        socket.emit('error', 'Lobby is full');
        return;
      }

      // Add player to the game
      const player = new Player(socket.id, playerName);
      game.players.push(player);
      socket.join(lobbyId);
      
      console.log(`Player ${playerName} (${socket.id}) joined lobby: ${lobbyId}`);
      
      // Update lobby state for all players
      updateLobbyState(lobbyId);
    } catch (error) {
      console.error('Error joining lobby:', error);
      socket.emit('error', 'Failed to join lobby');
    }
  });

  // Player toggles ready status
  socket.on('toggleReady', (lobbyId) => {
    try {
      const game = games.get(lobbyId);
      if (!game) {
        socket.emit('error', 'Lobby not found');
        return;
      }

      const playerIndex = game.players.findIndex(p => p.id === socket.id);
      if (playerIndex === -1) {
        socket.emit('error', 'Player not in lobby');
        return;
      }

      // Toggle ready status (host is always ready)
      if (!game.players[playerIndex].isHost) {
        game.players[playerIndex].isReady = !game.players[playerIndex].isReady;
      }
      
      // Update lobby state for all players
      updateLobbyState(lobbyId);
    } catch (error) {
      console.error('Error toggling ready:', error);
      socket.emit('error', 'Failed to toggle ready status');
    }
  });

  // Host starts the game
  socket.on('startGame', (lobbyId) => {
    try {
      const game = games.get(lobbyId);
      if (!game) {
        socket.emit('error', 'Lobby not found');
        return;
      }

      // Check if the socket is the host
      const player = game.players.find(p => p.id === socket.id);
      if (!player || !player.isHost) {
        socket.emit('error', 'Only the host can start the game');
        return;
      }

      // Check if all players are ready and there are exactly 2 players
      const allReady = game.players.every(p => p.isReady || p.isHost);
      if (!allReady || game.players.length !== 2) {
        socket.emit('error', 'Not all players are ready or missing players');
        return;
      }

      console.log(`Starting game in lobby: ${lobbyId}`);
      
      // Start the game
      game.state = 'countdown';
      io.to(lobbyId).emit('gameState', 'countdown');
      io.to(lobbyId).emit('gameStart');
      
      // Start countdown
      let count = 3;
      const countdownInterval = setInterval(() => {
        io.to(lobbyId).emit('countdown', count);
        count--;
        
        if (count < 0) {
          clearInterval(countdownInterval);
          game.state = 'red';
          io.to(lobbyId).emit('gameState', 'red');
          
          // Random delay before turning green
          const delay = 2000 + Math.random() * 5000;
          setTimeout(() => {
            if (games.has(lobbyId)) {
              const currentGame = games.get(lobbyId);
              currentGame.state = 'green';
              currentGame.clicks = [];
              io.to(lobbyId).emit('gameState', 'green');
            }
          }, delay);
        }
      }, 1000);
    } catch (error) {
      console.error('Error starting game:', error);
      socket.emit('error', 'Failed to start game');
    }
  });

  // Player clicked
  socket.on('playerClick', (lobbyId) => {
    try {
      const game = games.get(lobbyId);
      if (!game) {
        socket.emit('error', 'Game not found');
        return;
      }

      // Check if player is in the game
      const playerIndex = game.players.findIndex(p => p.id === socket.id);
      if (playerIndex === -1) {
        socket.emit('error', 'Player not in game');
        return;
      }

      // Handle click based on game state
      if (game.state === 'red') {
        // Player clicked too early
        game.state = 'finished';
        game.winner = game.players.find(p => p.id !== socket.id)?.id;
        io.to(lobbyId).emit('gameState', 'finished');
        
        // Send results to players
        sendGameResults(lobbyId);
      } else if (game.state === 'green') {
        // Record the click
        game.clicks.push({
          playerId: socket.id,
          time: Date.now()
        });

        // If this is the first click, they win
        if (game.clicks.length === 1) {
          game.state = 'finished';
          game.winner = socket.id;
          io.to(lobbyId).emit('gameState', 'finished');
          
          // Send results to players
          sendGameResults(lobbyId);
        }
      }
    } catch (error) {
      console.error('Error handling player click:', error);
      socket.emit('error', 'Failed to process click');
    }
  });

  // Player disconnects
  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
    
    // Find games the player is in
    for (const [lobbyId, game] of games.entries()) {
      const playerIndex = game.players.findIndex(p => p.id === socket.id);
      
      if (playerIndex !== -1) {
        // Remove player from the game
        game.players.splice(playerIndex, 1);
        
        // If no players left, remove the game
        if (game.players.length === 0) {
          games.delete(lobbyId);
          console.log(`Lobby ${lobbyId} removed (no players left)`);
        } else {
          // If the host left, assign a new host
          if (!game.players.some(p => p.isHost)) {
            game.players[0].isHost = true;
            game.players[0].isReady = true;
          }
          
          // Update lobby state for remaining players
          updateLobbyState(lobbyId);
        }
      }
    }
  });
});

// Start the server
server.listen(PORT, () => {
  console.log(`Server running in ${NODE_ENV} mode on port ${PORT}`);
  
  if (isProd) {
    console.log('Serving Next.js app in production mode');
  }
}); 