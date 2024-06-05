FROM alpine:latest

RUN apk add --no-cache tzdata
ENV TZ="Europe/London"

# Set the working directory in the container
WORKDIR /usr/src/app

# Install Node.js and npm
RUN apk add --update nodejs npm

# Copy the entire directory into the container
COPY private ./private
COPY public ./public
COPY package.json ./
COPY .env ./
COPY start.sh ./

# Install the dependencies
RUN npm install -g typescript
RUN npm install -g nodemon
RUN npm i

RUN chmod +x start.sh

# Start the application
CMD ["sh", "start.sh"]


# Expose the port Express.js is running on (3001)
EXPOSE 3001

# Expose the port React.js is running on (3000)
EXPOSE 3000
