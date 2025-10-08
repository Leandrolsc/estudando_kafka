const { Kafka } = require('kafkajs');

// Configuração para conectar ao cluster Kafka
const kafka = new Kafka({
  clientId: 'snake-game-consumer',
  brokers: ['broker-1:19092', 'broker-2:29092', 'broker-3:39092'],
});

const consumer = kafka.consumer({ groupId: 'snake-game-consumers' });
const topic = 'game-events';

const run = async () => {
  try {
    await consumer.connect();
    console.log('Consumidor conectado ao Kafka.');

    await consumer.subscribe({ topic, fromBeginning: true });
    console.log(`Inscrito no tópico "${topic}". Aguardando mensagens...`);

    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        // Parse da mensagem que está em formato JSON string
        const eventData = JSON.parse(message.value.toString());

        console.log('=========================================');
        console.log('==> NOVA MENSAGEM RECEBIDA <==');
        console.log(`| Tópico: ${topic}`);
        console.log(`| Partição: ${partition}`);
        console.log('| Dados do Evento:');
        console.log(`|   - Jogo: ${eventData.game}`);
        console.log(`|   - Evento: ${eventData.eventType}`);
        console.log(`|   - Pontuação Final: ${eventData.finalScore}`);
        console.log(`|   - Timestamp: ${eventData.timestamp}`);
        console.log('=========================================\n');
      },
    });
  } catch (error) {
    console.error('Erro no consumidor Kafka:', error);
    // Em caso de erro, tenta desconectar de forma limpa
    await consumer.disconnect().catch(console.error);
    process.exit(1);
  }
};

run().catch(error => {
    console.error("Falha ao iniciar o consumidor:", error);
    process.exit(1);
});

// Captura sinais de encerramento para desconectar o consumidor
const errorTypes = ['unhandledRejection', 'uncaughtException'];
const signalTraps = ['SIGTERM', 'SIGINT', 'SIGUSR2'];

errorTypes.forEach(type => {
  process.on(type, async e => {
    try {
      console.log(`process.on ${type}`);
      console.error(e);
      await consumer.disconnect();
      process.exit(0);
    } catch (_) {
      process.exit(1);
    }
  });
});

signalTraps.forEach(type => {
  process.once(type, async () => {
    try {
      await consumer.disconnect();
    } finally {
      process.kill(process.pid, type);
    }
  });
});
