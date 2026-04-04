.PHONY: generate run

generate:
	cd .. && buf dep update
	PATH="$(shell go env GOPATH)/bin:$$PATH" buf generate

run:
	PYTHONPATH=src python app/server.py
