.PHONY: install-tools generate build run docker-build

GOBIN := $(shell go env GOPATH)/bin

install-tools:
	go install google.golang.org/protobuf/cmd/protoc-gen-go@latest
	go install google.golang.org/grpc/cmd/protoc-gen-go-grpc@latest

# generate output should be committed to git
generate:
	cd .. && buf dep update
	PATH="$(GOBIN):$$PATH" buf generate

build:
	go build -o bin/payment .

run:
	go run .

docker-build:
	docker build -t soa-tourism-payment .
