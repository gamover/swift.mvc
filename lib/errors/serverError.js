/**
 * Created by G@mOBEP
 *
 * Date: 21.04.13
 * Time: 11:59
 */

var $util = require('util'),

    SwiftMvcError = require('./swiftMvcError').SwiftMvcError;

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

function ServerError (message, details)
{
    SwiftMvcError.call(this, 'Application: ' + message, details);
    Error.captureStackTrace(this, arguments.callee);

    this.name = 'swift.mvc:ServerError';
}
$util.inherits(ServerError, SwiftMvcError);

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
// static
//

ServerError.codes = {
    BAD_IP:               'BAD_IP',
    BAD_PORT:             'BAD_PORT',
    BAD_REQUEST_LISTENER: 'BAD_REQUEST_LISTENER',
    RUN_SERVER_ERROR:     'RUN_SERVER_ERROR',
    SYSTEM_ERROR:         'SYSTEM_ERROR'
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

exports.ServerError = ServerError;