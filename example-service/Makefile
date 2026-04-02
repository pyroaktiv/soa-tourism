.PHONY: generate run

generate:
	cd .. && buf dep update
	cd .. && buf generate --template example-service/buf.gen.yaml

run:
	PYTHONPATH=src python app/server.py
