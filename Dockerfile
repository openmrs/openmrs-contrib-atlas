FROM node:8-stretch

COPY . /app

WORKDIR /app

RUN apt-get update && \
  npm install --only=production && \
  chmod a+x /app/docker/entrypoint.sh

EXPOSE 3000

CMD ["/app/docker/entrypoint.sh"]