FROM node:22-alpine AS build
WORKDIR /repo
RUN corepack enable
COPY . .
ARG PACKAGE=gateway
RUN corepack pnpm install && corepack pnpm --filter "${PACKAGE}..." build

FROM node:22-alpine
WORKDIR /repo
RUN adduser -D livescope
COPY --from=build /repo /repo
USER livescope
ARG PACKAGE=gateway
ENV PACKAGE=${PACKAGE}
CMD corepack pnpm --filter ${PACKAGE} start
