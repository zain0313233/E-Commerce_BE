FROM node:latest
WORKDIR /app
RUN npm install -g nodemon
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3001
CMD ["npm", "run", "dev"]
