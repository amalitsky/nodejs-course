'use strict';

const FileServer = require('../modules/fileServer');
const assert = require('assert');
const request = require('request');
const path = require('path');
const fs = require('fs-extra');

const port = 3001;
const url = 'localhost';
const fullUrl = `http://${url}:${port}/`;

describe('server tests', () => {
  let app;

  const checkWrongUrlChars = function(method = 'get') {
    const filename = 'file.ext';
    const wrongChars = FileServer.deprecatedURLSymbols;

    wrongChars.forEach(badSymbol => {
      it(`filters out certainly wrong file names, symbol "${badSymbol}"`, function(done) {
        request[method](encodeURI(`${fullUrl}/${badSymbol}${filename}`), (error, response) => {
          if (error) return done(error);
          assert.equal(response.statusCode, 400);
          done();
        });
      });
    });
  };

  before(function(done) {
    app = new FileServer(port);
    app.listen(done);
    fs.emptyDirSync('public/files');
  });

  afterEach(function() {
    fs.emptyDirSync('public/files');
  });

  after(function(done) {
    app.close(done);
  });

  describe('GET', function() {
    checkWrongUrlChars();

    it('returns index.html', function(done) {
      request.get(fullUrl, (error, response, body) => {
        if (error) return done(error);

        const file = fs.readFileSync('public/index.html', {encoding: 'utf-8'});

        assert.equal(body, file);

        done();
      });
    });

    it('returns file when it is present', function(done) {
      fs.copySync('test/files/small.png', 'public/files/small.png');

      request.get(`${fullUrl}small.png`, (error, response, body) => {
        if (error) return done(error);

        const {'content-type': contentType} = response.headers;

        assert.ok(contentType);

        assert.notEqual(contentType.indexOf('png'), 1);

        const file = fs.readFileSync('public/files/small.png');

        assert.equal(body, file);

        done();
      });
    });

    it('returns 404 when file is not present', function(done) {
      request.get(`${fullUrl}small.png`, (error, response) => {
        if (error) return done(error);

        const {'content-type': contentType} = response.headers;

        assert.ok(!contentType);

        assert.equal(response.statusCode, 404);

        done();
      });
    });
  });

  describe('POST', function() {
    checkWrongUrlChars('post');

    it('saves file to the folder and returns 200', function(done) {
      const file = fs.readFileSync('test/files/small.png');

      request.post({
        url: `${fullUrl}small.png`,
        body: file
      }, (error, response) => {
        if (error) return done(error);

        assert.equal(response.statusCode, 200);

        const receivedFile = fs.readFileSync('public/files/small.png');

        assert.deepEqual(file, receivedFile);

        done();
      });
    });

    it('returns 409 when file was already present and doesn\'t change existent', function(done) {
      fs.copySync('test/files/small.png', 'public/files/small.png');
      const expectedFile = fs.readFileSync('public/files/small.png');

      request.post({
        url: `${fullUrl}small.png`,
        body: 'smth else'
      }, (error, response) => {
        if (error) return done(error);

        const file = fs.readFileSync('public/files/small.png');

        assert.deepEqual(file, expectedFile);

        assert.equal(response.statusCode, 409);

        done();
      });
    });

    it('returns 413 if uploaded file is too large', function(done) {
      const file = fs.readFileSync('test/files/big.png', {encoding: 'binary'});

      request.post({
        url: `${fullUrl}big.png`,
        encoding: null,
        body: file
      }, (error, response) => {
        if (error) {
          assert.ok(!fs.existsSync('public/files/big.png'));
          done((error.code === 'EPIPE' || error.code === 'ECONNRESET') ? undefined : error);

          return;
        }

        assert.equal(response.statusCode, 413);

        setTimeout(() => {
          assert.ok(!fs.existsSync('public/files/big.png'));
          done();
        }, 99);
      });
    });
  });

  describe('DELETE', function() {
    checkWrongUrlChars('delete');

    it('drops file when present', function(done) {
      fs.copySync('test/files/small.png', 'public/files/small.png');

      request.delete(`${fullUrl}small.png`, (error, response) => {
        if (error) return done(error);

        assert.equal(response.statusCode, 200);

        done();
      });
    });

    it('returns 404 when file is not present', function(done) {
      request.delete(`${fullUrl}whatever.png`, (error, response) => {
        if (error) return done(error);

        assert.equal(response.statusCode, 404);

        done();
      });
    });
  });
});
