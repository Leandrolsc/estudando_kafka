# Solução: Lendo Arquivos JSON para o Postgres via Kafka Connect

Olá! Esta é a explicação de como usar o **Kafka Connect** para mover seus arquivos **JSON** da pasta `./archives` para a tabela `event_kafka_archives` no **PostgreSQL**.

---

## Arquitetura Proposta

Vamos usar o **Kafka Connect** para gerenciar todo o fluxo, sem precisar de um serviço customizado.  
O fluxo será:

1. **Pasta `./archives`**  
   Seus arquivos JSON são colocados aqui.

2. **File Source Connector**  
   Um conector (ex: `kafka-connect-spooldir`) vai monitorar essa pasta.  
   Ao encontrar um novo arquivo JSON, ele o lerá e publicará cada linha/objeto como uma mensagem em um tópico Kafka (ex: `archive_events_topic`).

3. **Tópico Kafka**  
   O tópico `archive_events_topic` (ou o nome que escolher) servirá como um buffer intermediário.

4. **JDBC Sink Connector**  
   Este conector vai "ouvir" o tópico `archive_events_topic`.  
   Para cada mensagem que chegar, ele a formatará como um **INSERT** e executará no banco **PostgreSQL**, na tabela `event_kafka_archives`.

---

## Passo 1: Preparar a Imagem do Kafka Connect (Dockerfile)

Seu contêiner **Kafka Connect** precisa ter os **plugins** (conectores) corretos instalados.  
O **Debezium** é um desses plugins, mas precisamos adicionar mais dois:

- **jcustenborder/kafka-connect-spooldir**  
  Excelente conector para ler arquivos de um diretório.

- **confluentinc/kafka-connect-jdbc**  
  Conector padrão para enviar (sink) dados a qualquer banco JDBC, como o Postgres.

O arquivo `connect.dockerfile` usa a imagem base do **Debezium/Connect** e adiciona os dois conectores via **confluent-hub**.

---

## Passo 2: Atualizar o Docker Compose

No seu `docker-compose.yml` principal, substitua a linha `image:` por `build: .` (ou o caminho para onde salvou o `connect.dockerfile`).  
O exemplo de `docker-compose.yml` mostrará como fazer isso.

**Importante:**

- Mapeie a pasta local `./archives` para dentro do contêiner do Kafka Connect (ex: `/data/archives`).  
- O conector `spooldir` precisa de mais duas pastas:
  - `/data/finished`: para mover arquivos processados com sucesso.
  - `/data/error`: para arquivos com erro.

---

## Passo 3: Criar a Tabela no PostgreSQL

Antes de iniciar os conectores, garanta que a tabela de destino exista no banco.  
Use o script `setup_table.sql` para criá-la.

---

##  Passo 4: Subir os Contêineres e Registrar os Conectores

1. Inicie seus serviços:

```bash
   docker-compose up -d
```

## Como Funciona Agora?

É isso! A partir deste ponto, qualquer arquivo JSON colocado em ./archives será:

1. Detectado pelo spool-dir-source-connector
2. Publicado no tópico archive_events_topic
3. Captado pelo postgres-sink-connector
4. Inserido na tabela event_kafka_archives

Após o processamento:

* O arquivo original será movido de ``./archives`` → ``./archives/finished``,
* Ou, em caso de erro, para ``./archives/error.``

Assim, evita-se o reprocessamento do mesmo arquivo.

## Resumo do Fluxo

```
./archives ──▶ spooldir connector ──▶ Kafka topic (archive_events_topic)
      │                                         │
      ▼                                         ▼
./finished (ok)                        JDBC sink connector ──▶ PostgreSQL (event_kafka_archives)
./error (fail)
```

