const { Kafka } = require('kafkajs');
const { Pool } = require('pg');

// 1. Configuração da Conexão com o PostgreSQL via variáveis de ambiente
const pool = new Pool({
  user: process.env.DB_USER || 'admin',
  host: process.env.DB_HOST || 'postgres-db',
  database: process.env.DB_DATABASE || 'events_db',
  password: process.env.DB_PASSWORD || 'admin_password',
  port: process.env.DB_PORT || 5432,
});

// 2. Configuração do Kafka (os brokers já são nomes de serviço, o que está perfeito)
const kafka = new Kafka({
  clientId: 'db-inserter',
  brokers: ['broker-1:19092', 'broker-2:19092', 'broker-3:19092'],
});

const consumer = kafka.consumer({ groupId: 'database-consumers' });
const topic = 'game-events';


const run = async () => {
  try {
    await pool.connect();
    console.log('Conectado ao banco de dados PostgreSQL.');

    await consumer.connect();
    console.log('Consumidor (Postgres) conectado ao Kafka.');

    await consumer.subscribe({ topic, fromBeginning: true });
    console.log(`Inscrito no tópico "${topic}". Aguardando mensagens para salvar no DB...`);

    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        const eventData = JSON.parse(message.value.toString());

        console.log(`[DB] Mensagem recebida para o jogo: ${eventData.game}`);

        // 3. Lógica para Inserir no Banco de Dados
        const query = `
          INSERT INTO events_kafka (game, eventType, event)
          VALUES ($1, $2, $3)
        `;
        const values = [
          eventData.game,
          eventData.eventType,
          eventData.event, // O campo event contém o objeto de detalhes
        ];

        try {
          await pool.query(query, values);
          console.log(`[DB] Evento do jogo "${eventData.game}" inserido com sucesso!`);
        } catch (dbError) {
          console.error('[DB] Erro ao inserir mensagem no banco de dados:', dbError);
        }
      },
    });
  } catch (error) {
    console.error('Erro no consumidor (Postgres):', error);
    await consumer.disconnect().catch(console.error);
    await pool.end().catch(console.error); // Fecha a conexão com o DB
    process.exit(1);
  }
};

run().catch(error => {
    console.error("Falha ao iniciar o consumidor (Postgres):", error);
    process.exit(1);
});

// Lógica de encerramento gracioso
const shutdown = async () => {
  console.log('Desconectando...');
  await consumer.disconnect();
  await pool.end();
  console.log('Desconectado.');
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  shutdown().finally(() => process.exit(1));
});