# gen/ and api/swagger/ are already generated
FROM golang:1.25-alpine AS build

WORKDIR /app

# cache dependency downloads as a separate layer.
COPY go.mod go.sum ./
RUN go mod download

# copy remaining source
COPY . .

RUN CGO_ENABLED=0 GOOS=linux go build \
    -ldflags="-s -w" \
    -o /gateway \
    .

# runtime image
FROM gcr.io/distroless/static-debian12

COPY --from=build /gateway /gateway

EXPOSE 8080

USER nonroot:nonroot

ENTRYPOINT ["/gateway"]
