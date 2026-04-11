#!/bin/bash

docker exec kafka-1 kafka-topics \
  --create --topic metrics.raw \
  --bootstrap-server localhost:9092 \
  --partitions 3 --replication-factor 1

docker exec kafka-1 kafka-topics \
  --create --topic logs.raw \
  --bootstrap-server localhost:9092 \
  --partitions 3 --replication-factor 1

docker exec kafka-1 kafka-topics \
  --create --topic traces.raw \
  --bootstrap-server localhost:9092 \
  --partitions 3 --replication-factor 1

docker exec kafka-1 kafka-topics \
  --create --topic events.dlq \
  --bootstrap-server localhost:9092 \
  --partitions 3 --replication-factor 1