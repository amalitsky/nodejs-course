'use strict';

const fs = require('fs');

// хотим читать данные из потока в цикле
const readStream = function(stream) {
  const removeAllListeners = function() {
    ['readable', 'end', 'error'].forEach(
        eventType => stream.removeAllListeners(eventType)
    );
  };

  return function() {
    const promise = new Promise((resolve, reject) => {
      stream
        .once('readable', () => resolve(stream.read()))
        .once('end', () => resolve(false))
        .once('error', reject);
    });

    // race condition ?
    promise.then(removeAllListeners, removeAllListeners);

    return promise;
  };
};

async function read(path) {
  const stream = fs.createReadStream(path, {highWaterMark: 60, encoding: 'utf-8'});

  // ЗАДАЧА: написать такой readStream
  const reader = readStream(stream);
  let data;

  while ((data = await reader())) {
    console.log(data);
  }
}

read(__filename).catch(console.error);
