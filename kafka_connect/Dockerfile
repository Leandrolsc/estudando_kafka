FROM debezium/connect:3.0.0.Final

USER root

RUN confluent-hub install --no-prompt confluentinc/kafka-connect-jdbc:latest

RUN confluent-hub install --no-prompt jcustenborder/kafka-connect-spooldir:latest

USER kafka