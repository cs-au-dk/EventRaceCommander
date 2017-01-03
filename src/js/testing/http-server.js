#!/usr/bin/env node

var fs = require("fs");
var http = require("http");
var path = require("path");
var Q = require("q");
var url = require("url");
var walk = require("walk");

function start(port) {
    var deferred = Q.defer();
    http.createServer(function (request, response) {
        var urlParts = url.parse(request.url, true);
        handleRequest(request, response, urlParts);
    })
    .on('listening', function () {
        console.log('Server running on http://localhost:' + port + '/');
        deferred.resolve();
    })
    .on('error', deferred.reject)
    .listen(port);

    return deferred.promise;
}

function handleRequest(request, response, urlParts) {
    if (urlParts.query.delay > 0) {
        setTimeout(function() {
            urlParts.query.delay = 0;
            handleRequest(request, response, urlParts);
        }, urlParts.query.delay);
        return;
    }

    var filePath = "." + urlParts.pathname;
    if (filePath == "./") {
        // List files
        var walker = walk.walk("./", { followLinks: false });
        var filePaths = [];

        walker.on("file", function(root, stat, next) {
            // Add this file to the list of filePaths
            if (path.extname(stat.name) == ".html") {
                filePaths.push(path.join(root, stat.name));
            }
            next();
        });

        walker.on("end", function() {
            response.writeHead(200, { "Content-Type": "text/html" });
            var items = filePaths.sort().map(function (file) {
                return "<li><a href='" + file + "'>" + file + "</a></li>";
            });
            response.end("<html><body><ul>" + items.join("") + "</ul></body></html>");
        });
    } else {
        // Serve
        fs.lstat(filePath, function(err, stats) {
            if (!err && stats.isDirectory()) {
                response.writeHead(302, {
                  'Location': path.join(urlParts.pathname, "index.html")
                });
                response.end();
            } else {
                fs.readFile(filePath, function(error, content) {
                    if (error) {
                        if (error.code == "ENOENT") {
                            response.writeHead(404, { "Content-Type": 'text/plain' });
                            response.end("File '" + filePath + "' not found", 'utf-8');
                        } else {
                            response.writeHead(500);
                            response.end("Internal server error for '" + filePath + "'");
                            response.end(); 
                        }
                    } else {
                        response.writeHead(200, { "Content-Type": getContentType(filePath) });
                        response.end(content, "utf-8");
                    }
                });
            }
        });
    }
}

function getContentType(filePath) {
    switch (path.extname(filePath)) {
        case ".js":
            return "text/javascript";
        case ".css":
            return "text/css";
        case ".json":
            return "application/json";
        case ".png":
            return "image/png";
        case ".jpg":
            return "image/jpg";
        case ".txt":
            return "text/plain";
        default:
            return "text/html";
    }
}

if (require.main === module) {
    start(8080);
}

exports.start = start;
