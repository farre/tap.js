// run as nodejs example/node.js

var http = require("http"),
    url = require("url"),
    path = require("path"),
    fs = require("fs")
    port = process.argv[2] || 8888;

http.createServer(function(request, response) {

  var uri = url.parse(request.url).pathname
    , filename = path.join(process.cwd(), uri);
  
  path.exists(filename, function(exists) {
    if(!exists) {
      response.writeHead(404, {"Content-Type": "text/plain"});
      response.write("404 Not Found\n");
      response.end();
      return;
    }

    if (fs.statSync(filename).isDirectory()) filename += '/index.html';

    fs.readFile(filename, "binary", function(err, file) {
      if(err) {
	console.log("Serving " + filename + " as text");
        response.writeHead(500, {"Content-Type": "text/plain"});
        response.write(err + "\n");
        response.end();
        return;
      }

      var ext = path.extname(filename||'').split('.');
      ext = ext.pop();
      if (ext == 'html') {
	  console.log("Serving " + filename + " as text/html of length " + file.length)
        response.setHeader("Content-Type", "text/html");
      } else if (ext == 'js') {
	  console.log("Serving " + filename + " as text/javascript of length " + file.length)
        response.setHeader("Content-Type", "text/javascript");
      } else {
	  console.log("Serving " + filename + " as binary of length " + file.length);     }

      response.writeHead(200, {"Content-Length": file.length});
      response.write(file, "binary");
      response.end();
    });
  });
}).listen(parseInt(port, 10));

console.log("Static file server running at\n  => http://localhost:" + port + "/\nCTRL + C to shutdown");
