FROM node:8-alpine
WORKDIR ./
COPY package*.json ./
RUN npm install --only=production
COPY . ./
EXPOSE 3001
CMD ["npm", "start"]
