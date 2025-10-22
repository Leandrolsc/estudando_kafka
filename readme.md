# Estudo de Apache Kafka com Jogo Snake
Este projeto demonstra a implementação prática do Apache Kafka usando um jogo Snake como exemplo. O sistema é composto por múltiplos serviços que se comunicam através do Kafka.

## Arquitetura do Projeto
O projeto é composto por:

1. Cluster Kafka: 3 controllers e 3 brokers para alta disponibilidade
2. Producer Service: Serviço Node.js que envia eventos do jogo para o Kafka
3. Consumer Service: Serviço Node.js que consome e registra eventos do jogo
4. React Snake Game: Interface web do jogo da cobra

Componentes do Kafka
O cluster Kafka é configurado com:

* 3 Controllers (controller-1, controller-2, controller-3) para gerenciamento do cluster
* 3 Brokers (broker-1, broker-2, broker-3) para armazenamento e distribuição de mensagens
* Portas expostas: 29092, 39092, 49092


## Como Funciona

1. Jogo Snake (app_snake/src/App.jsx)
* Interface React do jogo da cobra
* Envia eventos de movimento e fim de jogo para o Producer

2. Producer Service (producer-service/producer.js)
* Recebe eventos do jogo via API REST
* Publica mensagens no tópico 'game-events' do Kafka

3. Consumer Service (consumer-service/consumer.js)
* Subscreve ao tópico 'game-events'
* Processa e exibe os eventos recebidos


## Como Executar

1. Iniciar o cluster Kafka e todos os serviços:

```bash
docker-compose up -d
```

2. Acessar o jogo:
* Abra http://localhost:8080 no navegador

3. Monitorar eventos:
* Os eventos serão exibidos no console do consumer-service


Estrutura de Mensagens
O sistema utiliza o seguinte formato de mensagens:

```js
{
  "game": "snake",
  "eventType": "move/GameOver",
  "finalScore": "number",
  "timestamp": "ISO date"
}
```

## Arquitetura Kafka
O projeto utiliza:

* Tópico: game-events
* Partições: 1
* Fator de Replicação: 1
* Grupo de Consumidores: snake-game-consumers

## Tecnologias Utilizadas
* Apache Kafka
* Node.js
* React
* Docker
* Express
* KafkaJS
* Tailwind CSS

Este projeto serve como exemplo prático de como implementar um sistema distribuído usando Apache Kafka, demonstrando padrões de mensageria em tempo real.