.PHONY: generate lint

generate:
	cd .. && buf dep update
	buf generate

lint:
	buf lint
