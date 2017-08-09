/**
 * Created by abaddon on 07.08.2017.
 */
(function ($, d) {
    $(d).ready(() => {
        const uploadEl = d.querySelector('#upload');
        const dropZone = d.querySelector('.js-drop');
        const workPlace = d.querySelector('.js-in-work');

        uploadEl.addEventListener('change', changeHandler, false);

        //Коннект к соккету
        const socket = io.connect('http://localhost:3333');

        socket.on('connect', (data) => {
            console.log('Client is connected!');
        });

        socket.on('progress', (progress, totalCount, index) => {
            setLoading();
            workPlace.innerHTML = '';
            for (let i in progress) {
                workPlace.appendChild(createMessage(`${i}...`));
            }
            workPlace.appendChild(createMessage(`Всего ${totalCount}, Обработанно: ${index}`));
        });

        socket.emit('load-file', (state) => {
            workPlace.innerHTML = '';
            if (state) {
                setLoading();
                workPlace.appendChild(createMessage('Грузим файл...'));
            } else {
                delLoading();
                workPlace.appendChild(createMessage('Файл загружен! Начинаем магию!'));
            }
        });

        socket.on('end', (result) => {
            delLoading();
            console.warn(result);
        });

        socket.on('link', (link) => {
            if (link) {
                dropZone.innerHTML = `<a href="${link}" class="c-link" download="result.csv">Скачать результат</a>`;
            } else {
                alert("Ошибка при формировании файла!");
            }
        });

        /**
         * Создает оповещение
         * @param message
         */
        function createMessage(message) {
            const li = d.createElement('li');
            li.innerHTML = message;
            return li;
        }

        /**
         * ОБработка отпускания ф-ла
         * @param e
         */
        const onDropHandler = (e) => {
            e.preventDefault();
            const el = e.currentTarget;
            const file = e.dataTransfer.files[0];
            sendFile(file);
            setLoading();
        };

        /**
         * Обработчик при покидании области
         * @param e
         */
        const dragLeaveHandler = (e) => {
            const el = e.currentTarget;
            el.classList.remove('has-grad');
            return false;
        };

        /**
         * Обработчик при двинежии над жлементом
         */
        const dragOverHandler = (e) => {
            const el = e.currentTarget;
            el.classList.add('has-grad');
            return false;
        };


        /**
         * Обработчик для инпута
         */
        function changeHandler() {
            const file = this.files[0];
            sendFile(file);
        }

        /**
         * Отображение для прогресса загрузки файла
         */
        function setLoading() {
            dropZone.classList.add('is-loading');
            dropZone.classList.remove('has-grad');
        }

        /**
         * Удаляет отображение прогресса загрузки
         */
        function delLoading() {
            dropZone.classList.remove('is-loading');
            dropZone.classList.remove('has-grad');
        }

        /**
         * Отправляет файл на сервер
         * @param file
         */
        function sendFile(file) {
            if (!file) return;
            setLoading();
            const formData = new FormData();
            formData.append('upload', file, file.name);
            if (file.name.indexOf('.xls') !== -1) {
                $.ajax({
                    url: '/upload',
                    type: 'POST',
                    data: formData,
                    processData: false,
                    contentType: false
                }).done((res) => {
                    if (!res.success) {
                        alert(res.message);
                    }
                    delLoading();
                });
            } else {
                alert('Неверное расширение файла!');
                delLoading();
            }
        }

        dropZone.ondragover = dragOverHandler;
        dropZone.ondragleave = dragLeaveHandler;
        dropZone.ondrop = onDropHandler;
    });
}(jQuery, document));
