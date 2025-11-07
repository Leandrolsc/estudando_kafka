Solução: Lendo Arquivos JSON para o Postgres via Kafka Connect

Olá! Esta é a explicação de como usar o Kafka Connect para mover seus arquivos JSON da pasta ./archives para a tabela event_kafka_archives no PostgreSQL.

A Arquitetura Proposta

Vamos usar o Kafka Connect para gerenciar todo o fluxo, sem precisar de um serviço customizado. O fluxo será:

Pasta ./archives: Seus arquivos JSON são colocados aqui.

File Source Connector: Um conector (ex: kafka-connect-spooldir) vai monitorar essa pasta. Ao encontrar um novo arquivo JSON, ele o lerá e publicará cada linha/objeto como uma mensagem em um tópico Kafka (ex: archive_events_topic).

Tópico Kafka: archive_events_topic (ou o nome que escolher) servirá como um buffer.

JDBC Sink Connector: Este conector vai "ouvir" o tópico archive_events_topic. Para cada mensagem que chegar, ele a formatará como um INSERT e a executará no seu banco PostgreSQL, na tabela event_kafka_archives.

Passo 1: Preparar a Imagem do Kafka Connect (Dockerfile)

Seu contêiner Kafka Connect precisa ter os plugins (conectores) corretos instalados. O Debezium é um plugin. Precisamos adicionar um para ler arquivos e outro para escrever no Postgres (JDBC).

O arquivo connect.dockerfile que gerei usa a imagem base do Debezium/Connect (que você provavelmente já usa) e adiciona dois conectores usando a ferramenta confluent-hub:

jcustenborder/kafka-connect-spooldir: Um excelente conector para ler arquivos de um diretório.

confluentinc/kafka-connect-jdbc: O conector padrão para "afundar" (sink) dados em qualquer banco JDBC, como o Postgres.

Passo 2: Atualizar o Docker Compose

No seu docker-compose.yml principal, você precisa trocar a image: do seu Kafka Connect para usar build: . (ou o caminho para onde salvou o connect.dockerfile), como mostro no arquivo docker-compose.yml de exemplo.

Importante:

Mapeie a sua pasta local ./archives para dentro do contêiner do Kafka Connect (ex: /data/archives).

O conector spooldir precisa de mais duas pastas para funcionar: uma para onde mover os arquivos processados (/data/finished) e outra para arquivos com erro (/data/error).

Passo 3: Criar a Tabela no PostgreSQL

Antes de iniciar os conectores, garanta que a tabela de destino exista no seu banco. Use o script setup_table.sql.

Passo 4: Subir os Contêineres e Registrar os Conectores

Inicie seus serviços com docker-compose up -d.

Após o Kafka Connect estar no ar (geralmente na porta 8083), você deve registrar os dois conectores. Você pode fazer isso enviando requisições POST para a API do Kafka Connect.

Para registrar o Conector de Arquivos (Fonte):
(Substitua localhost:8083 se necessário)

curl -i -X POST -H "Accept:application/json" -H "Content-Type:application/json" \
    localhost:8083/connectors \
    -d @file_source_connector.json


Para registrar o Conector do Postgres (Destino):

curl -i -X POST -H "Accept:application/json" -H "Content-Type:application/json" \
    localhost:8083/connectors \
    -d @jdbc_sink_connector.json


Como Funciona Agora?

É isso! Agora, qualquer arquivo JSON que você (ou outro processo) colocar na pasta ./archives será:

Pego pelo spool-dir-source-connector.

Publicado no tópico archive_events_topic.

Imediatamente pego pelo postgres-sink-connector.

Inserido na sua tabela event_kafka_archives.

O arquivo original será movido da pasta ./archives para a pasta ./finished (ou ./error se falhar), garantindo que não seja processado duas vezes.