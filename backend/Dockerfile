# Stage 1: Build binary
FROM golang:1.26.2-alpine3.22 AS builder

WORKDIR /app

# Install build tools if needed
RUN apk add --no-cache git ca-certificates

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-w -s" -o restopulse-server .

# Stage 2: Minimal runtime image
FROM alpine:latest

WORKDIR /app

RUN apk add --no-cache ca-certificates tzdata

COPY --from=builder /app/restopulse-server /app/restopulse-server

EXPOSE 8080

ENV PORT=8080
ENV DATABASE_PATH=/app/data/restopulse.db

VOLUME ["/app/data"]

CMD ["/app/restopulse-server"]
