import React, { useState, useEffect, useRef, useCallback } from 'react';

// Constantes do Jogo
const BOARD_SIZE = 20;
const INITIAL_SNAKE_POSITION = [{ x: 10, y: 10 }];
const INITIAL_FOOD_POSITION = { x: 15, y: 15 };
const INITIAL_DIRECTION = { x: 0, y: -1 }; // Começa movendo para cima
const GAME_SPEED = 150; // ms

const sendEvent = async (event, type) => {
  // O backend estará acessível em http://localhost:3001
  const producerUrl = 'http://localhost:3001/game_event';
  console.log(`Enviando tipo de evento ${type} o valor "${event}" para ${producerUrl}`);

  try {
    const response = await fetch(producerUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        eventType: type,
        event: event,
      }),
    });

    if (!response.ok) {
      throw new Error(`Erro na API: ${response.statusText}`);
    }

    const result = await response.json();
    console.log('Resposta do serviço produtor:', result.message);
  } catch (error) {
    console.error('Falha ao enviar evento de jogo para o backend:', error);
  }
};

// Componente principal do Jogo da Cobrinha
const SnakeGame = () => {
  // Estados do jogo
  const [snake, setSnake] = useState(INITIAL_SNAKE_POSITION);
  const [food, setFood] = useState(INITIAL_FOOD_POSITION);
  const [direction, setDirection] = useState(INITIAL_DIRECTION);
  const [speed, setSpeed] = useState(GAME_SPEED);
  const [gameOver, setGameOver] = useState(false);
  const [score, setScore] = useState(0);

  // Usamos useRef para guardar a direção e evitar problemas de closure no loop do jogo
  const directionRef = useRef(direction);

  useEffect(() => {
    directionRef.current = direction;
  }, [direction]);

  // Função para gerar uma nova posição para a comida
  const generateFood = () => {
    while (true) {
      const newFood = {
        x: Math.floor(Math.random() * BOARD_SIZE),
        y: Math.floor(Math.random() * BOARD_SIZE),
      };
      // Garante que a comida não apareça em cima da cobra
      if (!snake.some(segment => segment.x === newFood.x && segment.y === newFood.y)) {
        return newFood;
      }
    }
  };

  // Função para reiniciar o jogo
  const startGame = () => {
    setSnake(INITIAL_SNAKE_POSITION);
    setFood(INITIAL_FOOD_POSITION);
    setDirection(INITIAL_DIRECTION);
    setSpeed(GAME_SPEED);
    setGameOver(false);
    setScore(0);
    sendEvent('Game Started', 'GameStart');
  };

  // Função para verificar colisões
  const checkCollision = (head) => {
    // Colisão com as paredes
    if (head.x < 0 || head.x >= BOARD_SIZE || head.y < 0 || head.y >= BOARD_SIZE) {
      return true;
    }
    // Colisão com o próprio corpo
    for (const segment of snake.slice(1)) {
      if (head.x === segment.x && head.y === segment.y) {
        return true;
      }
    }
    return false;
  };

  // Lógica principal do jogo, que roda a cada "tick"
  const gameLoop = useCallback(() => {
    if (gameOver) return;

    setSnake(prevSnake => {
      const newSnake = [...prevSnake];
      const head = { ...newSnake[0] };
      head.x += directionRef.current.x;
      head.y += directionRef.current.y;

      // Verifica colisões
      if (checkCollision(head)) {
        setGameOver(true);
        return prevSnake;
      }

      newSnake.unshift(head);

      // Verifica se comeu a comida
      if (head.x === food.x && head.y === food.y) {
        setScore(s => s + 1);
        setFood(generateFood());
        sendEvent(score + 1, 'ScoreUpdate');
      } else {
        newSnake.pop();
      }

      return newSnake;
    });
  }, [food.x, food.y, gameOver, snake]);

  // Efeito para controlar o loop do jogo com setInterval
  useEffect(() => {
    if (gameOver) {
      sendEvent(score, 'GameOver');
      return; 
    }
    const gameInterval = setInterval(gameLoop, speed);
    return () => clearInterval(gameInterval);
  }, [gameOver, speed, gameLoop, score]);


  // Efeito para controlar as entradas do teclado
  useEffect(() => {
    const handleKeyDown = (e) => {
      e.preventDefault();
      const { x, y } = directionRef.current;
      sendEvent(e.key,'Move');
      switch (e.key) {
        case 'ArrowUp':
          if (y === 0) setDirection({ x: 0, y: -1 });
          break;
        case 'ArrowDown':
          if (y === 0) setDirection({ x: 0, y: 1 });
          break;
        case 'ArrowLeft':
          if (x === 0) setDirection({ x: -1, y: 0 });
          break;
        case 'ArrowRight':
          if (x === 0) setDirection({ x: 1, y: 0 });
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Renderização do tabuleiro
  const renderBoard = () => {
    const cells = [];
    for (let y = 0; y < BOARD_SIZE; y++) {
      for (let x = 0; x < BOARD_SIZE; x++) {
        const isSnake = snake.some(segment => segment.x === x && segment.y === y);
        const isFood = food.x === x && food.y === y;
        const isHead = snake[0].x === x && snake[0].y === y;

        cells.push(
          <div
            key={`${x}-${y}`}
            className={`
              w-full h-full
              ${isHead ? 'bg-green-600 rounded-md' : isSnake ? 'bg-green-400' : ''}
              ${isFood ? 'bg-red-500 rounded-full' : ''}
              ${(x + y) % 2 === 0 ? 'bg-gray-800' : 'bg-gray-700'}
            `}
          ></div>
        );
      }
    }
    return cells;
  };

  return (
    <div className="bg-gray-900 min-h-screen flex flex-col items-center justify-center font-mono text-white p-4">
      <h1 className="text-4xl font-bold mb-2 text-green-400">React Snake</h1>
      <div className="text-lg mb-4">Pontuação: <span className="font-bold text-yellow-400">{score}</span></div>

      <div className="relative border-4 border-green-500 shadow-lg shadow-green-500/20">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${BOARD_SIZE}, 1fr)`,
            gridTemplateRows: `repeat(${BOARD_SIZE}, 1fr)`,
            width: '500px',
            height: '500px'
          }}
          className="bg-gray-800"
        >
          {renderBoard()}
        </div>
        {gameOver && (
          <div className="absolute inset-0 bg-black bg-opacity-70 flex flex-col items-center justify-center">
            <h2 className="text-3xl font-bold text-red-500">Fim de Jogo!</h2>
            <p className="text-xl mt-2">Sua pontuação final: {score}</p>
            <button
              onClick={startGame}
              className="mt-6 px-6 py-3 bg-green-500 text-gray-900 font-bold rounded-lg hover:bg-green-400 focus:outline-none focus:ring-2 focus:ring-green-300 transition-all duration-200"
            >
              Jogar Novamente
            </button>
          </div>
        )}
      </div>
      <div className="mt-6 text-center text-gray-400">
        <p>Use as <span className="font-bold text-yellow-400">Setas do Teclado</span> para mover a cobra.</p>
      </div>
    </div>
  );
};

// Componente App que exportamos
function App() {
    // Carrega o Tailwind CSS via CDN. Em um projeto real, isso seria configurado no `index.html` ou no processo de build.
    if (!document.getElementById('tailwind-cdn')) {
        const script = document.createElement('script');
        script.id = 'tailwind-cdn';
        script.src = "https://cdn.tailwindcss.com";
        document.head.appendChild(script);
    }
    return <SnakeGame />;
}


export default App;
