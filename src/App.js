import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import './App.css';

const socket = io('http://localhost:5000');

function App() {
  const [user, setUser] = useState(null);
  const [username, setUsername] = useState('');
  const [currentGame, setCurrentGame] = useState(null);
  const [availableGames, setAvailableGames] = useState([]);
  const [word, setWord] = useState('');
  const [timeLeft, setTimeLeft] = useState(60);
  const [message, setMessage] = useState('');

  useEffect(() => {
    socket.on('game-update', (game) => {
      setCurrentGame(game);
      setTimeLeft(60); // Reset timer on each turn
    });

    socket.on('word-result', (result) => {
      if (!result.valid) {
        setMessage(result.reason);
        setTimeout(() => setMessage(''), 3000);
      } else {
        setWord('');
      }
    });

    return () => socket.off();
  }, []);

  // Timer countdown
  useEffect(() => {
    if (currentGame && isMyTurn() && timeLeft > 0) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [currentGame, timeLeft]);

  const login = async () => {
    if (!username.trim()) return;
    
    try {
      const response = await fetch('http://localhost:5000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username })
      });
      const data = await response.json();
      setUser(data.user);
    } catch (error) {
      console.error('Login failed:', error);
    }
  };

  const createGame = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/games', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const game = await response.json();
      setCurrentGame(game);
      socket.emit('join-game', { gameId: game.gameId });
    } catch (error) {
      console.error('Create game failed:', error);
    }
  };

  const joinGame = async (gameId) => {
    try {
      const response = await fetch(`http://localhost:5000/api/games/${gameId}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: user.username })
      });
      const game = await response.json();
      setCurrentGame(game);
      socket.emit('join-game', { gameId });
    } catch (error) {
      console.error('Join game failed:', error);
    }
  };

  const fetchGames = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/games');
      const games = await response.json();
      setAvailableGames(games);
    } catch (error) {
      console.error('Fetch games failed:', error);
    }
  };

  const submitWord = () => {
    if (!word.trim() || !isMyTurn()) return;
    
    socket.emit('submit-word', {
      gameId: currentGame.gameId,
      word: word.trim()
    });
  };

  const isMyTurn = () => {
    if (!currentGame || !user) return false;
    const currentPlayer = currentGame.players[currentGame.currentPlayer];
    return currentPlayer && currentPlayer.username === user.username;
  };

  const getNextLetter = () => {
    if (!currentGame.lastWord) return 'any letter';
    return currentGame.lastWord[currentGame.lastWord.length - 1].toUpperCase();
  };

  // Login Screen
  if (!user) {
    return (
      <div className="app">
        <div className="login-container">
          <h1>🎯 Shiritori Game</h1>
          <div className="login-form">
            <input
              type="text"
              placeholder="Enter your username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && login()}
            />
            <button onClick={login}>Join Game</button>
          </div>
        </div>
      </div>
    );
  }

  // Game Lobby
  if (!currentGame) {
    return (
      <div className="app">
        <div className="lobby">
          <h1>🎯 Shiritori Game Lobby</h1>
          <p>Welcome, {user.username}!</p>
          
          <div className="lobby-actions">
            <button onClick={createGame}>Create New Game</button>
            <button onClick={fetchGames}>Refresh Games</button>
          </div>

          <div className="available-games">
            <h3>Available Games:</h3>
            {availableGames.length === 0 ? (
              <p>No games available. Create one!</p>
            ) : (
              availableGames.map(game => (
                <div key={game.gameId} className="game-item">
                  <span>Game {game.gameId} ({game.players.length}/2 players)</span>
                  <button onClick={() => joinGame(game.gameId)}>Join</button>
                </div>
              ))
            )}
          </div>

          <div className="rules">
            <h3>How to Play:</h3>
            <ul>
              <li>Take turns entering words (4+ letters)</li>
              <li>Each word must start with the last letter of the previous word</li>
              <li>No repeated words allowed</li>
              <li>60 seconds per turn</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  // Waiting for second player
  if (currentGame.players.length < 2) {
    return (
      <div className="app">
        <div className="waiting">
          <h2>⏳ Waiting for second player...</h2>
          <p>Game ID: <strong>{currentGame.gameId}</strong></p>
          <p>Share this ID with a friend!</p>
          <button onClick={() => setCurrentGame(null)}>Back to Lobby</button>
        </div>
      </div>
    );
  }

  // Main Game
  return (
    <div className="app">
      <div className="game-container">
        <div className="game-header">
          <h1>🎯 Shiritori Game</h1>
          <button onClick={() => setCurrentGame(null)}>Leave Game</button>
        </div>

        <div className="scores">
          {currentGame.players.map((player, index) => (
            <div key={index} className={`player ${player.username === user.username ? 'current' : ''}`}>
              <strong>{player.username}</strong>: {player.score} pts
              {index === currentGame.currentPlayer && <span className="turn-indicator">🎯</span>}
            </div>
          ))}
        </div>

        <div className="game-status">
          {isMyTurn() ? (
            <div className="my-turn">
              <h3>🎯 Your Turn!</h3>
              <p>Enter a word starting with: <strong>{getNextLetter()}</strong></p>
              <div className="timer">⏰ {timeLeft}s</div>
            </div>
          ) : (
            <div className="waiting-turn">
              <h3>⏳ Waiting for {currentGame.players[currentGame.currentPlayer]?.username}</h3>
              <p>Next word should start with: <strong>{getNextLetter()}</strong></p>
            </div>
          )}
        </div>

        {message && <div className="message error">{message}</div>}

        <div className="word-input">
          <input
            type="text"
            placeholder={`Enter word starting with ${getNextLetter()}`}
            value={word}
            onChange={(e) => setWord(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && submitWord()}
            disabled={!isMyTurn()}
          />
          <button onClick={submitWord} disabled={!isMyTurn() || !word.trim()}>
            Submit Word
          </button>
        </div>

        <div className="word-history">
          <h3>📝 Word History ({currentGame.wordsUsed.length})</h3>
          <div className="history-list">
            {currentGame.wordsUsed.length === 0 ? (
              <p>No words yet - start the game!</p>
            ) : (
              currentGame.wordsUsed.map((w, i) => (
                <div key={i} className="history-item">
                  {i + 1}. {w}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;