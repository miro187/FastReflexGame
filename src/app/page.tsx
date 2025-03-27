'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { io, Socket } from 'socket.io-client';

interface Player {
  id: string;
  name: string;
  isReady: boolean;
  isHost: boolean;
}

interface LobbyState {
  players: Player[];
  state: string;
}

// Create socket as a global variable
declare global {
  var socket: Socket | null;
}

// Determine the server URL based on environment
const getServerUrl = () => {
  // In the browser
  if (typeof window !== 'undefined') {
    // Check for environment variable first
    if (process.env.NEXT_PUBLIC_SERVER_URL) {
      return process.env.NEXT_PUBLIC_SERVER_URL;
    }
    
    // For local development
    if (window.location.hostname === 'localhost') {
      return 'http://localhost:3001';
    }
    
    // For production - same origin as the client
    return window.location.origin;
  }
  
  // Default for server-side rendering
  return process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3001';
};

// Initialize socket if it doesn't exist yet
if (typeof window !== 'undefined' && !global.socket) {
  console.log('Initializing global socket connection...');
  global.socket = io(getServerUrl(), {
    transports: ['websocket'],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    autoConnect: true
  });
}

export default function Home() {
  const [lobbyId, setLobbyId] = useState<string>('');
  const [playerName, setPlayerName] = useState<string>('');
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string>('');
  const [connectionStatus, setConnectionStatus] = useState<string>('disconnected');
  const [lobbyState, setLobbyState] = useState<LobbyState | null>(null);
  const router = useRouter();

  useEffect(() => {
    // Ensure socket is initialized
    if (typeof window !== 'undefined' && !global.socket) {
      console.log('Initializing socket connection...');
      global.socket = io(getServerUrl(), {
        transports: ['websocket'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        autoConnect: true
      });
    }

    const socket = global.socket;
    if (!socket) return;

    const onConnect = () => {
      console.log('Connected to server successfully');
      setConnectionStatus('connected');
      setError('');
    };

    const onConnectError = (err: Error) => {
      console.error('Connection error:', err);
      setConnectionStatus('error');
      setError('Could not connect to server. Please make sure the server is running.');
    };

    const onDisconnect = (reason: string) => {
      console.log('Disconnected from server:', reason);
      setConnectionStatus('disconnected');
      setLobbyState(null);
    };

    const onLobbyCreated = (id: string) => {
      console.log('Lobby created with ID:', id);
      setLobbyId(id);
      setIsCreating(false);
      
      // Wait a short time before joining to ensure the lobby is registered on the server
      setTimeout(() => {
        if (socket?.connected && playerName) {
          console.log('Auto-joining created lobby:', id);
          socket.emit('joinLobby', { lobbyId: id, playerName });
        }
      }, 100);
    };

    const onLobbyState = (state: LobbyState) => {
      console.log('Lobby state updated:', state);
      setLobbyState(state);
      setIsJoining(false);
    };

    const onGameStart = () => {
      console.log('Game starting, redirecting to game page...');
      if (lobbyId) {
        router.push(`/game/${lobbyId}`);
      }
    };

    const onError = (message: string) => {
      console.error('Server error:', message);
      setError(message);
      setIsCreating(false);
      setIsJoining(false);
    };

    socket.on('connect', onConnect);
    socket.on('connect_error', onConnectError);
    socket.on('disconnect', onDisconnect);
    socket.on('lobbyCreated', onLobbyCreated);
    socket.on('lobbyState', onLobbyState);
    socket.on('gameStart', onGameStart);
    socket.on('error', onError);

    // Set initial connection status
    if (socket.connected) {
      setConnectionStatus('connected');
    }

    return () => {
      socket.off('connect', onConnect);
      socket.off('connect_error', onConnectError);
      socket.off('disconnect', onDisconnect);
      socket.off('lobbyCreated', onLobbyCreated);
      socket.off('lobbyState', onLobbyState);
      socket.off('gameStart', onGameStart);
      socket.off('error', onError);
    };
  }, [lobbyId, router, playerName]);

  const createLobby = () => {
    if (!global.socket?.connected) {
      console.error('Cannot create lobby: Socket not connected');
      setError('Not connected to server. Please refresh the page.');
      return;
    }
    if (!playerName) {
      setError('Please enter your name');
      return;
    }
    console.log('Creating new lobby...');
    setIsCreating(true);
    setError('');
    global.socket.emit('createLobby', playerName);
  };

  const joinLobby = () => {
    if (!global.socket?.connected) {
      console.error('Cannot join lobby: Socket not connected');
      setError('Not connected to server. Please refresh the page.');
      return;
    }
    if (!playerName) {
      setError('Please enter your name');
      return;
    }
    if (!lobbyId) {
      setError('Please enter a lobby ID');
      return;
    }
    console.log('Joining lobby:', lobbyId);
    setError('');
    setIsJoining(true);
    global.socket.emit('joinLobby', { lobbyId, playerName });
  };

  const toggleReady = () => {
    if (global.socket?.connected && lobbyId) {
      global.socket.emit('toggleReady', lobbyId);
    }
  };

  const startGame = () => {
    if (global.socket?.connected && lobbyId) {
      global.socket.emit('startGame', lobbyId);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(lobbyId);
    alert('Lobby code copied to clipboard!');
  };

  const isHost = lobbyState?.players.find(p => p.id === global.socket?.id)?.isHost;
  const isReady = lobbyState?.players.find(p => p.id === global.socket?.id)?.isReady;
  const allPlayersReady = lobbyState?.players.length === 2 && lobbyState.players.every(p => p.isReady || p.isHost);

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4 bg-gray-100">
      <h1 className="text-4xl font-bold mb-8">Fast Reflex</h1>
      
      <div className={`mb-4 px-4 py-2 rounded ${
        connectionStatus === 'connected' ? 'bg-green-100 text-green-700' :
        connectionStatus === 'error' ? 'bg-red-100 text-red-700' :
        'bg-yellow-100 text-yellow-700'
      }`}>
        Status: {connectionStatus}
      </div>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}
      
      {lobbyState ? (
        <div className="text-center space-y-6 w-full max-w-md">
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-2xl font-bold mb-4">Lobby: {lobbyId}</h2>
            <button
              onClick={copyToClipboard}
              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 mb-4"
            >
              Copy Lobby Code
            </button>
            
            <div className="space-y-4">
              {lobbyState.players.map((player) => (
                <div key={player.id} className="flex items-center justify-between bg-gray-50 p-3 rounded">
                  <div>
                    <span className="font-bold">{player.name}</span>
                    {player.isHost && <span className="ml-2 text-blue-600">(Host)</span>}
                  </div>
                  <div className={`px-3 py-1 rounded ${
                    player.isReady ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                  }`}>
                    {player.isReady ? 'Ready' : 'Not Ready'}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 space-y-4">
              {!isHost && (
                <button
                  onClick={toggleReady}
                  className={`w-full py-2 px-4 rounded transition-colors ${
                    isReady
                      ? 'bg-yellow-500 hover:bg-yellow-600 text-white'
                      : 'bg-green-500 hover:bg-green-600 text-white'
                  }`}
                >
                  {isReady ? 'Not Ready' : 'Ready'}
                </button>
              )}
              
              {isHost && (
                <button
                  onClick={startGame}
                  disabled={!allPlayersReady || lobbyState.players.length < 2}
                  className="w-full bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600 disabled:bg-gray-400"
                >
                  Start Game
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4 w-full max-w-md">
          <input
            type="text"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            placeholder="Enter your name"
            className="w-full border p-2 rounded mb-4"
          />

          <button
            onClick={createLobby}
            disabled={isCreating || connectionStatus !== 'connected' || !playerName}
            className="w-full bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600 disabled:bg-gray-400"
          >
            {isCreating ? 'Creating Lobby...' : 'Create New Game'}
          </button>

          <div className="flex gap-2">
            <input
              type="text"
              value={lobbyId}
              onChange={(e) => setLobbyId(e.target.value)}
              placeholder="Enter Lobby ID"
              className="flex-1 border p-2 rounded"
            />
            <button
              onClick={joinLobby}
              disabled={!lobbyId || connectionStatus !== 'connected' || !playerName || isJoining}
              className="bg-green-500 text-white py-2 px-4 rounded hover:bg-green-600 disabled:bg-gray-400"
            >
              {isJoining ? 'Joining...' : 'Join Game'}
            </button>
          </div>
        </div>
      )}
    </main>
  );
} 