/**
 * Author: G@mOBEP
 * Date: 03.03.13
 * Time: 12:29
 */

var $http = require('http'),

    ServerError = require('./errors/serverError').ServerError;

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

function Server ()
{
    /**
     * Слушатель запросов
     *
     * @type {Object}
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

/**
 * Задание слушателя запросов
 *
 * @param {Object} requestListener слушатель запросов
 *
 * @returns {Server}
 */
Server.prototype.setRequestListener = function setRequestListener (requestListener)
{
    if (typeof requestListener !== 'function')
        throw new ServerError()
            .setMessage('Не удалось задать слушателя запросов. Слушатель запросов не передан или представлен в недопустимом формате')
            .setCode(ServerError.codes.BAD_REQUEST_LISTENER);

    this._requestListener = requestListener;

    return this;
};

/**
 * Получение слушателя запросов
 *
 * @returns {Object}
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
    if (typeof ip !== 'string' || !ip.match(/^(?:\d{1,3}\.){3}\d{1,3}$/))
        throw new ServerError()
            .setMessage('Не удалось задать ip. Ip не передан или представлен в недопустимом формате')
            .setCode(ServerError.codes.BAD_IP);

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
    if (!(port + '').match(/^\d+$/))
        throw new ServerError()
            .setMessage('Не удалось задать порт. Порт не передан или представлен в недопустимом формате')
            .setCode(ServerError.codes.BAD_PORT);

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
    var self = this,
        server;

    cb = cb || function(){};

    server = $http.createServer(self._requestListener).listen(self._port, self._ip, function () {
//        var text = '= Swift server listening on ' + self._ip + ':' + self._port + ' =',
//            line = Array.prototype.map.call(text, function () { return '='; }).join('');

//        console.log(line);
//        console.log(text);
//        console.log(line);
//        console.log('');

        cb(null);
    });

    server.on('error', function (err)
    {
        cb(new ServerError()
            .setMessage('не удалось запустить сервер (' + self._ip + ':' + self._port + ') (ответ node: ' + err.message + ')')
            .setDetails(err)
            .setCode(ServerError.codes.RUN_SERVER_ERROR));
    });

    return self;
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

exports.Server = Server;