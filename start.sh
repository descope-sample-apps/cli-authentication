#!/bin/sh

npm run build
node --no-warnings build/index.js $*
