const { Kafka } = require('kafkajs');
const fs = require('fs').promises; // Usando a versão de Promises do File System
const path = require('path');

// 1. Configuração do Kafka (com outro NOVO groupId)
const kafka = new Kafka({
  clientId: 'json-archiver',
  brokers: ['broker-1:19092', 'broker-2:29092', 'broker-3:39092'],
});

// IMPORTANTE: Outro groupId diferente para garantir o recebimento das mensagens
const consumer = kafka.consumer({ groupId: 'archive-consumers' });
const topic = 'game-events';
const archiveDir = path.join(__dirname, '..', 'archives'); // Aponta para a pasta ./archives/ no nível raiz

const run = async () => {
  try {
    // 2. Garante que o diretório de arquivos exista
    await fs.mkdir(archiveDir, { recursive: true });
    console.log(`Diretório de arquivos pronto em: ${archiveDir}`);

    await consumer.connect();
    console.log('Consumidor (Archive) conectado ao Kafka.');

    await consumer.subscribe({ topic, fromBeginning: true });
    console.log(`Inscrito no tópico "${topic}". Aguardando mensagens para arquivar...`);

    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        const eventData = JSON.parse(message.value.toString());

        console.log(`[Archive] Mensagem recebida para o jogo: ${eventData.game}`);
        
        // 3. Lógica para Salvar em Arquivo
        const timestamp = new Date(eventData.timestamp).getTime();
        const fileName = `${timestamp}-${eventData.eventType}-${partition}-${message.offset}.json`;
        const filePath = path.join(archiveDir, fileName);
        const fileContent = JSON.stringify(eventData, null, 2); // Formata o JSON para leitura

        try {
          await fs.writeFile(filePath, fileContent);
          console.log(`[Archive] Evento salvo com sucesso em: ${fileName}`);
        } catch (fileError) {
          console.error('[Archive] Erro ao salvar arquivo:', fileError);
        }
      },
    });
  } catch (error) {
    console.error('Erro no consumidor (Archive):', error);
    await consumer.disconnect().catch(console.error);
    process.exit(1);
  }
};

run().catch(error => {
    console.error("Falha ao iniciar o consumidor (Archive):", error);
    process.exit(1);
});

// Lógica de encerramento gracioso
const shutdown = async () => {
  console.log('Desconectando...');
  await consumer.disconnect();
  console.log('Desconectado.');
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  shutdown().finally(() => process.exit(1));
});