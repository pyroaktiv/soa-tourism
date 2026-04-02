.PHONY: install-tools generate lint build docker-build

GOBIN := $(shell go env GOPATH)/bin

install-tools:
	go install google.golang.org/protobuf/cmd/protoc-gen-go@latest
	go install google.golang.org/grpc/cmd/protoc-gen-go-grpc@latest
	go install github.com/grpc-ecosystem/grpc-gateway/v2/protoc-gen-grpc-gateway@latest
	go install github.com/grpc-ecosystem/grpc-gateway/v2/protoc-gen-openapiv2@latest

# generate output should be committed to git
generate:
	cd .. && buf dep update
	PATH="$(GOBIN):$$PATH" buf generate cd .. && buf generate --template gateway/buf.gen.yaml

lint:
	buf lint

build:
	go build -o bin/gateway .

build-docker:
	docker build -t soa-tourism-gateway .
