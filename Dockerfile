FROM node:8-alpine
EXPOSE 3000
WORKDIR /
COPY . /
RUN apk add --update \
        bash \
        curl \
&& rm -rf /var/cache/apk/*
RUN npm install --only=production
RUN chmod a+x /docker/entrypoint.sh
CMD ["/docker/entrypoint.sh"]
