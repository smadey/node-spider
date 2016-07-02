const fs = require('fs');
const path = require('path');

const getQidianBook = require('./sites/qidian.js');

const bookName = '狂神';

getQidianBook(bookName).then((book) => {
  const content = book.title + '\n\n' + book.chapters.map((d) => {
    return d.title + '\n' + d.content;
  }).join('\n');

  const buf = new Buffer(content);

  const fd = fs.openSync(path.join(__dirname, '../output/' + bookName + '.txt'), 'w');
  fs.writeSync(fd, buf, 0, buf.length);
  fs.closeSync(fd);
}, (err) => {
  console.log(err);
});
