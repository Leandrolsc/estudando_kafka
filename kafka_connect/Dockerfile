FROM debezium/connect:3.0.0.Final

USER root

# Instala o Conector JDBC (para o Postgres)
RUN confluent-hub install --no-prompt confluentinc/kafka-connect-jdbc:latest

# Instala um Conector de Arquivos (SpoolDir é uma ótima opção para "pastas de spool")
RUN confluent-hub install --no-prompt jcustenborder/kafka-connect-spooldir:latest

# Retorna ao usuário padrão do Kafka Connect
USER kafka