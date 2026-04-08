FROM golang:1.25-alpine AS build

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .

RUN CGO_ENABLED=0 GOOS=linux go build \
    -ldflags="-s -w" \
    -o /auth-service \
    .

FROM gcr.io/distroless/static-debian12

COPY --from=build /auth-service /auth-service

EXPOSE 9090

USER nonroot:nonroot

ENTRYPOINT ["/auth-service"]
