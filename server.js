/**
 * Created by abaddon on 07.08.2017.
 */
const express = require('express');
const app = express();
const server = require('http').createServer(app);
const io = require('socket.io')(server);
const bodyParser = require('body-parser');
const json2csv = require('json2csv');

const morgan = require('morgan');
const path = require('path');
const formidable = require('formidable');
const fs = require('fs');
const Parser = require('node-xlsx');
const computecluster = require('compute-cluster');
let cc = null;

let workArray = [];
let ioClient = null;
let progressList = {};
let resultArray = [];
let isEnd = false;
let threds = [];
let totalCount = 0;
let currentIndex = 0;

app.use(bodyParser.urlencoded({extended: true, limit: '200mb'}));
app.use(bodyParser.json({limit: '200mb'}));

app.use(morgan('dev'));
//Статические файлы
app.use(express.static('public'));
//где искать шаблоны
app.set('views', './views');
//Устанавливаем шаблонизатор
app.set('view engine', 'pug');

app.get('/', function (req, res) {
    res.render('index');
});

//Ловим файл
app.post('/upload', function (req, res) {
    const form = new formidable.IncomingForm();
    form.uploadDir = path.join(__dirname, '/public/upload');
    //Закачка файла в папку на серваке
    isEnd = false;
    totalCount = 0;
    currentIndex = 0;
    resultArray = [];

    try {
        clearDir(__dirname + '/public/upload/').then(() => {
            ioClient.emit('load-file', true);
            form.on('file', function (field, file) {
                fs.rename(file.path, path.join(form.uploadDir, file.name), () => {
                    const workSheetsFromFile = Parser.parse(__dirname + '/public/upload/' + file.name);
                    for (let i = 0, ln = workSheetsFromFile.length; i < ln; i++) {
                        const page = workSheetsFromFile[i];
                        for (let i = 0, ln = page.data.length; i < ln; i++) {
                            const item = page.data[i][0];
                            workArray.push(item);
                        }
                    }
                    ioClient.emit('load-file', false);
                    startParse();
                    res.send({success: true, message: 'Файл успешно распарсен!', data: {}});
                });
            });
        });
    } catch (e) {
        res.send({success: false, message: 'Ошибка при разборе файла!', data: {}});
    }

    //Если ошибочка
    form.on('error', function (err) {
        res.send({success: false, message: 'Ошбка при загрузке файла!', data: {}});
    });

    //Файл загружен
    form.on('end', function () {
        console.log('Файл успешно загружен!');
    });

    form.parse(req);
});

/**
 * Начинаем парсинг
 */
function startParse() {
    cc = new computecluster({module: './worker.js'});
    let limit = 15;
    totalCount = workArray.length;
    while (limit--) {
        runNext();
    }
    ioClient.emit('progress', progressList, totalCount, currentIndex);
}

/**
 * Запускает парсинг следующего сайта после завешения любого другого
 */
function runNext() {
    const link = workArray.shift();
    progressList[link] = link;
    if (link) {
        threds.push(1);
        cc.enqueue({link: link}, function (error, result) {
            // console.error(result);
            resultArray.push(result);
            delete progressList[result.link];
            ioClient.emit('progress', progressList, totalCount, ++currentIndex);
            threds.shift();
            runNext();
        });
    } else {
        if (!threds.length) {
            ioClient.emit('end', resultArray);
            isEnd = true;
            generateLink();
            cc.exit();
        }
    }
}


io.on('connection', function (client) {
    ioClient = client;
    client.on('join', function (data) {
        console.log(data);
    });

    // cc.enqueue({link: 'liketon.ru'}, function (error, result) {
    //     // resultArray.push(result);
    //     // delete progressList[result.link];
    //     // ioClient.emit('progress', progressList, totalCount, ++currentIndex);
    //     // threds.shift();
    //     // runNext();
    // });
});


//Генерация csv файла
function generateLink() {
    try {
        const result = manyColumns();

        clearDir(__dirname + '/public/download/').then(() => {
            fs.writeFile(__dirname + '/public/download/result.csv', result, function (err) {
                let link = null;
                if (!err) {
                    link = '/download/result.csv';
                }
                ioClient.emit('link', link);
            });
        });
    } catch (err) {
        console.error(err);
        res.send({success: false, message: "Ошибка при генерации файла!", data: null});
    }
}

/**
 * Только телефоны в одну колонку
 */
function onlyPhones() {
    const fields = ['phone'];
    let phones = [];
    for (let i = 0, ln = resultArray.length; i < ln; i++) {
        const item = resultArray[i];
        if (Array.isArray(item.phones)) {
            item.phones.forEach((phone) => {
                phones.push({phone: phone.trim()});
            });
        }
    }
    resultArray = [];
    return json2csv({del: ';', data: phones, fields: fields});
}

/**
 * Бъет результат по колонкам
 */
function manyColumns() {
    const fields = ['link', 'phone_0', 'phone_1', 'phone_2', 'phone_3', 'phone_4', 'email_0', 'email_1', 'email_2', 'error'];
    for (let i = 0, ln = resultArray.length; i < ln; i++) {
        const item = resultArray[i];
        let newItem = {};
        newItem.link = item.link;
        newItem.error = item.error;
        //Телефоны
        if (Array.isArray(item.phones) && item.phones.length) {
            for (let i = 0; i < 5; i++) {
                newItem['phone_' + i] = item.phones[i] ? item.phones[i] : "Не найдено";
            }
        } else {
            for (let i = 0; i < 5; i++) {
                newItem['phone_' + i] = "Не найдено";
            }
        }
        //Emails
        if (Array.isArray(item.emails) && item.emails.length) {
            for (let i = 0; i < 3; i++) {
                newItem['email_' + i] = item.emails[i] ? item.emails[i] : "Не найдено";
            }
        } else {
            for (let i = 0; i < 3; i++) {
                newItem['email_' + i] = "Не найдено";
            }
        }
        resultArray[i] = newItem;
    }
    return json2csv({del: ';', data: resultArray, fields: fields});
}

/**
 * Очищает директорию
 * @returns {Promise}
 */
function clearDir(dirPath) {
    return new Promise((resolve, reject) => {
        const rmDir = function (dirPath, removeSelf) {
            if (removeSelf === undefined) {
                removeSelf = true;
            }
            let files = [];
            try {
                files = fs.readdirSync(dirPath);
            }
            catch (e) {
                reject();
            }
            if (files.length > 0)
                for (let i = 0, ln = files.length; i < ln; i++) {
                    const filePath = dirPath + '/' + files[i];
                    if (fs.statSync(filePath).isFile()) {
                        fs.unlinkSync(filePath);
                    } else {
                        rmDir(filePath);
                    }
                }
            if (removeSelf) {
                fs.rmdirSync(dirPath);
                resolve();
            } else {
                resolve();
            }
        };
        rmDir(dirPath, false);
    });
}

server.listen(3333, function () {
    console.log('App listening on port 3333!');
});