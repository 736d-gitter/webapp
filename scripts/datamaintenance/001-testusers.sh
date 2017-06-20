#!/bin/bash

set -e

MONGO_URL=$1
if [ -z "$MONGO_URL" ]; then MONGO_URL=troupe; fi

mongo $MONGO_URL <<"DELIM"
db.users.remove({ email: /@troupetest.local$/ })
DELIM
