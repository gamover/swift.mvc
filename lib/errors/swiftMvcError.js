/**
 * Created by G@mOBEP
 *
 * Date: 21.04.13
 * Time: 11:37
 */

var $util = require('util');

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

function SwiftMvcError (message, details)
{
    Error.call(this);
    Error.captureStackTrace(this, arguments.callee);

    this.name    = 'SwiftMvcError';
    this.message = 'swift.mvc ' + message;
    this.details = details || null;
    this.code    = null;
}
$util.inherits(SwiftMvcError, Error);

/**
 * Задание сообщения об ошибке
 *
 * @param {String} message сообщение об ошибке
 *
 * @returns {SwiftMvcError}
 */
SwiftMvcError.prototype.setMessage = function setMessage (message)
{
    this.message = message;
    return this;
};

/**
 * Задание деталей
 *
 * @param {*} details детали
 *
 * @returns {SwiftMvcError}
 */
SwiftMvcError.prototype.setDetails = function setMessage (details)
{
    this.details = details;
    return this;
};

/**
 * Задание кода ошибки
 *
 * @param {String} code код ошибки
 *
 * @returns {SwiftMvcError}
 */
SwiftMvcError.prototype.setCode = function setCode (code)
{
    this.code = code;
    return this;
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

exports.SwiftMvcError     = SwiftMvcError;
exports.ApplicationError  = require('./applicationError').ApplicationError;
exports.ConfiguratorError = require('./configuratorError').ConfiguratorError;
exports.RouterError       = require('./routerError').RouterError;
exports.ServerError       = require('./serverError').ServerError;