#!/bin/bash

./src/js/commands/build.js

if [[ "$OSTYPE" == "darwin"* ]]; then
    open -a 'Google Chrome' --args $1 --proxy-server="127.0.0.1:8081" --proxy-bypass-list="" </dev/null >/dev/null 2>&1 &
else
    nohup google-chrome-stable $1 --proxy-server="127.0.0.1:8081" --proxy-bypass-list="" </dev/null >/dev/null 2>&1 &
fi
