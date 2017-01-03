#!/bin/bash

mkdir -p out/

./src/js/testing/http-server.js &
mitmdump --quiet --anticache -p 8081 --no-http2 -s "mitmproxy/proxy.py --no-cache" >> out/log-mitmdump.txt 2>&1 &

./src/js/commands/build.js
protractor protractor_conf.js
