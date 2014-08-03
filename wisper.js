// Wisper


// [ Pragmas ]
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


// [ Service ]
function Service() {
    // [ -Private Vars- ]
    // self is always the service instance
    var self = this;
    // channels subscribed to
    var subscriptions = [];

    // [ -Inheritance- ]
    events.EventEmitter.call(self);

    // [ -Public- ]
    self.publish = function publish(kwargs, callback) {
        var channel = kwargs.channel;
        var message = kwargs.message;
        var matching_subs = _.filter(subscriptions, function(subscription) {
            return channel.match(subscription);
        });
        if (matching_subs.length) {
            self.emit('publication', {
                'subscriptions': matching_subs,
                'channel': channel,
                'message': message
            });
        }
        callback(null);
        return null;
    };
    self.subscribe = function subscribe(channel, callback) {
        if (!_.contains(subscriptions, channel)) {
            subscriptions.push(channel);
        }
        callback(null);
        return null;
    };
}
// complete the inheritance
util.inherits(Service, events.EventEmitter);
// define an explicit creator function
function create_service() {
    return new Service();
}


// [ Server ]
function Server() {
    // [ -Private Vars- ]
    // self is always the service instance
    var self = this;
    var WSServer = ws.Server;
    var http_server = http.createServer();
    var ws_server = new WSServer({'server': http_server});
    var services = [];
    var conns = [];

    ws_server.on('connection', function(conn) {
        // record the conn
        conns.push(conn);
        // get a service for this client
        conn.service = create_service();
        // add it to the overall list for the server
        services.push(conn.service);
        // send when something is published
        conn.service.on('publication', function(publication) {
            conn.send(JSON.stringify(publication));
        });
        // listen to messages
        conn.on('message', function(message) {
            var json_message = JSON.parse(message);
            // subscribe to this service only.
            if (json_message.type == 'subscribe') {
                conn.service.subscribe(json_message.body.channel, function(error) {
                    if (error) {
                        console.error(error);
                    }
                });
            // publish to all services
            } else if (json_message.type == 'publish') {
                _.each(services, function(service) {
                    service.publish(json_message.body, function(error) {
                        if (error) {
                            console.error(error);
                        }
                    });
                });
            }
        });
        // remove service when this conn closes
        conn.on('close', function() {
            var index = services.indexOf(conn.service);
            services.splice(index, 1);
            index = conns.indexOf(conn);
            conns.splice(index, 1);
        });
    });

    // [ -Public, accesses Private- ]
    // listen on port
    self.listen = http_server.listen.bind(http_server);
    // close the server
    self.close = function close(callback) {
        // don't close client connections - it causes a race and a leaked timeout in the server.
        // see issue at https://github.com/einaros/ws/issues/343
        ws_server.close();
        http_server.close(callback);
    };
}
// define an explicit creator function
function create_server() {
    return new Server();
}


// [ Client ]
function Client(port, host) {
    // [ -Private Vars- ]
    // self is always the service instance
    var self = this;
    var services = [];
    var ws_client = new ws('ws://' + host + ':' + port);

    // [ -Inheritance- ]
    events.EventEmitter.call(self);

    ws_client.on('message', function(message) {
        self.emit('publication', JSON.parse(message));
    });
    ws_client.on('open', function() {
        self.emit('open');
    });

    // [ -Public- ]
    self.publish = function publish(kwargs, callback) {
        var message = {
            'type': 'publish',
            'body': kwargs
        };
        ws_client.send(JSON.stringify(message), callback);
    };
    self.subscribe = function subscribe(channel, callback) {
        var message = {
            'type': 'subscribe',
            'body': { 'channel': channel }
        };
        ws_client.send(JSON.stringify(message), callback);
    };
    self.close = function close() {
        ws_client.close();
        ws_client.terminate();
    };
}
// complete the inheritance
util.inherits(Client, events.EventEmitter);
// define an explicit creator function
function create_client(port, host) {
    return new Client(port, host);
}


// [ Exports ]
exports.create_service = create_service;
exports.create_server = create_server;
exports.create_client = create_client;
