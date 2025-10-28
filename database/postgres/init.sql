-- Conecta-se à base de dados correta antes de criar as tabelas
\c events_db;

-- Tabela de Eventos
CREATE TABLE IF NOT EXISTS "events_kafka" (
    "id" SERIAL PRIMARY KEY,
    "game" TEXT,
    "eventType" TEXT,
    "event" TEXT,
    "dataAlteracao" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Mensagem de sucesso (opcional, aparecerá nos logs do Docker)
\echo 'Tabelas criadas e usuário master garantido com sucesso!'

