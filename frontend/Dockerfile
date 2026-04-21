FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm install

COPY . .

# Expose port của Vite
EXPOSE 5173

# Chạy server dev của React
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]