// Wisper


// [ Pragmas ]
'use strict';
/* global require */
/* global exports */


// [ Requires ]
// [ -Node- ]
var events = require('events');
var util = require('util');
// [ -Third Party- ]
var _ = require('underscore');


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
        if (_.some(subscriptions, function(subscription) {
            return channel.match(subscription);
        })) {
            self.emit('publication', {
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

// [ Exports ]
exports.create_service = create_service;
