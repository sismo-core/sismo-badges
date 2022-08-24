FROM node:16 AS build

WORKDIR /usr/src/build
# Install dependencies
COPY package.json yarn.lock ./

RUN yarn install --frozen-lockfile
COPY . .
RUN yarn compile

FROM node:16-slim AS run
RUN apt-get -y update && apt-get -y install netcat
WORKDIR /usr/src/app
COPY --from=build /usr/src/build/ .
