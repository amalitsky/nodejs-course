'use strict';
const url = require('url');
const fs = require('fs');
const path = require('path');
const {readFileStatAsync, deleteFileAsync} = require('./promiseAlike');
const {Server} = require('http');
const mime = require('mime');

class FileServer {
  constructor(port, rootPath) {
    this.server = new Server();
    this.server.on('request', this.requestHandler.bind(this));
    this.server.listen(port);
    this.rootPath_ = rootPath;
    this.filesFolder = 'files';
    this.postLimit = 1024 ** 2;
  }

  requestHandler(req, res) {
    const {method} = req;

    if (this.checkUrl(req, res)) {
      switch (method) {
        case 'GET': {
          this.checkGetUrl(req, res)
              .then(fileName => this.getHandler(fileName, res))
              .catch(() => this.onErrorHandler(res, 404));
          break;
        }

        case 'DELETE': {
          this.checkDeleteUrl(req, res)
              .then(fileName => this.deleteFile(fileName, res))
              .catch(() => this.onErrorHandler(res, 404));
          break;
        }

        case 'POST': {
          const pathname = decodeURI(url.parse(req.url).pathname);
          this.writeFile(pathname, req, res);
          break;
        }

        default: {
          this.notSupportedHandler(req, res);
        }
      }
    }
  }

  checkUrl({url: reqUrl}, res) {
    let pathname;

    try {
      pathname = decodeURI(url.parse(reqUrl).pathname);
    } catch (err) {
      this.onErrorHandler(res, 400);
      return false;
    }

    if (pathname[0] === '/') {
      if (pathname.length === 1) {
        return true;
      }
      pathname = pathname.slice(1);
    }

    for (let i = 0; i < FileServer.deprecatedURLSymbols.length; i++) {
      if (pathname.indexOf(FileServer.deprecatedURLSymbols[i]) !== -1) {
        this.onErrorHandler(res, 400);
        return false;
      }
    }

    return true;
  }

  //  file should be present or "/"
  checkGetUrl({url: reqUrl}, res) {
    const pathname = decodeURI(url.parse(reqUrl).pathname);
    if (pathname === '/') {
      return Promise.resolve(pathname);
    }
    const filePath = this.getFilePath(pathname, this.filesFolder);
    return readFileStatAsync(filePath)
        .then(stats => stats.isFile() ? pathname : Promise.reject());
  }

  //  file should be present
  checkDeleteUrl({url: reqUrl}, res) {
    const pathname = decodeURI(url.parse(reqUrl).pathname);
    const filePath = this.getFilePath(pathname, this.filesFolder);
    return readFileStatAsync(filePath)
        .then(stats => stats.isFile() ? pathname : Promise.reject());
  }

  getHandler(pathname, res) {
    if (pathname === '/') {
      this.sendFile(this.getFilePath('index.html'), res);
    } else {
      this.sendFile(this.getFilePath(pathname, this.filesFolder), res);
    }
  }

  sendFile(filePath, res) {
    const file = new fs.ReadStream(filePath);
    file.pipe(res);
    file.on('open', () => res.setHeader('Content-Type', mime.lookup(filePath)));
    file.on('error', () => this.onErrorHandler(res, 500));
    res.on('close', () => file.destroy());
  }

  deleteFile(pathname, res) {
    deleteFileAsync(this.getFilePath(pathname, this.filesFolder))
        .then(() => this.onSuccesHandler(res))
        .catch(() => this.onErrorHandler(res, 500));
  }

  //  don't care about error handling here
  deleteFileOnFailedPost(filePath) {
    fs.unlink(filePath, err => console.log(err));
  }

  //  file should NOT be present
  writeFile(pathname, req, res) {
    if (req.headers['content-length'] > this.postLimit) {
      this.onErrorHandler(res, 413);
      return;
    }

    const filePath = this.getFilePath(pathname, this.filesFolder);
    const file = fs.createWriteStream(filePath, {flags: 'wx'});
    req.pipe(file);

    let totalBytes = 0;

    req.on('data', ({length}) => {
      if ((totalBytes += length) > this.postLimit) {
        res.setHeader('Connection', 'close');
        file.destroy();
        this.deleteFileOnFailedPost(filePath);
        this.onErrorHandler(res, 413);
      }
    });

    req.on('close', () => {
      file.destroy();
      this.deleteFileOnFailedPost(filePath);
    });

    file.on('error', ({code}) => {
      if (code !== 'EEXIST') {
        this.deleteFileOnFailedPost(filePath);
      }
      this.onErrorHandler(res, 409);
    });

    file.on('close', () => this.onSuccesHandler(res));
  }

  getFilePath(pathname, folder = '') {
    return path.normalize(path.join(this.rootPath_, folder, pathname));
  }

  notSupportedHandler(req, res) {
    this.onErrorHandler(res, 502);
  }

  onSuccesHandler(res, code = 200, message = 'OK') {
    res.statusCode = code;
    res.end(message);
  }

  onErrorHandler(res, code, message) {
    if (!res.headersSent) {
      res.statusCode = code;
    }
    res.end(message || FileServer.errorDescriptions[code] || '');
  }
}

FileServer.errorDescriptions = {
  400: 'Bad Request',
  404: 'File not found',
  500: 'Server Error',
  502: 'Not implemented'
};

FileServer.deprecatedURLSymbols = [
  '\0', '..', '/'
];

module.exports = FileServer;
