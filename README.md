# Fast Reflex - Multiplayer Reaction Game

A real-time multiplayer browser game where players compete in a test of reflexes. Two players join a game lobby, and when the green signal appears, the first player to click wins!

## Features

- Real-time multiplayer gameplay using Socket.io
- Lobby system with unique game codes
- Countdown timer before each round
- Random delay between red and green signals
- Instant feedback on wins and losses
- Rematch functionality
- Responsive design with TailwindCSS

## Prerequisites

- Node.js (v14 or higher)
- npm (v6 or higher)

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd fast-reflex
```

2. Install dependencies:
```bash
npm install
```

## Running the Game

1. Start the backend server:
```bash
npm run server
```

2. In a new terminal, start the Next.js development server:
```bash
npm run dev
```

3. Open your browser and navigate to `http://localhost:3000`

## How to Play

1. The first player creates a new game lobby
2. Share the generated lobby code with the second player
3. The second player enters the code and joins the game
4. When both players are ready, the game starts automatically
5. Wait for the countdown to finish
6. A red signal will appear - DO NOT CLICK
7. When the signal turns green, click as fast as you can!
8. The first player to click wins the round
9. Choose to rematch or leave the game

## Game Rules

- Clicking during the red signal results in an immediate loss
- The first player to click when the signal turns green wins
- Players can request a rematch after each round
- Leaving the game will end the session for both players

## Technologies Used

- Next.js
- React
- Socket.io
- Express.js
- TailwindCSS
- TypeScript

## License

MIT 