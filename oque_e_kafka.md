# Arquitetura do Apache Kafka e o Modo KRaft

## 1. Introdução

O **Apache Kafka** é uma plataforma distribuída de *streaming* de dados que permite a publicação, assinatura, armazenamento e processamento de fluxos de eventos em tempo real. Ele é amplamente utilizado em arquiteturas de dados modernas para integrar sistemas, capturar logs, monitorar eventos e alimentar *pipelines* de dados.

O Kafka opera como um **sistema de mensageria distribuído e tolerante a falhas**, que oferece:
- **Alta taxa de transferência (throughput)** para grandes volumes de dados;
- **Baixa latência**;
- **Escalabilidade horizontal**;
- **Persistência e replicação de dados**;
- **Entrega garantida** (*at least once*, *exactly once*, dependendo da configuração).

---

## 2. Conceitos Fundamentais

### 2.1. Broker
Um **broker** é um servidor Kafka responsável por armazenar e disponibilizar mensagens. Um cluster Kafka é composto por múltiplos brokers, o que permite alta disponibilidade e distribuição de carga.

### 2.2. Tópicos (Topics)
Os dados no Kafka são organizados em **tópicos**, que funcionam como canais lógicos de mensagens. Cada tópico pode ser particionado em várias **partições**, o que permite o paralelismo e a distribuição das mensagens entre os brokers.

### 2.3. Partições
Cada **partição** é uma sequência ordenada e imutável de mensagens. As partições permitem escalabilidade e replicação. O Kafka garante a ordenação das mensagens **dentro** de uma mesma partição.

### 2.4. Produtores e Consumidores
- **Produtores**: publicam mensagens em tópicos.
- **Consumidores**: leem mensagens de tópicos, podendo trabalhar em grupos (*consumer groups*) para dividir a carga.

### 2.5. Replicação e Fator de Replicação
Cada partição pode ter **réplicas** distribuídas entre brokers diferentes. Um dos brokers é o **líder** da partição, responsável por coordenar as gravações e leituras. Os demais brokers são **seguidores (followers)** que mantêm cópias sincronizadas.

---

## 3. Arquitetura Geral do Kafka

A arquitetura do Kafka é projetada para ser **distribuída, tolerante a falhas e escalável**. Ela é composta por:

- **Produtores** que enviam dados.
- **Brokers** que armazenam e distribuem os dados.
- **Consumidores** que leem e processam as mensagens.
- Um **sistema de coordenação** que gerencia o estado do cluster, as partições, os líderes e a configuração dos tópicos.

Historicamente, o sistema de coordenação era realizado pelo **Apache Zookeeper**, mas a partir das versões mais recentes (Kafka 2.8 e, oficialmente, no Kafka 3.3 em diante), foi introduzido o **modo KRaft**, substituindo o Zookeeper.

---

## 4. Modo Zookeeper (Modelo Antigo)

### 4.1. Função do Zookeeper
O **Zookeeper** era um serviço externo usado para:
- Armazenar a configuração dos brokers;
- Manter informações de tópicos e partições;
- Eleger o líder do cluster;
- Coordenar o estado das réplicas;
- Detectar falhas de brokers.

### 4.2. Desvantagens do Zookeeper
Apesar de funcional, esse modelo apresentava limitações:
- Complexidade operacional (necessidade de manter dois sistemas distintos);
- Dificuldade de escalabilidade do Zookeeper;
- Latência adicional devido à comunicação entre Kafka e Zookeeper;
- Processos de *failover* mais lentos e complexos;
- Maior chance de inconsistência em clusters grandes.

---

## 5. Modo KRaft (Kafka Raft Metadata Mode)

### 5.1. Introdução
O **KRaft (Kafka Raft Metadata Mode)** é o novo modo nativo de gerenciamento de metadados introduzido no Kafka. Ele elimina a dependência do **Zookeeper** e utiliza o **protocolo Raft** para garantir consistência e consenso entre os controladores do cluster.

### 5.2. Como Funciona
O KRaft introduz o conceito de **controladores** que gerenciam diretamente os metadados do cluster. O protocolo **Raft** é utilizado para coordenar e replicar esses metadados entre os nós controladores, garantindo:
- Eleição automática de líderes;
- Consistência forte;
- Resiliência a falhas.

Os **metadados** incluem:
- Estado dos tópicos e partições;
- Mapeamento de líderes e réplicas;
- Configurações do cluster e ACLs;
- Offsets de consumidores (quando configurado para isso).

### 5.3. Estrutura
Um cluster em modo KRaft possui dois tipos de nós:
- **Controladores (Controllers)**: responsáveis por manter e replicar os metadados via Raft.
- **Brokers (Data Nodes)**: responsáveis pelo armazenamento e distribuição das mensagens.

Em implementações pequenas, é possível que um mesmo nó atue simultaneamente como **broker** e **controller**.

### 5.4. Vantagens do KRaft
- Eliminação completa do Zookeeper;
- Menor complexidade de implantação e manutenção;
- Tempo de inicialização mais rápido;
- Melhor desempenho e escalabilidade dos metadados;
- Melhor tolerância a falhas e recuperação mais rápida;
- Consistência e simplicidade do modelo de replicação (um único protocolo — Raft).

---

## 6. Comparação: KRaft vs Zookeeper

| Característica | Modo Zookeeper | Modo KRaft |
|-----------------|----------------|-------------|
| Sistema de Coordenação | Externo (Zookeeper) | Interno (Raft embutido no Kafka) |
| Consenso | Zab (protocolo do Zookeeper) | Raft |
| Complexidade Operacional | Alta (2 sistemas distintos) | Reduzida (1 único sistema) |
| Escalabilidade | Limitada pelo Zookeeper | Melhor escalabilidade nativa |
| Desempenho | Menor devido à sobrecarga do Zookeeper | Maior devido à integração direta |
| Tempo de *Failover* | Mais lento | Mais rápido |
| Configuração | Mais complexa | Simplificada |
| Versão recomendada | Até Kafka 2.8 | A partir do Kafka 3.3+ |

---

## 7. Estado Atual e Recomendação

Desde a versão **Kafka 3.3**, o modo **KRaft** é considerado **estável** e **recomendado** para novas instalações. O suporte ao Zookeeper será descontinuado nas versões futuras do Kafka, tornando o KRaft o modo padrão de operação.

### 7.1. Migração
Para quem possui clusters legados com Zookeeper, há ferramentas de **migração assistida** fornecidas pela equipe do Kafka, permitindo a transição sem perda de dados ou necessidade de reconstrução total do cluster.

---

## 8. Conclusão

O Apache Kafka evoluiu significativamente com a introdução do modo KRaft, tornando-se uma plataforma mais **simples, robusta e eficiente**.  
A remoção da dependência do Zookeeper simplifica a administração e aumenta a performance, mantendo a confiabilidade e a escalabilidade que tornaram o Kafka um padrão de mercado para processamento de dados em tempo real.

---

## Referências
- [Documentação Oficial do Apache Kafka](https://kafka.apache.org/documentation/)
- [KRaft Mode Overview – Apache Kafka Wiki](https://developer.confluent.io/learn/kraft/)
- [Kafka Improvement Proposal (KIP-500)](https://cwiki.apache.org/confluence/display/KAFKA/KIP-500%3A+Replace+ZooKeeper+with+a+Self-Managed+Metadata+Quorum)

---
