// слишком простой чат, в коде есть минимум 7 серьёзных ошибок - КАКИХ?

const http = require('http');
const fs = require('fs');

let clients = [];
http.createServer((req, res) => {
  const urlPath = url.parse(req).pathname;

  //  FIXME bad URL characters handling
  switch (req.method + ' ' + urlPath) {
    case 'GET /':
      // FIXME error handling, no res.end() or res.on('close')
      fs.createReadStream('index.html').pipe(res);
      break;

    case 'GET /subscribe':
      console.log("subscribe");
      // FIXME res.on('close') if closed before we end it
      clients.push(res);
      break;

    case 'POST /publish':
      let body = '';

      req
          .on('data', data => {
            // body size
            body += data;
          })
          // FIXME .on('close') event handler
          .on('end', () => {
            // FIXME try catch wrapper
            body = JSON.parse(body);

            console.log("publish '%s'", body.message);

            clients.forEach(res => {
              // FIXME response code
              res.end(body.message);
            });

            clients = [];

            // FIXME response code
            res.end("ok");
          });

      break;

    default:
      res.statusCode = 404;
      res.end("Not found");
  }

}).listen(3000);
