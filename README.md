# Fast Reflex Game

A multiplayer reaction game built with Next.js, React, and Socket.io.

## Features

- Real-time multiplayer gameplay
- Test your reflexes in a 1v1 match
- Compete with your friends to see who has the faster reflexes
- Lobby system for game creation and joining
- Spacebar support for reaction testing
- Responsive design with TailwindCSS

## How to Play

1. Create a new game or join an existing one with a lobby code
2. Wait for both players to be ready
3. When the light turns green, click as fast as you can!
4. See your reaction time and who won
5. Play again with the rematch button

## Local Development

### Prerequisites

- Node.js 16.0.0 or higher
- npm or yarn

### Setup

1. Clone the repository
```bash
git clone https://github.com/miro187/FastReflexGame.git
cd FastReflexGame
```

2. Install dependencies
```bash
npm install
```

3. Start the server
```bash
npm run server
```

4. In a separate terminal, start the Next.js app
```bash
npm run dev
```

5. Open your browser at http://localhost:3000

## Deployment on Render

This application is configured for easy deployment on Render.com:

1. Create a new Web Service on Render
2. Connect your GitHub repository
3. Use the following settings:
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm run start:prod`
   - **Environment Variables**: Set `NODE_ENV=production`

Alternatively, you can use the included `render.yaml` file to deploy with Blueprint:

1. Push your code to GitHub
2. Create a new Blueprint on Render
3. Connect your repository
4. The `render.yaml` file will automatically configure your service

## Technologies Used

- [Next.js](https://nextjs.org/) - React framework for the frontend
- [Socket.io](https://socket.io/) - Real-time communication
- [TailwindCSS](https://tailwindcss.com/) - Styling
- [TypeScript](https://www.typescriptlang.org/) - Type safety
- [Express](https://expressjs.com/) - Server framework

## License

MIT 