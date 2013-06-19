/**
 * Author: G@mOBEP
 * Date: 03.03.13
 * Time: 12:29
 */

var $http = require('http'),
    $util = require('util'),
    $events = require('events'),

    $swiftErrors = require('swift.errors');

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

function Server ()
{
    /**
     * Сервер
     *
     * @type {Server}
     * @private
     */
    this._server = $http.createServer();

    /**
     * Слушатель запросов
     *
     * @type {Object|null}
     * @private
     */
    this._requestListener = null;

    /**
     * ip-адрес сервера
     *
     * @type {String}
     * @private
     */
    this._ip = '127.0.0.1';

    /**
     * Порт сервера
     *
     * @type {String}
     * @private
     */
    this._port = '3333';
}
$util.inherits(Server, $events.EventEmitter);

/**
 * Получение сервера
 *
 * @returns {Server}
 */
Server.prototype.getServer = function getServer ()
{
    return this._server;
};

/**
 * Задание слушателя запросов
 *
 * @param {Object} requestListener слушатель запросов
 *
 * @returns {Server}
 */
Server.prototype.setRequestListener = function setRequestListener (requestListener)
{
    //
    // проверка параметров
    //
    if (typeof requestListener !== 'function')
        throw new $swiftErrors.TypeError('Недопустимый тип слушателя запросов (ожидается: "function", принято: "' + typeof requestListener + '").');
    //
    // задание слушателя запросов
    //
    this._requestListener = requestListener;

    return this;
};

/**
 * Получение слушателя запросов
 *
 * @returns {Object|null}
 */
Server.prototype.getRequestListener = function getRequestListener ()
{
    return this._requestListener;
};

/**
 * Задание ip
 *
 * @param {String} ip
 *
 * @returns {Server}
 */
Server.prototype.setIp = function setIp (ip)
{
    //
    // проверка параметров
    //
    if (typeof ip !== 'string')
        throw new $swiftErrors.TypeError('Недопустимый тип ip (ожидается: "string", принято: "' + typeof ip + '").');
    if (!ip.match(/^(?:\d{1,3}\.){3}\d{1,3}$/))
        throw new $swiftErrors.ValueError('Недопустимое значение ip.');
    //
    // задание ip
    //
    this._ip = ip;

    return this;
};

/**
 * Получение ip
 *
 * @returns {String}
 */
Server.prototype.getIp = function getIp ()
{
    return this._ip;
};

/**
 * Задание порта
 *
 * @param {String} port
 *
 * @returns {Server}
 */
Server.prototype.setPort = function setPort (port)
{
    //
    // проверка параметров
    //
    if ((typeof port !== 'string') && (typeof port !== 'number'))
        throw new $swiftErrors.TypeError('Недопустимый тип порта (ожидается: "string"|"number", принято: "' + typeof port + '").');
    if (!(port + '').match(/^\d+$/))
        throw new $swiftErrors.ValueError('Недопустимое значение порта.');
    //
    // задание порта
    //
    this._port = parseInt(port);

    return this;
};

/**
 * Получение порта
 *
 * @returns {String}
 */
Server.prototype.getPort = function getPort ()
{
    return this._port;
};

/**
 * Запуск сервера
 *
 * @param {Function} cb
 *
 * @returns {Server}
 */
Server.prototype.run = function run (cb)
{
    var self = this;

    if (typeof cb !== 'function') cb = function(){};

    this._server
        .addListener('request', this._requestListener)
        .listen(this._port, this._ip, function () {
//            var text = '= Swift server listening on ' + self._ip + ':' + self._port + ' =',
//                line = Array.prototype.map.call(text, function () { return '='; }).join('');

//            console.log(line);
//            console.log(text);
//            console.log(line);
//            console.log('');

            cb(null);
        })
        .on('error', function (err)
        {
            self.emit('error', err);
            cb(new $swiftErrors.SystemError('Ошибка запуска сервера "' + self._ip + ':' + self._port + '" (' + err.message + ').').setInfo(err));
        })
    ;

    this.emit('start', this._server);

    return this;
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

exports.Server = Server;