FROM postgres:latest

ENV POSTGRES_USER=user
ENV POSTGRES_PASSWORD=user
ENV POSTGRES_DB=cerestdb

COPY init.sql /docker-entrypoint-initdb.d/
