'use strict';

const FileServer = require('../modules/fileServer');
const assert = require('assert');
const request = require('request-promise');
const path = require('path');
const fs = require('fs-extra');

const port = 3001;
const url = 'localhost';
const fullUrl = `http://${url}:${port}/`;

describe('server tests', () => {
  let app;

  const getDefaultOptions = function(url, allowNon2xx = false) {
    return {
      url,
      simple: !allowNon2xx,
      resolveWithFullResponse: true
    };
  };

  const checkWrongUrlChars = function(method = 'get') {
    const filename = 'file.ext';
    const wrongChars = FileServer.deprecatedURLSymbols;

    wrongChars.forEach(badSymbol => {
      it(`filters out certainly wrong file names, symbol "${badSymbol}"`, async function() {
        const rsp = await request[method](
            getDefaultOptions(encodeURI(`${fullUrl}${badSymbol}${filename}`), true)
        );
        assert.equal(rsp.statusCode, 400);
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

    it('returns index.html', async function() {
      const {body} = await request.get(getDefaultOptions(fullUrl));
      const file = await fs.readFile('public/index.html', {encoding: 'utf-8'});

      assert.equal(body, file);
    });

    it('returns file when it is present', async function() {
      fs.copySync('test/files/small.png', 'public/files/small.png');

      const {headers, body} = await request.get(getDefaultOptions(`${fullUrl}small.png`));
      const {'content-type': contentType} = headers;

      assert.ok(contentType);

      assert.notEqual(contentType.indexOf('png'), 1);

      const file = await fs.readFile('public/files/small.png');

      assert.equal(body, file);
    });

    it('returns 404 when file is not present', async function() {
      const {headers, statusCode} = await request.get(getDefaultOptions(`${fullUrl}small234.png`, true));
      const {'content-type': contentType} = headers;

      assert.ok(!contentType);

      assert.equal(statusCode, 404);
    });
  });

  describe('POST', function() {
    checkWrongUrlChars('post');

    it('saves file to the folder and returns 200', async function() {
      const file = await fs.readFile('test/files/small.png');

      const {statusCode} = await request.post({
        url: `${fullUrl}small.png`,
        body: file,
        resolveWithFullResponse: true
      });

      assert.equal(statusCode, 200);

      const receivedFile = await fs.readFile('public/files/small.png');

      assert.deepEqual(file, receivedFile);
    });

    it('returns 409 when file was already present and doesn\'t change existent', async function() {
      fs.copySync('test/files/small.png', 'public/files/small.png');
      const expectedFile = await fs.readFile('public/files/small.png');

      const {statusCode} = await request.post({
        url: `${fullUrl}small.png`,
        body: 'smth else',
        resolveWithFullResponse: true,
        simple: false
      });

      assert.equal(statusCode, 409);

      const file = await fs.readFile('public/files/small.png');

      assert.deepEqual(file, expectedFile);
    });

    it('returns 413 if uploaded file is too large', async function() {
      const file = await fs.readFile('test/files/big.png', {encoding: 'binary'});

      try {
        const {statusCode} = await request.post({
          url: `${fullUrl}big.png`,
          encoding: null,
          body: file,
          resolveWithFullResponse: true,
          simple: false
        });

        assert.equal(statusCode, 413);

        await new Promise(resolve => {
          setTimeout(async () => {
            assert.ok(!await fs.exists('public/files/big.png'));
            resolve();
          }, 99);
        });
      } catch ({error}) {
        assert.ok(error.code === 'EPIPE' || error.code === 'ECONNRESET');
      }
    });
  });

  describe('DELETE', function() {
    checkWrongUrlChars('delete');

    it('drops file when present', async function() {
      fs.copySync('test/files/small.png', 'public/files/small.png');

      const {statusCode} = await request.delete(getDefaultOptions(`${fullUrl}small.png`));
      assert.equal(statusCode, 200);
    });

    it('returns 404 when file is not present', async function() {
      const {statusCode} = await request.delete(getDefaultOptions(`${fullUrl}whatever.png`, true));
      assert.equal(statusCode, 404);
    });
  });
});
