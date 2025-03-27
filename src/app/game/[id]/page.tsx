'use client';

import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

// Reuse the socket from the home page
declare global {
  var socket: Socket | null;
}

// Initialize socket if it doesn't exist yet
if (typeof window !== 'undefined' && !global.socket) {
  console.log('Initializing global socket connection from game page...');
  global.socket = io('http://localhost:3001', {
    transports: ['websocket'],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    autoConnect: true
  });
}

export default function GamePage() {
  const router = useRouter();
  const params = useParams();
  const gameId = params?.id as string;

  const [gameState, setGameState] = useState<string>('waiting');
  const [countdown, setCountdown] = useState<number | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reactionTime, setReactionTime] = useState<number | null>(null);
  const [clickTime, setClickTime] = useState<number | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<string>('connecting');
  const [showCountdownAnimation, setShowCountdownAnimation] = useState(false);

  // Define the handleClick function with useCallback
  const handleClick = useCallback(() => {
    if (gameState === 'green' && clickTime) {
      const time = Date.now() - clickTime;
      setReactionTime(time);
      global.socket?.emit('playerClick', gameId);
    } else if (gameState === 'red') {
      global.socket?.emit('playerClick', gameId);
    }
  }, [gameState, clickTime, gameId]);

  // Add keyboard event listener for spacebar
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Check if the key pressed is spacebar and we're in a clickable game state
      if (event.code === 'Space' && (gameState === 'green' || gameState === 'red')) {
        event.preventDefault(); // Prevent page scrolling
        handleClick();
      }
    };

    // Add the event listener
    window.addEventListener('keydown', handleKeyDown);

    // Clean up the event listener when component unmounts
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [gameState, handleClick]);

  useEffect(() => {
    if (!gameId) {
      router.push('/');
      return;
    }

    // Ensure socket is initialized
    if (typeof window !== 'undefined' && !global.socket) {
      console.log('Initializing socket connection for game...');
      global.socket = io('http://localhost:3001', {
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
      console.log('Connected to game server');
      setConnectionStatus('connected');
      // Try to rejoin the game lobby
      socket.emit('joinLobby', { lobbyId: gameId, playerName: 'Player' });
    };

    const onDisconnect = () => {
      console.log('Disconnected from game server');
      setConnectionStatus('disconnected');
      setError('Disconnected from game server');
    };

    const onGameState = (state: string) => {
      console.log('Game state changed:', state);
      setGameState(state);
      
      if (state === 'countdown') {
        setShowCountdownAnimation(true);
      } else if (state === 'green') {
        setClickTime(Date.now());
      }
    };

    const onCountdown = (count: number) => {
      console.log('Countdown:', count);
      setCountdown(count);
    };

    const onGameResult = (data: { winner: string, result: string }) => {
      console.log('Game result:', data);
      setResult(data.result);
    };

    const onError = (message: string) => {
      console.error('Game error:', message);
      setError(message);
      
      // Redirect to home after a error
      setTimeout(() => {
        router.push('/');
      }, 3000);
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('gameState', onGameState);
    socket.on('countdown', onCountdown);
    socket.on('gameResult', onGameResult);
    socket.on('error', onError);

    // Set initial connection status
    if (socket.connected) {
      setConnectionStatus('connected');
      socket.emit('joinLobby', { lobbyId: gameId, playerName: 'Player' });
    }

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('gameState', onGameState);
      socket.off('countdown', onCountdown);
      socket.off('gameResult', onGameResult);
      socket.off('error', onError);
    };
  }, [gameId, router]);

  const handleRematch = () => {
    global.socket?.emit('requestRematch', gameId);
    setResult(null);
    setReactionTime(null);
    setClickTime(null);
    setShowCountdownAnimation(false);
  };

  const getGameContent = () => {
    if (error) {
      return (
        <div className="text-red-600 text-center">
          <h2 className="text-2xl mb-4">Error</h2>
          <p>{error}</p>
          <p>Redirecting to home...</p>
        </div>
      );
    }

    if (connectionStatus !== 'connected') {
      return (
        <div className="text-center">
          <h2 className="text-2xl mb-4">Connecting to game server...</h2>
        </div>
      );
    }

    if (gameState === 'waiting') {
      return (
        <div className="text-center">
          <h2 className="text-2xl mb-4">Waiting for game to start...</h2>
        </div>
      );
    }

    if (gameState === 'countdown') {
      return (
        <div className="text-center">
          <div className="countdown-animation">
            <div className={`countdown-number ${showCountdownAnimation ? 'animate-countdown' : ''}`}>
              {countdown !== null ? countdown : 3}
            </div>
          </div>
          <p className="mt-4 text-xl">Get ready!</p>
        </div>
      );
    }

    if (gameState === 'red') {
      return (
        <div 
          onClick={handleClick}
          className="w-full h-64 bg-red-600 rounded-lg flex items-center justify-center text-white text-2xl cursor-pointer transition-all duration-300"
        >
          <div className="text-center">
            <div>WAIT...</div>
            <div className="text-sm mt-2 opacity-70">(Press SPACE or Click)</div>
          </div>
        </div>
      );
    }

    if (gameState === 'green') {
      return (
        <div 
          onClick={handleClick}
          className="w-full h-64 bg-green-600 rounded-lg flex items-center justify-center text-white text-2xl cursor-pointer animate-pulse transition-all duration-300"
        >
          <div className="text-center">
            <div>CLICK NOW!</div>
            <div className="text-sm mt-2 opacity-70">(Press SPACE or Click)</div>
          </div>
        </div>
      );
    }

    if (gameState === 'finished') {
      return (
        <div className="text-center">
          <h2 className="text-2xl mb-4">
            {result === 'win' ? '🎉 You Win! 🎉' : '😔 You Lose!'}
          </h2>
          {reactionTime && result === 'win' && (
            <p className="mb-4 text-xl">Your reaction time: <span className="font-bold">{reactionTime}ms</span></p>
          )}
          <button
            onClick={handleRematch}
            className="mt-4 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition-colors"
          >
            Rematch
          </button>
        </div>
      );
    }

    return null;
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4 bg-gray-100">
      <style jsx global>{`
        @keyframes countdown {
          0% {
            transform: scale(0.3);
            opacity: 0;
          }
          20% {
            transform: scale(1.2);
            opacity: 1;
          }
          80% {
            transform: scale(1);
            opacity: 1;
          }
          100% {
            transform: scale(0.3);
            opacity: 0;
          }
        }
        
        .countdown-animation {
          display: flex;
          justify-content: center;
          align-items: center;
          height: 200px;
        }
        
        .countdown-number {
          font-size: 8rem;
          font-weight: bold;
          color: #3B82F6;
        }
        
        .animate-countdown {
          animation: countdown 1s ease-in-out;
        }
      `}</style>
      
      <h1 className="text-4xl font-bold mb-8">Fast Reflex</h1>
      <div className="w-full max-w-md space-y-6">
        <div className={`mb-4 px-4 py-2 rounded text-center ${
          connectionStatus === 'connected' ? 'bg-green-100 text-green-700' :
          connectionStatus === 'error' ? 'bg-red-100 text-red-700' :
          'bg-yellow-100 text-yellow-700'
        }`}>
          Status: {connectionStatus}
        </div>
        
        {getGameContent()}
        
        <button
          onClick={() => router.push('/')}
          className="mt-8 w-full bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600 transition-colors"
        >
          Return to Lobby
        </button>
      </div>
    </main>
  );
} 