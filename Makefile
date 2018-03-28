EMBEDDED_NODE_ENV ?= prod
EMBEDDED_WWW_DIRECTORY ?= ~/code/gitter/ios/Troupe/www/build
export PATH := ./node_modules/.bin:$(PATH)

.PHONY: build clean test npm sprites npm-quick npm-full performance-tests test-no-coverage continuous-integration validate

continuous-integration: build

build: clean npm validate test package

validate:
	gulp validate

test-lua:
	echo lua tests disabled #gulp test-redis-lua

package:
	./node_modules/.bin/gulp package assemble --skip-stage validate --skip-stage test

clean:
	gulp clean || (make npm-full && gulp clean)
  # If gulp clean failed, it's almost certainly a problem
  # with the npm folder, so nuke it and try again

upload-to-s3:
	rm -rf output/s3upload/
	mkdir -p output/s3upload/
	cp output/app.tar.gz output/assets.tar.gz output/app/ASSET_TAG output/app/GIT_COMMIT output/app/VERSION output/s3upload/
	aws s3 cp --recursive --metadata GIT_COMMIT=$(CI_COMMIT_SHA) output/s3upload/ $(DIST_S3_URL)

ci-test:
	mkdir -p output/
	gulp test --test-coverage --test-suite docker --test-xunit-reports --test-bail

test: clean
	mkdir -p output/
	gulp test

test-no-coverage: clean
	mkdir -p output/
	gulp test --test-suite docker --test-xunit-reports
	echo "Docker tests completed"

print-nodejs-version:
	node --version
	npm --version

npm-quick: print-nodejs-version
	npm prune
	npm install
	./build-scripts/validate-modules-for-build.sh

npm-full: print-nodejs-version
	rm -rf node_modules/ modules/*/node_modules shared/node_modules

	npm install

npm:
	make npm-quick || make npm-full

sprites:
	@mkdir -p output/temp-sprites
	@node scripts/generate-service-sprite.js

test-reinit-data: maintain-data test post-test-maintain-data

reset-test-data: maintain-data

upgrade-data:
	./scripts/upgrade-data.sh

maintain-data:
	MODIFY=true ./scripts/datamaintenance/execute.sh || true

clean-embedded-chat:
	rm -rf output/embedded output/embedded.tgz

embedded-chat: clean
	mkdir -p output/embedded/www/mobile
	NODE_ENV=$(EMBEDDED_NODE_ENV) ./build-scripts/render-embedded-chat.js  -o output/embedded/www/mobile/embedded-chat.html
	gulp --gulpfile gulpfile-embedded.js
	ls output/assets/js/*.js  >> output/embedded-resources.txt
	ls output/assets/styles/*.css  >> output/embedded-resources.txt

	ls output/assets/images/emoji/*  >> output/embedded-resources.txt

	./build-scripts/extract-urls.js output/assets/styles/mobile-native-chat.css >> output/embedded-resources.txt
	./build-scripts/copy-embedded-resources.sh

embedded-chat-copy: embedded-chat
	rm -rf $(EMBEDDED_WWW_DIRECTORY)
	mkdir -p $(EMBEDDED_WWW_DIRECTORY)
	cp -R output/embedded/www/* $(EMBEDDED_WWW_DIRECTORY)/

# make-jquery:
# 	npm install
# 	./node_modules/.bin/jquery-builder -v 2.0.3 -e deprecated -m > public/repo/jquery/jquery.js
