import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import cors from 'cors';
import path from 'path';

const app = express();
app.use(cors());

// For production, serve the Next.js build
if (process.env.NODE_ENV === 'production') {
  const nextDir = path.join(__dirname, '.next');
  app.use(express.static(path.join(__dirname, 'public')));
  app.use(express.static(nextDir));
  
  app.get('*', (req, res) => {
    res.sendFile(path.join(nextDir, 'server', 'pages', 'index.html'));
  });
}

const httpServer = createServer(app);

// Adapt CORS settings based on environment
const CORS_ORIGIN = process.env.CORS_ORIGIN || "*";

const io = new Server(httpServer, {
  cors: {
    origin: CORS_ORIGIN,
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ['websocket']
});

interface Player {
  id: string;
  name: string;
  isReady: boolean;
  isHost: boolean;
}

interface Game {
  id: string;
  players: Player[];
  state: 'waiting' | 'countdown' | 'red' | 'green' | 'finished';
  winner: string | null;
  startTime: number | null;
}

// Store games in a more easily debuggable structure
const games = new Map<string, Game>();

// Keep track of which socket belongs to which game
const socketToGame = new Map<string, string>();

const generateLobbyId = () => {
  return uuidv4().slice(0, 8);
};

const startGame = (gameId: string) => {
  const game = games.get(gameId);
  if (!game) return;

  console.log(`Starting game ${gameId} with ${game.players.length} players`);
  
  // First tell all players that the game is starting
  io.to(gameId).emit('gameStart', gameId);
  
  // Set the game state to countdown
  game.state = 'countdown';
  io.to(gameId).emit('gameState', 'countdown');

  // Start the countdown
  let countdown = 3;
  const countdownInterval = setInterval(() => {
    console.log(`Countdown: ${countdown}`);
    io.to(gameId).emit('countdown', countdown);
    countdown--;

    if (countdown < 0) {
      clearInterval(countdownInterval);
      startRound(gameId);
    }
  }, 1000);
};

const startRound = (gameId: string) => {
  const game = games.get(gameId);
  if (!game) return;

  console.log(`Starting round for game ${gameId}`);
  game.state = 'red';
  io.to(gameId).emit('gameState', 'red');

  const delay = Math.random() * 3000 + 2000;
  setTimeout(() => {
    if (games.has(gameId) && games.get(gameId)?.state === 'red') {
      const game = games.get(gameId)!;
      game.state = 'green';
      game.startTime = Date.now();
      io.to(gameId).emit('gameState', 'green');
    }
  }, delay);
};

const updateLobbyState = (gameId: string) => {
  const game = games.get(gameId);
  if (!game) return;

  console.log(`Updating lobby state for ${gameId}, players: ${game.players.length}`);
  
  io.to(gameId).emit('lobbyState', {
    players: game.players,
    state: game.state
  });
};

// Helper function to send game results to both players
const sendGameResults = (game: Game, winnerId: string | null) => {
  if (!game) return;
  
  console.log(`Sending game results for game ${game.id}, winner: ${winnerId}`);
  
  // Store the winner in the game object
  game.winner = winnerId;
  
  // Send individual results to each player
  game.players.forEach(player => {
    const isWinner = player.id === winnerId;
    io.to(player.id).emit('gameResult', {
      winner: winnerId,
      result: isWinner ? 'win' : 'lose'
    });
  });
  
  // Update game state for all players
  io.to(game.id).emit('gameState', 'finished');
};

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('createLobby', (playerName: string) => {
    try {
      const lobbyId = generateLobbyId();
      console.log(`Creating lobby ${lobbyId} for player ${playerName} (${socket.id})`);
      
      // First check if player is already in a game
      if (socketToGame.has(socket.id)) {
        const existingGameId = socketToGame.get(socket.id);
        console.log(`Player ${socket.id} is already in game ${existingGameId}, removing from that game first`);
        
        // Remove from existing game
        if (existingGameId && games.has(existingGameId)) {
          const existingGame = games.get(existingGameId)!;
          existingGame.players = existingGame.players.filter(p => p.id !== socket.id);
          
          if (existingGame.players.length === 0) {
            games.delete(existingGameId);
          } else {
            updateLobbyState(existingGameId);
          }
        }
        
        socketToGame.delete(socket.id);
      }
      
      const game: Game = {
        id: lobbyId,
        players: [{
          id: socket.id,
          name: playerName || 'Player 1',
          isReady: true,
          isHost: true
        }],
        state: 'waiting',
        winner: null,
        startTime: null
      };

      games.set(lobbyId, game);
      socketToGame.set(socket.id, lobbyId);
      socket.join(lobbyId);
      
      console.log(`Emitting lobbyCreated for ${lobbyId}`);
      socket.emit('lobbyCreated', lobbyId);
      
      console.log(`Updating lobby state for ${lobbyId}`);
      updateLobbyState(lobbyId);
    } catch (error) {
      console.error('Error creating lobby:', error);
      socket.emit('error', 'Failed to create lobby');
    }
  });

  socket.on('joinLobby', ({ lobbyId, playerName }: { lobbyId: string, playerName: string }) => {
    try {
      console.log(`Player ${playerName} (${socket.id}) attempting to join lobby ${lobbyId}`);
      
      // Debug: Print all available lobbies
      console.log(`Available lobbies: ${Array.from(games.keys()).join(', ')}`);
      
      const game = games.get(lobbyId);
      
      if (!game) {
        console.log(`Lobby ${lobbyId} not found`);
        socket.emit('error', 'Lobby not found');
        return;
      }

      // Check if player is already in another game
      if (socketToGame.has(socket.id)) {
        const currentGameId = socketToGame.get(socket.id);
        if (currentGameId !== lobbyId) {
          console.log(`Player ${socket.id} is in game ${currentGameId}, removing before joining ${lobbyId}`);
          
          // Leave current game
          if (currentGameId && games.has(currentGameId)) {
            const currentGame = games.get(currentGameId)!;
            currentGame.players = currentGame.players.filter(p => p.id !== socket.id);
            
            if (currentGame.players.length === 0) {
              games.delete(currentGameId);
            } else {
              updateLobbyState(currentGameId);
            }
          }
        }
      }

      // Check if player is already in this game
      const existingPlayer = game.players.find(p => p.id === socket.id);
      if (existingPlayer) {
        console.log(`Player ${playerName} (${socket.id}) is already in lobby ${lobbyId}`);
        socket.join(lobbyId);
        updateLobbyState(lobbyId);
        return;
      }

      // Check if game is full (2 players maximum)
      if (game.players.length >= 2) {
        console.log(`Lobby ${lobbyId} is full`);
        socket.emit('error', 'Lobby is full');
        return;
      }

      // Add player to the game
      game.players.push({
        id: socket.id,
        name: playerName || `Player ${game.players.length + 1}`,
        isReady: false,
        isHost: false
      });
      
      socketToGame.set(socket.id, lobbyId);
      socket.join(lobbyId);
      updateLobbyState(lobbyId);
      console.log(`Player ${playerName} (${socket.id}) joined lobby ${lobbyId}`);
    } catch (error) {
      console.error('Error joining lobby:', error);
      socket.emit('error', 'Failed to join lobby');
    }
  });

  socket.on('toggleReady', (lobbyId: string) => {
    const game = games.get(lobbyId);
    if (!game) return;

    const player = game.players.find(p => p.id === socket.id);
    if (player && !player.isHost) {
      player.isReady = !player.isReady;
      updateLobbyState(lobbyId);
      
      // If all players are ready and there are 2 players, start the game
      if (game.players.length === 2 && game.players.every(p => p.isReady || p.isHost)) {
        console.log(`All players are ready in lobby ${lobbyId}, starting game...`);
        startGame(lobbyId);
      }
    }
  });

  socket.on('startGame', (lobbyId: string) => {
    const game = games.get(lobbyId);
    if (!game) {
      console.log(`Start game requested for non-existent lobby ${lobbyId}`);
      return;
    }

    console.log(`Start game requested for lobby ${lobbyId} by ${socket.id}`);
    const player = game.players.find(p => p.id === socket.id);
    if (player?.isHost && game.players.length === 2 && game.players.every(p => p.isReady || p.isHost)) {
      console.log(`Host ${socket.id} starting game for lobby ${lobbyId}`);
      startGame(lobbyId);
    } else {
      console.log(`Cannot start game for lobby ${lobbyId}: host=${player?.isHost}, players=${game.players.length}, all_ready=${game.players.every(p => p.isReady || p.isHost)}`);
    }
  });

  socket.on('playerClick', (gameId: string) => {
    try {
      const game = games.get(gameId);
      if (!game) return;

      // Handle clicking during red phase (false start)
      if (game.state === 'red') {
        game.state = 'finished';
        // Player who clicked loses (the other player wins)
        const opponent = game.players.find(p => p.id !== socket.id);
        const winnerId = opponent ? opponent.id : null;
        
        console.log(`Player ${socket.id} clicked during red phase, opponent ${winnerId} wins`);
        sendGameResults(game, winnerId);
      } 
      // Handle clicking during green phase (normal reaction)
      else if (game.state === 'green' && game.startTime) {
        game.state = 'finished';
        // Player who clicked first wins
        const winnerId = socket.id;
        
        console.log(`Player ${socket.id} clicked during green phase, they win`);
        sendGameResults(game, winnerId);
      }
    } catch (error) {
      console.error('Error handling player click:', error);
      socket.emit('error', 'Failed to process click');
    }
  });

  socket.on('requestRematch', (gameId: string) => {
    try {
      const game = games.get(gameId);
      if (!game) return;

      game.players.forEach(p => {
        if (!p.isHost) {
          p.isReady = false;
        }
      });
      game.state = 'waiting';
      game.winner = null;
      game.startTime = null;
      updateLobbyState(gameId);
    } catch (error) {
      console.error('Error handling rematch:', error);
      socket.emit('error', 'Failed to start rematch');
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    
    // Find and clean up any games the player was in
    if (socketToGame.has(socket.id)) {
      const gameId = socketToGame.get(socket.id);
      if (gameId && games.has(gameId)) {
        const game = games.get(gameId)!;
        game.players = game.players.filter(p => p.id !== socket.id);
        
        if (game.players.length === 0) {
          console.log(`Deleting empty game ${gameId}`);
          games.delete(gameId);
        } else {
          // If the host left, make the remaining player the host
          if (!game.players.some(p => p.isHost)) {
            game.players[0].isHost = true;
            game.players[0].isReady = true;
          }
          updateLobbyState(gameId);
        }
        
        // Notify remaining players
        io.to(gameId).emit('playerLeft');
      }
      
      socketToGame.delete(socket.id);
    }
  });
});

// Use the PORT environment variable for Render
const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 