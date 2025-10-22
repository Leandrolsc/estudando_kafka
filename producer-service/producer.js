const express = require('express');
const { Kafka } = require('kafkajs');
const cors = require('cors');

const app = express();
// Habilita CORS para permitir requisições do frontend React
app.use(cors());
app.use(express.json());

// Configuração do Kafka
// Conectamos aos brokers usando os nomes dos serviços definidos no docker-compose
const kafka = new Kafka({
  clientId: 'react-snake-producer',
  brokers: ['broker-1:19092', 'broker-2:29092', 'broker-3:39092'],
});

const producer = kafka.producer();
const topic = 'game-events';

// Endpoint que o React irá chamar
app.post('/game_event', async (req, res) => {
  try {
    const { eventType, event } = req.body;

    console.log(`Recebido evento do tipo ${eventType} com o valor ${event} . Enviando para o Kafka...`);

    // Conecta o produtor, envia a mensagem e desconecta
    await producer.connect();
    await producer.send({
      topic: topic,
      messages: [
        { 
          key: `player-${Date.now()}`,
          value: JSON.stringify({ 
            game: 'snake',
            eventType: eventType,
            event: event,
            timestamp: new Date().toISOString(),
          })
        },
      ],
    });
    
    console.log('Mensagem enviada com sucesso para o tópico:', topic);
    res.status(200).json({ message: 'Evento de jogo enviado para o Kafka!' });

  } catch (error) {
    console.error('Erro ao enviar mensagem para o Kafka:', error);
    res.status(500).json({ message: 'Falha ao enviar evento.' });
  } finally {
    // Garante que o produtor sempre desconecte
    await producer.disconnect();
  }
});

const port = 3001;
app.listen(port, async () => {
    // Garante que o tópico existe ao iniciar o serviço
    const admin = kafka.admin();
    await admin.connect();
    await admin.createTopics({
        topics: [{ topic, numPartitions: 1, replicationFactor: 1 }],
        waitForLeaders: true,
    });
    await admin.disconnect();
    console.log('Tópico "game-events" garantido.');
    console.log(`Serviço produtor rodando na porta ${port}`);
});
