/**
 * Created by abaddon on 08.08.2017.
 */
const phantom = require('phantom');
const request = require('request');
const firstCheckRegEx = new RegExp(/^((\+380|\+38|7|8|\+7|1|\+9|\+996|8-)[\- ]?)?(\(?\d{3,4}\)?[\- ]?)?[\d\- ]{5,10}$/g);
const secondCheckRegEx = new RegExp(/^[+]*[(]{0,1}[0-9]{1,3}[)]{0,1}[-\s\./0-9]*$/g);
const emailCheckRegEx = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/gi;

process.on('message', function (m) {
    parse(m.link, (response) => {
        process.send(response);
    });
});

/**
 * Запрос на получение контента страницы
 */
function parse(link, callback) {
    request(`http://${link}/`, {timeout: 20000}, function (err, res, body) {
        if (err) {
            if (err.code === 'ETIMEDOUT') {
                request(`https://${link}/`, {timeout: 20000}, function (err, res, body) {
                    if (err) {
                        callback({phones: 'Не найден', emails: 'Не найден', error: "Сайт не доступен!", link: link});
                    }
                    callback(parseBody(body, link));
                })
            } else {
                callback({phones: 'Не найден', emails: 'Не найден', error: "Сайт не доступен!", link: link});
            }
        } else {
            callback(parseBody(body, link));
        }
    });
}

/**
 * Парсим контент
 * @param content
 */
function parseBody(content, link) {
    if (content) {
        const text = clearContent(content);
        const phones = clear(getFirstResult(text));
        const emails = getEmails(text);
        return {phones: phones.join(', '), emails: emails.join(','), link: link, error: ''};
    } else {
        return {phones: 'Не найден', emails: 'Не найден', error: "Сайт не доступен!", link: link};
    }
}

/**
 * Находит email адреса в контенте
 * @param content
 * @returns {Array.<*>}
 */
function getEmails(content) {
    const emails = content.match(emailCheckRegEx);
    return (Array.isArray(emails) ? emails : []).map((email) => {
        return email.trim()
    }).filter((item, pos, self) => self.indexOf(item) === pos);
}

/**
 * Сносит html тэги из контента
 * @param content
 */
function clearContent(content) {
    return content.replace(/(\<(\/?[^>]+)>)/g, '').replace(/&nbsp;/g, '');
}

/**
 * Получение предварительных результатов
 * @param content
 */
function getFirstResult(content) {
    const finds = content.match(/(\s*)?(\+)?([- _():=+]?\d[- _():=+]?){10,14}(\s*)?/g);
    return (Array.isArray(finds) ? finds.map((item) => item.trim()) : []).filter((item, pos, self) => self.indexOf(item) === pos);
}

/**
 * Отсекает результаты, которые меньше всего похожи на телефон
 */
function clear(items) {
    return items.filter((item) => {
        const spaceCheck = item.match(/\s/g) || [];
        const dashCheck = item.match(/\-/g) || [];

        if (firstCheckRegEx.test(item)) {
            return !!(spaceCheck.length || dashCheck.length);
        } else {
            if (secondCheckRegEx.test(item)) {
                return !!(spaceCheck.length || dashCheck.length);
            }
        }
    });
}
// function slawParse(link, callback) {
// let _ph, _page;
// let timer = null;

// phantom.create(['--ignore-ssl-errors=yes', '--load-images=no']).then(function (ph) {
//     _ph = ph;
//     return _ph.createPage();
// }).then(function (page) {
//     _page = page;
//     return _page.open(`http://${link}/`);
// }).then(function (status) {
//     console.log(status);
//     clearTimeout(timer);
//     return _page.property('content')
// }).then(function (content) {
//     clearTimeout(timer);
//     if (content) {
//         const text = clearContent(content);
//         const phones = clear(getFirstResult(text));
//         const emails = getEmails(text);
//         callback({phones: phones.join(', '), emails: emails.join(','), link: link, error: ''});
//     } else {
//         callback({phones: 'Не найден', emails: 'Не найден', error: "Сайт не доступен!", link: link});
//     }
//     _page.close();
//     _ph.exit();
// }).catch((e) => {
//     callback({phones: 'Не найден', emails: 'Не найден', error: "Сайт не доступен!", link: link});
// });

// timer = setTimeout(() => {
//     // if (_page) _page.close();
//     // if (_ph) _ph.exit();
//     callback({phones: 'Не найден', emails: 'Не найден', error: "Сайт не доступен!", link: link});
// }, 30000);
// }