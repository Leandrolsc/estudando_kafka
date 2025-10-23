# Integração de Dados entre Bancos Relacionais com Apache Kafka (Modo KRaft)

## 1. Introdução

A integração entre bancos de dados relacionais é uma das aplicações mais comuns do **Apache Kafka**.  
O Kafka atua como uma camada intermediária de *streaming* que transporta e transforma dados em tempo real entre sistemas heterogêneos.

Neste documento, será descrito o fluxo de dados entre dois bancos relacionais utilizando o **Kafka em modo KRaft (Kafka Raft Metadata Mode)**, substituindo a dependência do Zookeeper e simplificando a arquitetura de implantação.

---

## 2. Cenário Proposto

### 2.1. Objetivo
Transportar dados de um **banco relacional de origem (ex: SQL Server)** para um **banco relacional de destino (ex: PostgreSQL)** de forma **assíncrona**, **segura** e **escalável**, utilizando o Kafka como *middleware* de mensagens.

### 2.2. Arquitetura Geral

```bash
+------------------+       +----------------------+       +-------------------+
|  Banco Origem    |       |  Apache Kafka (KRaft)|       |  Banco Destino    |
|  (SQL Server)    | --->  |  - Connect Source    | --->  |  (PostgreSQL)     |
|                  |       |  - Topic             |       |                   |
+------------------+       |  - Connect Sink      |       +-------------------+
                           +----------------------+
```

---

## 3. Componentes Envolvidos

### 3.1. Kafka em modo KRaft
O **modo KRaft (Kafka Raft Metadata Mode)** é a arquitetura moderna do Kafka que **elimina o Zookeeper**.  
O cluster Kafka passa a ser autogerenciado, utilizando o protocolo **Raft** para garantir consenso entre os controladores e replicação consistente dos metadados.

#### Principais vantagens do KRaft neste contexto:
- Simplificação operacional (não há necessidade de manter um cluster de Zookeeper);
- Maior resiliência e recuperação mais rápida em caso de falhas;
- Melhor desempenho e escalabilidade;
- Menor latência na replicação de metadados e tópicos.

---

## 4. Fluxo de Dados

### 4.1. Etapa 1 – Captura dos Dados
Utiliza-se o **Kafka Connect Source Connector** para extrair dados do banco de origem.  
Um conector popular para este propósito é o **Debezium**, que realiza a captura de alterações (CDC – *Change Data Capture*).

- **Conector Fonte (Source Connector):**
  - Tipo: *Debezium SQL Server Source Connector*  
  - Função: Captura inserções, atualizações e exclusões em tabelas do SQL Server e as publica em **tópicos Kafka**.

Exemplo de configuração simplificada (arquivo JSON):

```json
{
  "name": "sqlserver-source-connector",
  "config": {
    "connector.class": "io.debezium.connector.sqlserver.SqlServerConnector",
    "database.hostname": "sqlserver_host",
    "database.port": "1433",
    "database.user": "cdc_user",
    "database.password": "cdc_password",
    "database.dbname": "DB_Origem",
    "table.include.list": "dbo.Clientes,dbo.Vendas",
    "database.server.name": "sqlserver01",
    "snapshot.mode": "initial",
    "topic.prefix": "sqlserver_",
    "database.history.kafka.bootstrap.servers": "kafka1:9092",
    "database.history.kafka.topic": "schema-changes.sqlserver"
  }
}
```

### 4.2. Etapa 2 – Transporte via Kafka

Os dados extraídos são publicados em tópicos no cluster Kafka.

* Cada tabela do banco de origem gera um tópico distinto (ex: ``sqlserver_dbo.Clientes``, ``sqlserver_dbo.Vendas``);
* As mensagens contêm os eventos de alteração (inserção, atualização, exclusão);
* O Kafka armazena essas mensagens de forma ordenada e replicada.

Exemplo:
```bash
Topic: sqlserver_dbo.Clientes
Partition: 0
Message:
{
  "op": "u",
  "before": {"id": 10, "nome": "João", "idade": 30},
  "after": {"id": 10, "nome": "João", "idade": 31},
  "ts_ms": 1694802000000
}
```

### 4.3. Etapa 3 – Consumo e Escrita no Banco de Destino

Utiliza-se o **Kafka Connect Sink Connector** para consumir os tópicos e inserir os dados no banco de destino.

* **Conector Destino (Sink Connector):**

    * Tipo: JDBC Sink Connector

    * Função: Lê os eventos dos tópicos e aplica as mudanças correspondentes no banco de destino.

Exemplo de configuração:

```json
{
  "name": "postgres-sink-connector",
  "config": {
    "connector.class": "io.confluent.connect.jdbc.JdbcSinkConnector",
    "connection.url": "jdbc:postgresql://postgres_host:5432/DB_Destino",
    "connection.user": "postgres",
    "connection.password": "senha_segura",
    "topics": "sqlserver_dbo.Clientes,sqlserver_dbo.Vendas",
    "auto.create": "true",
    "auto.evolve": "true",
    "insert.mode": "upsert",
    "pk.mode": "record_key",
    "pk.fields": "id"
  }
}

```

---


## 5. Arquitetura Lógica com KRaft


```pgsql
                          ┌──────────────────────────┐
                          │   Kafka Cluster (KRaft)  │
                          │  ──────────────────────  │
                          │  • Controller Quorum     │
                          │  • Brokers               │
                          │  • Topics / Partições    │
                          └───────────┬──────────────┘
                                      │
             ┌──────────────────────┐ │ ┌─────────────────────────┐
             │  Source Connector     │ │ │     Sink Connector      │
             │ (Debezium SQLServer)  │ │ │ (JDBC PostgreSQL Sink)  │
             └──────────┬───────────┘ │ └─────────────┬───────────┘
                        │             │               │
                 ┌───────▼──────┐     │     ┌────────▼────────┐
                 │ Banco Origem │─────▶│     │ Banco Destino  │
                 │  SQL Server  │       │     │  PostgreSQL    │
                 └──────────────┘       │     └────────────────┘

```

---

## 6. Vantagens
| Categoria   | Descrição |
|------------|------------|
| Escalabilidade |	Kafka permite processar grandes volumes de dados sem degradação de desempenho. |
| Baixa latência |	Alterações no banco de origem são propagadas quase em tempo real. |
| Resiliência |	Mensagens são replicadas entre brokers, evitando perda de dados. |
| Desacoplamento | O banco de origem e o destino ficam independentes, permitindo substituições sem impacto direto. |
| Modo KRaft Simplificado	| Elimina a necessidade do Zookeeper, reduzindo a complexidade e o custo operacional. |
| Tolerância a falhas	| O protocolo Raft garante consenso e rápida recuperação em caso de falha de controladores. |
| Flexibilidade	| Fácil integração com múltiplos destinos (PostgreSQL, Snowflake, Redshift, etc.). |


## 7. Desvantagens
| Categoria   |   Descrição |
|------------|------------|
| Complexidade inicial    |   Exige conhecimento de Kafka, Connectors e configuração de tópicos. |
| Gerenciamento de esquema    |	Mudanças nas tabelas (DDL) precisam ser refletidas no destino. |
| Custo de infraestrutura |	Clusters Kafka exigem recursos computacionais adequados. |
| Monitoramento e tuning  |	Necessário configurar métricas e alertas para evitar atrasos ou gargalos. |
| Dependência de conectores   |	A qualidade e desempenho dependem dos conectores utilizados (Debezium, JDBC, etc.). |

## 8. Conclusão

O uso do **Apache Kafka em modo KRaft** como camada intermediária entre bancos relacionais oferece uma solução **eficiente, resiliente e moderna** para transporte e sincronização de dados em tempo real.
Apesar da curva de aprendizado inicial, o ganho em **desacoplamento, desempenho e confiabilidade** justifica amplamente sua adoção em ambientes corporativos.