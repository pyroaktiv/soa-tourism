.PHONY: generate build run

generate:
	cd .. && buf dep update
	npm install
	buf generate

build:
	npm run build

run:
	npm start
