// Wisper


// [ Pragmas ]
/* jshint globalstrict: true */
'use strict';
/* global require */
/* global exports */
/* global console */


// [ Requires ]
// [ -Node- ]
var events = require('events');
var util = require('util');
var http = require('http');
// [ -Third Party- ]
var _ = require('underscore');
var ws = require('ws');
var bunyan = require('bunyan');


// [ Logging ]
var log = bunyan.createLogger({
    serializers: bunyan.stdSerializers,
    name: 'wisper',
    streams: [{
        path: '/tmp/wisper.log',
        type: 'rotating-file',
        period: '1d',
        count: 3
    }]
});
function trace(level) {
    if (!level) {
        level = 1;
    }
    var original = Error.prepareStackTrace;
    Error.prepareStackTrace = function(e, stack) {
        return stack;
    };
    var error = new Error();
    var stack = error.stack;
    Error.prepareStackTrace = original;
    var frame = stack[level];
    var caller = frame.getFunctionName();
    var file = frame.getFileName();
    var line_no = frame.getLineNumber();
    var type_name;
    try {
        type_name = frame.getTypeName();
    } catch (e) {
        return {
            caller: caller,
            file: file,
            line_no: line_no
        };
    }
    return {
        type_name: type_name,
        caller: caller,
        file: file,
        line_no: line_no
    };
}
function tracetrace() {
    if (log.level() >= bunyan.TRACE) {
        log.trace(trace(2));
    }
}
function debugtrace(arg_obj) {
    if (log.level() >= bunyan.DEBUG) {
        log.debug(trace(2), arg_obj);
    }
}
log.level('debug');


// [ Arg Checking ]
function check_args(arg_obj) {
    for (var prop in arg_obj) {
        if (arg_obj[prop] === undefined) {
            throw new Error("Missing argument: " + prop);
        }
    }
}


// [ Service ]
function Service() {
    debugtrace();
    // [ -Private Vars- ]
    // self is always the service instance
    var self = this;
    //  clients and subscriptions
    var client_profiles = [];

    // [ -Public Funcs, accesses private- ]
    // Publish
    self.publish = function publish(message, channels, callback) {
        debugtrace({
            message: message,
            channels: channels,
        });
        check_args({
            message: message,
            channels: channels,
        });
        // publish the message on all specified channels
        // callback is called when publication is complete.
        // ensure channels is an array
        if (! _.isArray(channels)) {
            channels = [channels];
        }
        // goal is for each client to receive:
        //  - the message
        //  - the channels it was published on
        //  - the regexes subscribed to which matched
        // service should send the message and channels to each client
        // for which any of the client's subscribed regexes match any channel.
        // the client should do any further logic on the message/channels/regexes.
        // for each channel
        _.each(client_profiles, function(profile) {
            tracetrace();
            // do any channels match any regexes?
            var subscription;
            var send = _.some(channels, function(channel) {
                tracetrace();
                // does this channel match any regexes?
                return _.some(profile.regexes, function(regex) {
                    tracetrace();
                    // does this channel match this regex?
                    var match = channel.match(regex);
                    // if so, save the subscription
                    if (match) {
                        subscription = regex.slice(0, regex.length-1);
                    }
                    // return match status
                    return match;
                });
            });
            // if so, then send them
            if (send) {
                profile.client.receive(message, channels, subscription);
            }
        });
        if (callback) callback(null);
        return null;
    };
    // Subscribe
    self.subscribe = function subscribe(client, new_regexes, callback) {
        debugtrace();
        // check if client is in client profiles
        var profile = null;
        for (var i=0; i < client_profiles.length; i++) {
            if (_.isEqual(client, client_profiles[i].client)) {
                profile = client_profiles[i];
                break;
            }
        }
        // if not, add it
        if (!profile) {
            profile = {'client': client, 'regexes': []};
            client_profiles.push(profile);
        }
        // check if regex exists in profile
        _.each(new_regexes, function(new_regex) {
            tracetrace();
            if(!_.contains(profile.regexes, new_regex)) {
                profile.regexes.push(new_regex + '$');
            }
        });
        callback(null);
        return null;
    };
    // Unsubscribe
    self.unsubscribe = function unsubscribe(client, old_regexes, callback) {
        debugtrace();
        // check if client is in client profiles
        var profile = null;
        for (var i=0; i < client_profiles.length; i++) {
            if (_.isEqual(client, client_profiles[i].client)) {
                profile = client_profiles[i];
                break;
            }
        }
        // if so, remove them
        if (profile) {
            // check if regex exists in profile
            _.each(old_regexes, function(old_regex) {
                old_regex = old_regex + '$';
                tracetrace();
                if(_.contains(profile.regexes, old_regex)) {
                    profile.regexes = _.without(profile.regexes, old_regex);
                }
            });
            // check if any regexes, remove profile if not
            if (profile.regexes.length === 0) {
                client_profiles = _.without(client_profiles, profile);
            }
        }
        if (callback) {
            callback(null);
        }
        return null;
    };
}
// complete the inheritance
util.inherits(Service, events.EventEmitter);
// define an explicit creator function
function create_service() {
    debugtrace();
    return new Service();
}


// [ Client ]
function Client(service) {
    debugtrace();
    // [ -Private Vars- ]
    // self is always the service instance
    var self = this;
    // channels subscribed to
    var regexes = [];

    // [ -Inheritance- ]
    events.EventEmitter.call(self);

    // [ -Public, accesses private- ]
    self.subscribe = function subscribe(new_regexes, callback) {
        debugtrace(new_regexes);
        // handle the case where subscribe is called only with
        // a callback
        if (_.isFunction(new_regexes) && !callback) {
            callback = new_regexes;
            new_regexes = ['.*'];
        }
        if (callback === undefined) {
            callback = function() {};
        }
        // make regexes a list if it's not
        if (!_.isArray(new_regexes)) {
            new_regexes = [new_regexes];
        }
        for ( var i=0; i < new_regexes.length; i++) {
            var new_regex = new_regexes[i];
            tracetrace();
            // test regex
            try {
                var regexp = new RegExp(new_regex);
            } catch(e) {
                callback(e);
                return null;
            }
            // check if regex exists in profile
            if(!_.contains(regexes, new_regex)) {
                regexes.push(new_regex);
            }
        }
        service.subscribe(self, new_regexes, callback);
        return null;
    };
    self.publish = service.publish;
    self.receive = function receive(message, channels, subscription) {
        debugtrace({
            message: message,
            channels: channels,
            subscription: subscription
        });
        // receive a message and the channels it was broadcast on.
        // emit the expected signature.
        self.emit('message', message, channels, subscription);
    };
    self.unsubscribe = function unsubscribe(old_regexes, callback) {
        debugtrace(old_regexes);
        // handle the case where subscribe is called only with
        // a callback
        if (_.isFunction(old_regexes) && !callback) {
            callback = old_regexes;
            old_regexes = regexes;
        }
        // make regexes a list if it's not
        if (!_.isArray(old_regexes)) {
            old_regexes = [old_regexes];
        }
        _.each(old_regexes, function(old_regex) {
            tracetrace();
            // check if regex exists in profile
            if(_.contains(regexes, old_regex)) {
                regexes = _.without(regexes, old_regex);
            }
        });
        service.unsubscribe(self, old_regexes, callback);
        return null;
    };
}
// complete the inheritance
util.inherits(Client, events.EventEmitter);
// define an explicit creator function
function create_client(service) {
    debugtrace();
    return new Client(service);
}


// [ Server ]
function Server(service) {
    debugtrace();
    // [ -Private Vars- ]
    // self is always this instance
    var self = this;
    var WSServer = ws.Server;
    var http_server = http.createServer();
    var ws_server = new WSServer({'server': http_server});
    var conns = [];

    ws_server.on('connection', function(conn) {
        tracetrace();
        // add a new client for this conn
        conn.ps_client = create_client(service);
        // add a new app send/recv to conn
        conn.app_send = create_app_send_for(conn);
        // record the conn
        conns.push(conn);
        // send when something is published
        conn.ps_client.on('message', function(message, published_channels, subscription) {
            tracetrace();
            conn.app_send({
                'message': message,
                'p_channels': published_channels,
                's_channel': subscription
            }, function(error) {
                tracetrace();
                if (error) {
                    console.error(error);
                }
            });
        });
        // listen to messages
        conn.on('app_message', function(message, callback) {
            tracetrace();
            // subscribe to this service only.
            if (message.type == 'subscribe') {
                conn.ps_client.subscribe(message.body.new_regexes, function(error) {
                    tracetrace();
                    if (error) {
                        console.error(error);
                    }
                    callback(error);
                });
            // publish to all services
            } else if (message.type == 'publish') {
                conn.ps_client.publish(message.body.message, message.body.channels, function(error) {
                    tracetrace();
                    if (error) {
                        console.error(error);
                    }
                    callback(error);
                });
            // unsubscribe
            } else if (message.type == 'unsubscribe') {
                conn.ps_client.unsubscribe(message.body.old_regexes, function(error) {
                    tracetrace();
                    if (error) {
                        console.error(error);
                    }
                    callback(error);
                });
            }
        });
        // remove service when this conn closes
        conn.on('close', function() {
            tracetrace();
            conn.ps_client.unsubscribe();
        });
    });

    // [ -Public, accesses Private- ]
    // listen on port
    self.listen = http_server.listen.bind(http_server);
    // close the server
    self.close = function close(callback) {
        debugtrace();
        // don't close client connections - it causes a race and a leaked timeout in the server.
        // see issue at https://github.com/einaros/ws/issues/343
        ws_server.close();
        http_server.close(callback);
    };
}
// define an explicit creator function
function create_web_server(service) {
    debugtrace();
    return new Server(service);
}


// [ Client Profile List ]
function ClientProfileList() {
    debugtrace();
    // [ -Private Vars- ]
    // self is always this instance
    var self = this;

    // [ -Public Vars- ]
    self.list = [];

    // [ -Public Func, uses Private- ]
    self.get = function(client) {
        tracetrace();
        var profile = null;
        for (var i=0; i < self.list.length; i++) {
            if (_.isEqual(client, self.list[i].client)) {
                profile = self.list[i];
                break;
            }
        }
        return profile;
    };
}

// [ Remote Callback ]
function create_app_send_for(transport) {
    tracetrace();
    // ID Table
    var table = {};
    // set the getter
    function get_message_id () {
        tracetrace();
        var candidate_id;
        // generate random ID's till the candidate isn't in the table
        do {
            candidate_id = (Math.random() * 100000000000000000).toString(16);
        } while (table[candidate_id]);
        // return it
        return candidate_id;
    }
    // set the deleter
    function retire_message_id (message_id) {
        tracetrace();
        if (table[message_id]) {
            delete table[message_id];
        }
        return null;
    }
    // app send
    // have a single message listener that parses all the messages
    transport.on('message', function(response) {
        tracetrace();
        var parsed = JSON.parse(response);
        var response_id = parsed.response_id;
        if (response_id) {
            var callback = table[response_id];
            if (callback) {
                retire_message_id(response_id);
                callback(parsed.error, parsed.response);
            }
        } else if (parsed.message_id) {
            if (parsed.message_id === 0) {
                // No response requested, and no listener on other end
                transport.emit('app_message', parsed.message, function(error, response, callback) {
                    tracetrace();
                    callback(null, "Warning: no callback was registered by the remote peer." +
                             "  The peer will not be informed of the error or result.");
                });
            } else {
                // Client wants a response
                transport.emit('app_message', parsed.message, function(error, response, callback) {
                    tracetrace();
                    transport.send(JSON.stringify({
                        'response_id': parsed.message_id,
                        'error': error,
                        'response': response
                    }), callback);
                });
            }
        }
        return null;
    });
    function app_send(message, callback) {
        debugtrace(message);
        // unique identifier for this message
        var message_id = get_message_id();
        // register for response
        if (callback) {
            table[message_id] = callback;
        } else {
            message_id = 0;
        }
        // send
        transport.send(JSON.stringify({
            'message_id': message_id,
            'message': message
        }), function(error) {
            tracetrace();
            if (error) {
                retire_message_id(message_id);
                callback(error);
            }
        });
        return function abandon() {
            debugtrace();
            retire_message_id(message_id);
        };
    }
    return app_send;
}


// [ Web Proxy ]
function WebProxy(host, port) {
    debugtrace();
    // [ -Private Vars- ]
    // self is always the service instance
    var self = this;
    //  clients and subscriptions
    var client_profiles = new ClientProfileList();

    // [ -Inheritance- ]
    events.EventEmitter.call(self);

    // [ -Publisher- ]
    var publisher = new ws('ws://' + host + ':' + port);
    publisher.on('error', function(error) {
        tracetrace();
        console.error(host);
        console.error(port);
        console.error(error);
    });
    publisher.on('open', function() {
        tracetrace();
        self.emit('connect');
    });
    publisher.app_send = create_app_send_for(publisher);

    // [ -Public- ]
    self.publish = function publish(message, channels, callback) {
        debugtrace({
            message: message,
            channels: channels
        });
        check_args({
            message: message,
            channels: channels,
        });
        var ws_message = {
            'type': 'publish',
            'body': {
                'message': message,
                'channels': channels
            }
        };
        publisher.app_send(ws_message, function(error) {
            tracetrace();
            if (error) {
                console.error(error);
            }
            callback(error);
        });
    };
    self.subscribe = function subscribe(client, new_regexes, callback) {
        debugtrace();
        // check if client is in profiles
        var message = {
            'type': 'subscribe',
            'body': { 'new_regexes': new_regexes }
        };
        var profile = client_profiles.get(client);
        // if not, add it
        if (!profile) {
            client_profiles.list.push({
                'client': client,
                'ws_client': new ws('ws://' + host + ':' + port)
            });
            profile = client_profiles.get(client);
            profile.ws_client.app_send = create_app_send_for(profile.ws_client);
            // [ -Internal Events- ]
            profile.ws_client.on('app_message', function(message, callback) {
                tracetrace();
                profile.client.receive(message.message, message.p_channels, message.s_channel);
                callback();
                return null;
            });
            profile.ws_client.on('open', function() {
                tracetrace();
                profile.ws_client.app_send(message, callback);
            });
        } else {
            profile.ws_client.app_send(message, callback);
        }
    };
    self.unsubscribe = function unsubscribe(client, old_regexes, callback) {
        debugtrace();
        var message = {
            'type': 'unsubscribe',
            'body': { 'old_regexes': old_regexes }
        };
        var profile = client_profiles.get(client);
        // if not, then there are no subscriptions to remove
        if (!profile) {
            callback('Cannot unsubscribe - this client has not subscribed to anything.');
        } else {
            profile.ws_client.app_send(message, callback);
        }
    };
    self.close = function close() {
        debugtrace();
        publisher.close();
        publisher.terminate();
        for (var i=0; i < client_profiles.list.length; i++) {
            var profile = client_profiles.list[i];
            profile.ws_client.close();
            profile.ws_client.terminate();
        }
    };
}
// complete the inheritance
util.inherits(WebProxy, events.EventEmitter);
// define an explicit creator function
function create_web_proxy(host, port) {
    debugtrace();
    return new WebProxy(host, port);
}


// [ Exports ]
exports.create_service = create_service;
exports.create_client = create_client;
exports.create_web_server = create_web_server;
exports.create_web_proxy = create_web_proxy;
