# Arquitetura: Kafka (modo KRaft) observando uma pasta (local ou S3) e inserindo registros (TXT, CSV ou Parquet) em um banco relacional (Postgres / MySQL)

> Documento técnico detalhado sobre a utilização do **Apache Kafka** em modo **KRaft**, configurado para monitorar arquivos de entrada em um diretório local ou bucket S3, publicando-os em tópicos Kafka e persistindo em bancos relacionais via Kafka Connect.

---

## Sumário
1. [Visão geral da solução](#1-visão-geral-da-solução)  
2. [Componentes e responsabilidades](#2-componentes-e-responsabilidades)  
3. [Fluxo de dados (end-to-end)](#3-fluxo-de-dados-end-to-end)  
4. [Requisitos e pré-condições](#4-requisitos-e-pré-condições)  
5. [Passo-a-passo de implantação](#5-passo-a-passo-de-implantação)  
6. [Exemplos de configurações](#6-exemplos-de-configuração)  
7. [Boas práticas, performance e confiabilidade](#7-boas-práticas-performance-e-confiabilidade)  
8. [Vantagens e desvantagens](#8-vantagens-e-desvantagens)  
9. [Conclusão](#9-conclusão)  
10. [Autoavaliação (2 sugestões e 1 crítica)](#10-autoavaliação-2-sugestões-e-1-crítica)

---

## 1. Visão geral da solução

A solução proposta utiliza o Kafka em **modo KRaft** (sem ZooKeeper), onde os arquivos são detectados e processados assim que aparecem em uma pasta local ou bucket S3.  
Cada registro do arquivo é transformado em uma mensagem Kafka e posteriormente gravado em um banco relacional via **Kafka Connect JDBC Sink**.

**Fluxo resumido:**

```bash
[Diretório Local / S3]
↓
[Kafka Connect Source Connector]
↓
[Tópico Kafka (KRaft)]
↓
[JDBC Sink Connector]
↓
[Postgres / MySQL]
```


---

## 2. Componentes e responsabilidades

| Componente | Responsabilidade |
|-------------|------------------|
| **Kafka (KRaft)** | Gerencia tópicos e mensagens sem uso do ZooKeeper. |
| **Kafka Connect** | Executa conectores source e sink de forma escalável. |
| **Source Connectors** | Leem arquivos de diretório local (FilePulse) ou bucket S3 (S3 Source). |
| **Sink Connector (JDBC)** | Insere registros em bancos relacionais (Postgres/MySQL). |
| **Schema Registry (opcional)** | Gerencia esquemas para mensagens Avro/Protobuf. |
| **Monitoramento** | Observa métricas e falhas dos conectores. |

---

## 3. Fluxo de dados (end-to-end)

1. Arquivos (TXT, CSV ou Parquet) são adicionados à pasta local ou bucket S3.  
2. O conector **source** detecta novos arquivos.  
3. Cada linha/registro do arquivo é transformada em uma mensagem Kafka.  
4. O Kafka armazena a mensagem em um tópico configurado.  
5. O **JDBC Sink Connector** consome mensagens do tópico e insere no banco.  
6. Os offsets garantem que cada arquivo seja processado apenas uma vez.

---

## 4. Requisitos e pré-condições

- Kafka e Kafka Connect instalados (modo **KRaft** ativo).  
- Permissões de leitura/escrita para a pasta local ou S3.  
- Acesso de rede ao banco (Postgres/MySQL).  
- Definição de tópicos internos (`offset.storage.topic`, `config.storage.topic`).  
- Schema Registry opcional para controle de esquema.  
- Monitoramento de logs e métricas (Prometheus, Grafana, etc).

---

## 5. Passo-a-passo de implantação

### 5.1. Preparar o Kafka em modo KRaft

```properties
# server.properties
process.roles=broker,controller
controller.quorum.voters=1@localhost:9093
listeners=PLAINTEXT://:9092,CONTROLLER://:9093
log.dirs=/var/lib/kafka/data
num.partitions=3
default.replication.factor=1
```

* Inicialize o storage:

```bash
kafka-storage format --config /path/to/server.properties --cluster-id $(kafka-storage random-uuid)
```

* Inicie o broker Kafka.

### 5.2. Configurar o Kafka Connect (modo distribuído)

```properties
bootstrap.servers=localhost:9092
group.id=connect-cluster
offset.storage.topic=connect-offsets
config.storage.topic=connect-configs
status.storage.topic=connect-status
plugin.path=/usr/share/java,/opt/connectors
```

Execute o Kafka Connect:

```bash
connect-distributed.sh /path/to/connect-distributed.properties
```

### 5.3. Conector source (pasta local - FilePulse)

```json
{
  "name": "filepulse-source-local",
  "config": {
    "connector.class": "io.streamthoughts.kafka.connect.filepulse.source.FilePulseSourceConnector",
    "tasks.max": "1",
    "fs.scan.directory.path": "/data/incoming",
    "fs.scan.interval.ms": "10000",
    "topic": "files.ingest",
    "file.filter.regex": ".*\\.(csv|txt|parquet)$",
    "task.reader.class": "io.streamthoughts.kafka.connect.filepulse.reader.RowFileInputReader",
    "task.reader.csv.columns": "id,name,amount,date",
    "errors.tolerance": "all",
    "errors.deadletterqueue.topic.name": "dlq.files.ingest"
  }
}
```

### 5.4. Conector source (S3)

```json
{
  "name": "s3-source",
  "config": {
    "connector.class": "io.confluent.connect.s3.source.S3SourceConnector",
    "tasks.max": "2",
    "s3.bucket.name": "meu-bucket-ingest",
    "s3.region": "sa-east-1",
    "format.class": "io.confluent.connect.s3.format.json.JsonFormat",
    "kafka.topic": "files.ingest",
    "aws.access.key.id": "<CHAVE>",
    "aws.secret.access.key": "<SEGREDO>",
    "scan.interval.seconds": "60"
  }
}
```

### 5.5. Tratamento dos arquivos TXT/CSV/Parquet


| Tipo        | Estratégia                                       | Observações                                     |
| ----------- | ------------------------------------------------ | ----------------------------------------------- |
| **TXT/CSV** | Leitura linha a linha via FilePulse; parser CSV. | Define delimitador e colunas.                   |
| **Parquet** | Uso de S3 Source + processador intermediário.    | Alguns conectores não leem Parquet nativamente. |


### 5.6. Conector sink (JDBC Sink)

```json
{
  "name": "jdbc-sink-postgres",
  "config": {
    "connector.class": "io.confluent.connect.jdbc.JdbcSinkConnector",
    "tasks.max": "3",
    "topics": "files.ingest",
    "connection.url": "jdbc:postgresql://postgres:5432/meudb",
    "connection.user": "user",
    "connection.password": "senha",
    "auto.create": "true",
    "insert.mode": "upsert",
    "pk.mode": "record_value",
    "pk.fields": "id",
    "batch.size": "1000",
    "max.retries": "5"
  }
}
```

### 5.7. Testes e monitoramento

1. Adicione arquivos à pasta/S3.

2. Verifique os tópicos via:

```bash
kafka-console-consumer --bootstrap-server localhost:9092 --topic files.ingest
```

3. Confirme os registros no banco.

4. Monitore conectores (``/connectors/{name}/status``) e Dead Letter Queue.

## 6. Exemplos de configuração

| Caso             | Conector  | Tópico         |
| ---------------- | --------- | -------------- |
| Pasta local CSV  | FilePulse | `files.ingest` |
| S3 JSON          | S3 Source | `files.ingest` |
| Banco de destino | JDBC Sink | `files.ingest` |


## 7. Boas práticas, performance e confiabilidade

* Use upsert no JDBC Sink para evitar duplicações.
* Configure **batch.size** para otimizar inserções.
* Utilize **Schema Registry** (Avro/Protobuf) para controle de esquema.
* Monitore métricas (``connect-worker-metrics``, ``consumer-lag``).
* Habilite **Dead Letter Queue (DLQ)** para registros com erro.
* Para grandes volumes, aumente partições e tarefas (``tasks.max``).
* Armazene credenciais em **Vaults** (não em JSON).

## 8. Vantagens e desvantagens

### Vantagens

1. **Escalabilidade** — ingestão paralela via partições.
2. **Resiliência** — falhas no DB não interrompem a ingestão.
3. **Reprocessamento** — dados podem ser reprocessados a partir dos tópicos.
4. **Desacoplamento** — ingestão e persistência independentes.
5. **Ecosistema amplo** — integração com outras ferramentas Kafka (ksqlDB, Streams).

### Desvantagens

1. **Complexidade operacional** — manutenção de múltiplos serviços.
2. **Latência maior** — processamento intermediário adiciona delay.
3. **Parquet limitado** — poucos conectores suportam parsing nativo.
4. **Garantias transacionais** — Exactly-once não é trivial com JDBC Sink.
5. **Custo S3** — polling frequente pode aumentar custo de requisições.


## 9. Conclusão

O uso do **Kafka em modo KRaft** com **Kafka Connect** é ideal para cenários de ingestão contínua, alta disponibilidade e escalabilidade.
No entanto, em ambientes simples, um job ETL direto pode ser mais eficiente.
A escolha depende do volume de dados, necessidade de reprocessamento e tolerância a falhas.

**Recomendação:**

* FilePulse para diretórios locais.
* S3 Source Connector para buckets.
* JDBC Sink com modo ``upsert``.
* Schema Registry para controle de esquemas.
* DLQ e monitoramento ativo.