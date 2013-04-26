/**
 * Created by G@mOBEP
 *
 * Date: 21.04.13
 * Time: 11:59
 */

var $util = require('util'),

    SwiftMvcError = require('./swiftMvcError').SwiftMvcError;

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

function RouterError (message, details)
{
    SwiftMvcError.call(this, 'Application: ' + message, details);
    Error.captureStackTrace(this, arguments.callee);

    this.name = 'swift.mvc:RouterError';
}
$util.inherits(RouterError, SwiftMvcError);

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
// static
//

RouterError.codes = {
    BAD_ALIAS:                      'BAD_ALIAS',
    BAD_MIDDLEWARE:                 'BAD_MIDDLEWARE',
    BAD_PATH_TO_REQUIRE_ROUTES_DIR: 'BAD_PATH_TO_REQUIRE_ROUTES_DIR',
    BAD_ROUTE:                      'BAD_ROUTE',
    BAD_ROUTES:                     'BAD_ROUTES',
    ROUTE_ALREADY_EXISTS:           'ROUTE_ALREADY_EXISTS',
    SYSTEM_ERROR:                   'SYSTEM_ERROR'
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

exports.RouterError = RouterError;