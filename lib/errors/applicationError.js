/**
 * Created by G@mOBEP
 *
 * Date: 21.04.13
 * Time: 11:59
 */

var $util = require('util'),

    SwiftMvcError = require('./swiftMvcError').SwiftMvcError;

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

function ApplicationError (message, details)
{
    SwiftMvcError.call(this, 'Application: ' + message, details);
    Error.captureStackTrace(this, arguments.callee);

    this.name = 'swift.mvc:ApplicationError';
}
$util.inherits(ApplicationError, SwiftMvcError);

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
// static
//

ApplicationError.codes = {
    BAD_PATH_TO_APPLICATION_CONFIG:    'BAD_PATH_TO_APPLICATION_CONFIG',
    APPLICATION_CONFIG_FILE_NOT_FOUND: 'APPLICATION_CONFIG_FILE_NOT_FOUND',
    APPLICATION_ALREADY_INIT:          'APPLICATION_ALREADY_INIT',
    APPLICATION_ALREADY_RUNNING:       'APPLICATION_ALREADY_RUNNING',
    APPLICATION_NOT_INIT:              'APPLICATION_NOT_INIT',
    SYSTEM_ERROR:                      'SYSTEM_ERROR'
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

exports.ApplicationError = ApplicationError;