/**
 * 根据章节链接获取本章和下面所有章节的内容
 */

const cheerio = require('cheerio')
const Promise = require('bluebird');
const phantom = require('phantom');

var chaptersCount = 1000; // 爬取章节数

/**
 * 解析搜索结果页HTML
 * @param  {String} html 搜索结果页HTML
 * @return {Object<title: String, content: String, nextUrl: String>} 解析结果(书本名称、最新章节链接)
 */
function parseSearchHtml(html) {
  const $ = cheerio.load(html);

  const $title = $('#result-list ul li h4').eq(0);
  const $nextLink = $('#result-list ul li .update a');

  const title = $title.text();
  const nextUrl = $nextLink.attr('href');

  console.log('书名：' + title);

  return {
    title,
    nextUrl,
  };
}

/**
 * 解析章节页HTML
 * @param  {String} html 章节HTML
 * @return {Object<title: String, content: String, nextUrl: String>} 解析结果(标题、内容、上一章节链接)
 */
function parseChapterHtml(html) {
  const $ = cheerio.load(html);
  const $title = $('h1');
  const $content = $('#content, .bookreadercontent');
  const $nextLink = $('#pagePrevBottomBtn, .prev, .prew');

  // 移除脚本
  $content.find('script').remove();

  // 移除链接
  $content.find('a').remove();

  // 移除推荐链接
  $content.find('.nice_books').remove();

  const title = $title.text();
  const content = $content.text()
    .replace(/^\s+/g, '  ')
    .replace(/\s+$/g, '\n')
    .replace(/　　/g, '\n  ');
  const nextUrl = $nextLink.attr('href');

  console.log('章节：' + title);

  return {
    title,
    content,
    nextUrl: chaptersCount-- ? nextUrl : null,
  };
}

/**
 * 获取模拟文档对象
 * @param  {Object} page Phantom页面
 * @param  {String} url 页面地址
 * @return {Promise[document]} 模拟文档对象
 */
function getDocument(page, url) {
  var now = Date.now();
  console.log('\n打开页面：' + url);

  return page.open(url).then((status) => {
    console.log('耗时：' + (Date.now() - now));

    return page.evaluate(function () {
      return {
        documentElement: {
          innerHTML: document.all['0'].innerHTML,
        },
        location: {
          origin: document.location.origin,
        },
      };
    });
  });
}

/**
 * 拼接地址
 * @param  {String]} domain 域名
 * @param  {String} path 路径
 * @return {String} 地址
 */
function getFullUrl(domain, path) {
  return path && path[0] === '/' ? (domain + path) : path;
}

/**
 * 获取书本
 * @param  {Object} page Phantom页面
 * @param  {String} searchUrl 书本搜索URL
 * @return {Promise[Object<title: String, chapters: Array>]} 书本数据
 */
function getBook(page, searchUrl) {
  return getDocument(page, searchUrl).then((document) => {
    const book = parseSearchHtml(document.documentElement.innerHTML);
    const nextUrl = getFullUrl(document.location.origin, book.nextUrl);

    return getChapters(page, nextUrl).then((chapters) => ({
      title: book.title,
      chapters: chapters.reverse().map((d) => ({ title: d.title, content: d.content })),
    }));
  });
}

/**
 * 获取所有章节
 * @param  {Object} page Phantom页面
 * @param  {String} chapterUrl 章节URL
 * @param  {Array<title: String, content: String>} chapters 所有章节数据
 * @return {Promise[Array<title: String, content: String>]} 所有章节数据
 */
function getChapters(page, chapterUrl, chapters) {
  if (!chapters) {
    chapters = [];
  }

  if (!chapterUrl) {
    return Promise.resolve(chapters);
  }

  return getDocument(page, chapterUrl).then((document) => {
    const chapter = parseChapterHtml(document.documentElement.innerHTML);
    const nextUrl = getFullUrl(document.location.origin, chapter.nextUrl);

    if (chapters.map(d => d.nextUrl).indexOf(chapter.nextUrl) > -1) {
      console.log('章节重复！');
      return chapters;
    }

    if (!chapter.title) {
      console.log('已至书末页！');
      return chapters;
    }

    chapters.push(chapter);

    return getChapters(page, nextUrl, chapters);
  });
}

/**
 * 根据书本名称爬书
 * @param  {String} bookName 书本名称
 * @return {Promise[Object<title: String, chapters: Array>]} 书本对象(书名、所有章节)
 */
function run(bookName) {
  const searchUrl = 'http://se.qidian.com/?kw=' + encodeURIComponent(bookName);

  var instance;
  var page;

  const cookies = [
    {
      domain: 'qidian.com',
      path: '/',
      is_http_only: false,
      is_secure: false,
      expires: 1577808000000,
      name: 'ns',
      value: '2',
    },
  ];

  return phantom.create().then((_instance) => {
    instance = _instance;
    return _instance.createPage();
  }).then((_page) => {
    page = _page;

    _page.setting('javascriptEnabled', true);

    return Promise.all(cookies.map(cookie => _page.addCookie(cookie)));
  }).then(() => {
    return getBook(page, searchUrl);
  }).then((book) => {
    instance.exit();
    return book;
  }).catch((ex) => {
    console.log(ex);
    instance.exit();
  });
}

module.exports = run;
