FROM golang:1.25-alpine AS build

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .

RUN CGO_ENABLED=0 GOOS=linux go build \
    -ldflags="-s -w" \
    -o /payment-service \
    .

FROM gcr.io/distroless/static-debian12

COPY --from=build /payment-service /payment-service

EXPOSE 9090

USER nonroot:nonroot

ENTRYPOINT ["/payment-service"]
