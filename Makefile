# MAKE BITECACHE

all: clean update build

build:
	npm run build

clean:
	npm run clean

publish:
	npm publish

test:
	npm test

update:
	-ncu -u -x chai,chalk
	-ncu -u --target minor
	-rm -rf ./node_modules
	-rm -f package-lock.json
	npm install
	npm run build

.PHONY: test
