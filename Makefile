TESTS = test/integration
END_TO_END_TESTS = test/end-to-end
PERF_TESTS = test/performance
MOCHA_REPORTER =
DATA_MAINT_SCRIPTS = $(shell find ./scripts/datamaintenance -name '*.sh')
SAUCELABS_REMOTE = http://trevorah:d6b21af1-7ae7-4bed-9c56-c5f9d290712b@ondemand.saucelabs.com:80/wd/hub
BETA_SITE = https://beta.trou.pe
BASE_URL = http://localhost:5000
MAIL_HOST = localhost
MAIL_PORT = 2525

.PHONY: clean test perf-test-xunit perf-test test-xunit test-in-browser test-in-browser-xunit test-coverage prepare-for-end-to-end-testing end-to-end-test

clean:
	rm -rf public-processed/ output/ coverage/ cobertura-coverage.xml html-report/

test:
	NODE_ENV=test ./node_modules/.bin/mocha \
		--reporter dot \
		--timeout 10000 \
		--recursive \
		$(TESTS)

perf-test-xunit:
	npm install
	mkdir -p output/test-reports
	NODE_ENV=test XUNIT_FILE=output/test-reports/performance.xml ./node_modules/.bin/mocha \
		--reporter xunit-file \
		--timeout 100000 \
		--recursive \
		$(PERF_TESTS)

perf-test:
	npm install
	NODE_ENV=test ./node_modules/.bin/mocha \
		--reporter spec \
		--timeout 100000 \
		--recursive \
		$(PERF_TESTS)

test-xunit:
	mkdir -p output/test-reports
	NODE_ENV=test XUNIT_FILE=output/test-reports/integration.xml ./node_modules/.bin/mocha \
		--reporter xunit-file \
		--timeout 10000 \
		--recursive \
		$(TESTS)

test-in-browser:
	node_modules/.bin/mocha-phantomjs $(BASE_URL)/test/in-browser/test

test-in-browser-xunit:
	mkdir -p output/test-reports
	node_modules/.bin/mocha-phantomjs --timeout 30000 --reporter xunit $(BASE_URL)/test/in-browser/test > ../../output/test-reports/in-browser.xml

test-coverage:
	rm -rf ./coverage/ cobertura-coverage.xml
	mkdir -p output
	find $(TESTS) -iname "*test.js" | NODE_ENV=test xargs ./node_modules/.bin/istanbul cover ./node_modules/.bin/_mocha -- --timeout 10000
	./node_modules/.bin/istanbul report cobertura

prepare-for-end-to-end-testing:
	curl https://raw.github.com/pypa/pip/master/contrib/get-pip.py > /tmp/get-pip.py
	sudo python /tmp/get-pip.py
	test/end-to-end/e2etests/install-libs.sh
	unzip -o test/end-to-end/chromedriver/chromedriver_mac_26.0.1383.0.zip -d test/end-to-end/chromedriver/

end-to-end-test:
	# MAIL_HOST=$(MAIL_HOST) \
	# MAIL_PORT=$(MAIL_PORT) \
	# nosetests --nologcapture --processes=5 --process-timeout=120 --attr '!unreliable','thread_safe' --all-modules test/end-to-end/e2etests
	MAIL_HOST=$(MAIL_HOST) \
	MAIL_PORT=$(MAIL_PORT) \
	nosetests --nologcapture --attr '!unreliable','!thread_safe' --all-modules test/end-to-end/e2etests/chattest.py

end-to-end-test-saucelabs-chrome:
	@mkdir -p ./output/test-reports
	@echo Testing $(BETA_SITE) with chrome at saucelabs.com thread safe tests in parallel
	@REMOTE_EXECUTOR=$(SAUCELABS_REMOTE) \
	DRIVER=REMOTECHROME \
	BASE_URL=$(BETA_SITE) \
	MAIL_HOST=$(MAIL_HOST) \
	MAIL_PORT=$(MAIL_PORT) \
		nosetests \
			--processes=30 --process-timeout=180 \
			--attr '!unreliable','thread_safe' \
			--nologcapture --with-xunit --xunit-file=./output/test-reports/nosetests.xml \
			--all-modules test/end-to-end/e2etests
	@echo Testing $(BETA_SITE) with chrome at saucelabs.com thread unsafe tests in serial
	@REMOTE_EXECUTOR=$(SAUCELABS_REMOTE) \
	DRIVER=REMOTECHROME \
	BASE_URL=$(BETA_SITE) \
	MAIL_HOST=$(MAIL_HOST) \
	MAIL_PORT=$(MAIL_PORT) \
		nosetests \
			--attr '!unreliable','!thread_safe' \
			--nologcapture --with-xunit --xunit-file=./output/test-reports/nosetests.xml \
			--all-modules test/end-to-end/e2etests

end-to-end-test-saucelabs-ie10:
	@echo Testing $(BETA_SITE) with ie10 at saucelabs.com thread safe tests in parallel
	@REMOTE_EXECUTOR=$(SAUCELABS_REMOTE) \
	DRIVER=REMOTEIE \
	BASE_URL=$(BETA_SITE) \
	MAIL_HOST=$(MAIL_HOST) \
	MAIL_PORT=$(MAIL_PORT) \
		nosetests \
			--processes=30 --process-timeout=180 \
			--attr '!unreliable','thread_safe' \
			--nologcapture --with-xunit --xunit-file=./output/test-reports/nosetests.xml \
			--all-modules test/end-to-end/e2etests
	@echo Testing $(BETA_SITE) with ie10 at saucelabs.com thread unsafe tests in serial
	@REMOTE_EXECUTOR=$(SAUCELABS_REMOTE) \
	DRIVER=REMOTEIE \
	BASE_URL=$(BETA_SITE) \
	MAIL_HOST=$(MAIL_HOST) \
	MAIL_PORT=$(MAIL_PORT) \
		nosetests \
			--attr '!unreliable','!thread_safe' \
			--nologcapture --with-xunit --xunit-file=./output/test-reports/nosetests.xml \
			--all-modules test/end-to-end/e2etests

end-to-end-test-saucelabs-android:
	@echo Testing $(BETA_SITE) with android at saucelabs.com
	@REMOTE_EXECUTOR=$(SAUCELABS_REMOTE) \
	DRIVER=REMOTEANDROID \
	BASE_URL=$(BETA_SITE) \
	MAIL_HOST=$(MAIL_HOST) \
	MAIL_PORT=$(MAIL_PORT) \
	nosetests --nologcapture --attr 'phone_compatible' --with-xunit --xunit-file=./output/test-reports/nosetests.xml --all-modules test/end-to-end/e2etests

docs: test-docs

test-docs:
	make test REPORTER=doc \
		| cat docs/head.html - docs/tail.html \
		> docs/test.html

npm:
	npm prune
	npm install

lint-configs: config/*.json
	set -e && for i in $?; do (./node_modules/.bin/jsonlint $$i > /dev/null); done

grunt: clean lint-configs
	mkdir output
	cp -R public/ public-processed/
	grunt -no-color process
	./build-scripts/gzip-processed.sh

version-files:
	@echo GIT COMMIT: $(GIT_COMMIT)
	@echo GIT BRANCH: $(GIT_BRANCH)
	echo $(GIT_COMMIT) > GIT_COMMIT
	echo $(GIT_BRANCH) > VERSION

test-reinit-data: maintain-data init-test-data test post-test-maintain-data

reset-test-data: maintain-data init-test-data

upgrade-data:
	./scripts/upgrade-data.sh

maintain-data:
	MODIFY=true ./scripts/datamaintenance/execute.sh

# Make a second target
post-test-maintain-data:
	MODIFY=true ./scripts/datamaintenance/execute.sh


init-test-data:
	./scripts/dataupgrades/005-test-users/001-update.sh

tarball:
	mkdir -p output
	find . -type f -not -name ".*"| grep -Ev '^\./(\.|node_modules/|output/|assets/|mongo-backup-|scripts/mongo-backup-).*'|tar -cv --files-from - |gzip -9 - > output/troupe.tgz

search-js-console:
	if (find public/js -name "*.js" ! -path "*libs*" ! -name log.js |xargs grep -q '\bconsole\b'); then \
		echo console references in the code; \
		find public/js -name "*.js" ! -path "*libs*" ! -name log.js |xargs grep '\bconsole\b'; \
		exit 1; \
	fi

validate-source: search-js-console

continuous-integration: clean validate-source npm grunt version-files upgrade-data reset-test-data test-xunit test-coverage tarball

post-deployment-tests: test-in-browser-xunit end-to-end-test-saucelabs-chrome end-to-end-test-saucelabs-ie10 end-to-end-test-saucelabs-android

build: clean validate-source npm grunt version-files upgrade-data test-xunit

.PHONY: test docs test-docs clean

clean-client-libs:
	rm -rf public/repo

clean-temp-client-libs:
	rm -rf output/client-libs/ output/js-temp


fetch-client-libs:
	bower install

make-client-libs:
	grunt client-libs # --disableMinifiedSource=true

make-jquery:
	npm install
	./node_modules/.bin/jquery-builder -v 2.0.3 -e deprecated -m > public/repo/jquery/jquery.js

install-client-libs:
	ls -d output/client-libs/*|sed -e 's!output/client-libs/!public/repo/!'|sed -e 's!retina.js-js!retina!'|sed -e 's!typeahead.js!typeahead!'|xargs mkdir -p
	cp output/client-libs/almond/almond.js public/repo/almond/almond.js
	cp output/client-libs/assert/assert-amd.js public/repo/assert/assert.js
	cp output/client-libs/backbone/backbone-amd.js public/repo/backbone/backbone.js
	cp output/client-libs/backbone.babysitter/lib/amd/backbone.babysitter.min.js public/repo/backbone.babysitter/backbone.babysitter.js
	cp output/client-libs/backbone.keys/dist/backbone.keys.min.js public/repo/backbone.keys/backbone.keys.js
	cp output/client-libs/backbone.wreqr/lib/amd/backbone.wreqr.min.js public/repo/backbone.wreqr/backbone.wreqr.js
	cp output/client-libs/bootstrap/bootstrap-tooltip.js public/repo/bootstrap/tooltip.js
	cp output/client-libs/bootstrap/bootstrap-typeahead.js public/repo/bootstrap/typeahead.js
	cp output/client-libs/cocktail/cocktail-amd.js public/repo/cocktail/cocktail.js
	cp output/client-libs/cubism/cubism.v1.min.js public/repo/cubism/cubism.js
	cp output/client-libs/d3/d3.min.js public/repo/d3/d3.js
	cp output/client-libs/expect/expect-amd.js public/repo/expect/expect.js
	cp output/client-libs/faye/faye-browser.js public/repo/faye/faye.js
	cp output/client-libs/filtered-collection/backbone-filtered-collection-amd.js public/repo/filtered-collection/filtered-collection.js
	cp output/client-libs/hopscotch/hopscotch-0.1.2-amd.js public/repo/hopscotch/hopscotch.js

	mkdir -p public/repo/hopscotch/css/ public/repo/hopscotch/img
	cp output/client-libs/hopscotch/css/hopscotch-0.1.1.min.css public/repo/hopscotch/css/hopscotch.css
	cp output/client-libs/hopscotch/img/sprite-green-0.3.png public/repo/hopscotch/img/

	cp output/client-libs/hopscotch/css/hopscotch-0.1.1.min.css public/repo/hopscotch/css/hopscotch.css
	cp output/client-libs/marionette/lib/core/amd/backbone.marionette.min.js public/repo/marionette/marionette.js
	cp output/client-libs/fine-uploader/fine-uploader.js public/repo/fine-uploader/fine-uploader.js
	cp output/client-libs/fine-uploader/client/fineuploader.css public/repo/fine-uploader/fineuploader.less
	cp output/client-libs/hbs/hbs.js public/repo/hbs/hbs.js
	cp output/client-libs/hbs/hbs/i18nprecompile.js public/repo/hbs/i18nprecompile.js
	cp output/client-libs/hbs/Handlebars.js public/repo/hbs/Handlebars.js
	cp output/client-libs/hbs/hbs/json2.js public/repo/hbs/json2.js
	cp output/client-libs/jquery-placeholder/jquery.placeholder-amd.js public/repo/jquery-placeholder/jquery-placeholder.js
	cp output/client-libs/jquery.validation/jquery.validate-amd.js public/repo/jquery.validation/jquery.validation.js
	cp output/client-libs/hammerjs/dist/jquery.hammer.min.js public/repo/hammerjs/jquery.hammer.js
	cp output/client-libs/mocha/mocha-amd.js public/repo/mocha/mocha.js
	cp output/client-libs/mocha/mocha.css public/repo/mocha/mocha.css
	cp output/client-libs/moment/min/moment.min.js public/repo/moment/moment.js
	cp output/client-libs/nanoscroller/jquery.nanoscroller.js public/repo/nanoscroller/nanoscroller.js
	cp output/client-libs/requirejs/index.js public/repo/requirejs/requirejs.js
	cp output/client-libs/retina.js-js/src/retina.js public/repo/retina/retina.js
	cp output/client-libs/scrollfix/scrollfix-amd.js public/repo/scrollfix/scrollfix.js
	cp output/client-libs/sisyphus/jquery.sisyphus-amd.js public/repo/sisyphus/jquery.sisyphus.js
	cp output/client-libs/typeahead.js/typeahead.js public/repo/typeahead/typeahead.js
	cp output/client-libs/underscore/underscore-amd.js public/repo/underscore/underscore.js
	# cp output/client-libs/zeroclipboard/ZeroClipboard.js public/repo/zeroclipboard/zeroclipboard.js
	cp output/client-libs/zeroclipboard/zeroclipboard-amd.js public/repo/zeroclipboard/zeroclipboard.js
	cp output/client-libs/zeroclipboard/ZeroClipboard.swf public/repo/zeroclipboard/

client-libs: clean-temp-client-libs make-jquery fetch-client-libs make-client-libs clean-client-libs install-client-libs
