/**
 * Created by G@mOBEP
 *
 * Date: 21.04.13
 * Time: 11:59
 */

var $util = require('util'),

    SwiftMvcError = require('./swiftMvcError').SwiftMvcError;

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

function ConfiguratorError (message, details)
{
    SwiftMvcError.call(this, 'Application: ' + message, details);
    Error.captureStackTrace(this, arguments.callee);

    this.name = 'swift.mvc:ConfiguratorError';
}
$util.inherits(ConfiguratorError, SwiftMvcError);

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
// static
//

ConfiguratorError.codes = {
    BAD_CONFIG:   'BAD_CONFIG',
    SYSTEM_ERROR: 'SYSTEM_ERROR'
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

exports.ConfiguratorError = ConfiguratorError;