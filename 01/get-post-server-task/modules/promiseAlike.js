'use strict';
const fs = require('fs');

const readFileStatAsync = function(path) {
  return new Promise((resolve, reject) => {
    fs.stat(path, (err, stats) => {
      if (err && reject) {
        reject(err);
      } else if (resolve) {
        resolve(stats);
      }
    });
  });
};

const deleteFileAsync = function(path) {
  return new Promise((resolve, reject) => {
    fs.unlink(path, err => {
      if (err && reject) {
        reject(err);
      } else if (resolve && !err) {
        resolve();
      }
    });
  });
};

module.exports.readFileStatAsync = readFileStatAsync;
module.exports.deleteFileAsync = deleteFileAsync;
