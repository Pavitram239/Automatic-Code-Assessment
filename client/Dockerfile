FROM node:22-alpine AS build

WORKDIR /app
COPY client/package*.json ./
RUN npm ci --legacy-peer-deps

COPY client ./
ARG VITE_FRONTEND_ORIGIN=http://localhost:3100/api/v1
ENV VITE_FRONTEND_ORIGIN=$VITE_FRONTEND_ORIGIN
RUN npm run build

FROM nginx:1.27-alpine
COPY client/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
