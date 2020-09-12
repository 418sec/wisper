// Wisper


// [ Pragmas ]
/* jshint globalstrict: true */
'use strict';
/* global require */
/* global exports */
/* global console */
/* global process */
/* global setImmediate */


// [ Requires ]
// [ -Node- ]
var events = require('events');
var util = require('util');
var http = require('http');
var assert = require('assert');
// [ -Third Party- ]
var _ = require('underscore');
var ws = require('ws');
var bunyan = require('bunyan');
var VError = require('verror');
var async = require('async');
var uniqueFilename = require('unique-filename')
const os = require('os');
const fs = require('fs');


// [ Logging ]
var logfile = '/tmp/wisper.log'
try {
  var logStat = fs.lstatSync(logfile);
  if (logStat.isSymbolicLink()){
    logfile = uniqueFilename(os.tmpdir(),'wisper')+'.log';
    console.log('Default log file is a symbolik link, a random one will be used instead -> ', logfile)
  }
} catch(err) {
  console.log(err)
}
var log = bunyan.createLogger({
    serializers: bunyan.stdSerializers,
    name: 'wisper',
    streams: [{
        path: logfile,
        type: 'rotating-file',
        period: '1d',
        count: 3,
        level: "debug",
    }]
});


// [ Object Validation ]
function validateProperties(object, name, required, optional) {
    // validates object properties exist or not
    var properties = _.keys(object);
    var missing = _.difference(required, properties);
    var extra = _.difference(properties, required, optional);
    var errorOrNull = null;
    if (missing.length) {
        errorOrNull = new VError("%s is missing required properties (%j)",
                               name, missing);
        errorOrNull.missing = missing;
        errorOrNull.required = required;
        errorOrNull.object = object;
    } else if (extra.length) {
        errorOrNull = new VError("%s has extra (unexpected) properties (%j)",
                               name, extra);
        errorOrNull.extra = extra;
        errorOrNull.required = required;
        errorOrNull.optional = optional;
        errorOrNull.object = object;
    }
    return errorOrNull;
}


//log.info = console.error.bind(console, "info: ");
//log.debug = console.error.bind(console, "debug: ");


// [ Optional CB ]
function callback(unknown) {
    // returns the cb if a cb
    // returns a noop function if undefined
    // throws an error if neither
    // -------------------------
    // assume it is a function to be returned
    var returnFunction = unknown;
    // check if it's undefined
    if (unknown === undefined) {
        // if it is, replace it with a noop function
        returnFunction = _.noop;
    // otherwise, check if it's a function
    } else if (!_.isFunction(unknown)) {
        // if not a function and not undefined, something
        // is unexpected, programmatically.
        var error = new VError("Defined object passed as a callback is not a function");
        error.object = unknown;
        throw error;
    }
    // get here if either it was a function in the first place
    // or was undefined and we defined it.  Return the function.
    return returnFunction;
}


// [ Hub ]
// create the hub type
function createHubType() {
    log.info("create hub");
    // [ -Events- ]
    // error - emitted when received messages are poorly formatted
    // listen - emitted when listening
    // close - emitted when the hub is closed
    // status - various hub status updates
    // [ -Constructor- ]
    function Hub() {
        log.info("instantiate hub");
        // get non-ambiguous this
        var self = this;
        // Call parent constructor
        Hub.super_.call(self);
        // Internal structures
        self._subscribers = {};
        // subsribers is { source._id: {'source': source, patterns: [pattern*]}}
        self._transport = undefined;
        self._closed = false;
        // state listeners
        self.once('close', function handleClosed() {
            self._closed = true;
        });
        // Constructor.  Return undefined.
        return undefined;
    }
    // [ -Inheritance- ]
    util.inherits(Hub, events.EventEmitter);
    // [ -Private API- ]
    // disconnect a client
    Hub.prototype._disconnectClient = function hubDisconnectClient(client, error, cb) {
        client.close(cb);
        setImmediate(this.emit.bind(this), 'status', "closed client connection", error);
        this.emit('error', error);
        // allow chaining
        return this;
    };
    // handle publication request
    Hub.prototype._handlePublication = function hubHandlePublication(source, messageObj) {
        log.info("hub on publication");
        // get a non-ambiguous "this"
        var self = this;
        var error = validateProperties(
            messageObj,
            "publication message from transport layer",
            ['type', 'message', 'channel', 'transactionID'],
            []
        );
        if (error) { self._disconnectClient(source, error); return null; }
        // FIXME message should be JSON
        // FIXME channel should be regex
        self._distribute(messageObj.message, messageObj.channel, function distributeCB(numPublished) {
            // notify source of publication and number published
            source.send({
                type: 'published',
                'message': messageObj.message,
                channel: messageObj.channel,
                number: numPublished,
                transactionID: messageObj.transactionID,
            }, function onError(error) {
                if (error) { self._disconnectClient(source, error); }
            });
        });
        // allow chaining
        return this;
    };
    // handle subscription request
    Hub.prototype._handleSubscription = function hubHandleSubscription(source, messageObj) {
        log.info("hub on subscription");
        // get a non-ambiguous "this"
        var self = this;
        var error = validateProperties(
            messageObj,
            "subscription message from transport layer",
            ['type', 'pattern', 'transactionID'],
            []
        );
        if (error) { self._disconnectClient(source, error); return null; }
        // FIXME - pattern should be a regex
        var subscriber = self._subscribers[source._id];
        if (subscriber === undefined) {
            subscriber = {
                patterns: [],
                connection: source,
            };
            log.debug("number of unique subscribers: ", _.keys(self._subscribers).length + 1);
        }
        if (!_.contains(subscriber.patterns, messageObj.pattern)) {
            subscriber.patterns.push(messageObj.pattern);
        }
        self._subscribers[source._id] = subscriber;
        // notify source that subscription is in place
        source.send({
            type: 'subscribed',
            pattern: messageObj.pattern,
            number: subscriber.patterns.length,
            transactionID: messageObj.transactionID,
        }, function onError(error) {
            if (error) { self._disconnectClient(source, error); }
        });
        // allow chaining
        return this;
    };
    // handle unsubscription request
    Hub.prototype._handleUnsubscription = function hubHandleUnsubscription(source, messageObj) {
        log.info("hub on unsubscription");
        // get a non-ambiguous "this"
        var self = this;
        var error = validateProperties(
            messageObj,
            "unsubscription message from transport layer",
            ['type', 'pattern', 'transactionID'],
            []
        );
        if (error) { self._disconnectClient(source, error); return null; }
        // FIXME - pattern should be a regex
        var subscriber = self._subscribers[source._id];
        var numPatterns = 0;
        if (subscriber && _.contains(subscriber.patterns, messageObj.pattern)) {
            subscriber.patterns = _.without(subscriber.patterns, messageObj.pattern);
            if (subscriber.patterns.length === 0) {
                delete self._subscribers[source._id];
                log.debug("number of unique subscribers: ", _.keys(self._subscribers).length);
            } else {
                numPatterns = subscriber.patterns.length;
            }
        }
        // notify source that unsubscription occurred
        source.send({
            type: 'unsubscribed',
            pattern: messageObj.pattern,
            number: numPatterns,
            transactionID: messageObj.transactionID,
        }, function onError(error) {
            if (error) { self._disconnectClient(source, error); }
        });
        // allow chaining
        return this;
    };
    // unsubscribe a dead client
    Hub.prototype._unsubscribeFromAll = function hubUnsubscribeFromAll(source) {
        log.info("hub _unsubscribeFromAll", source);
        if (_.contains(_.keys(this._subscribers)), source._id) {
            delete this._subscribers[source._id];
            this.emit('status', "client disconnected", source._id);
        }
        // allow chaining
        return this;
    };
    // handle messages from clients
    Hub.prototype._handleMessage = function hubHandleMessage(source, messageObj) {
        log.info("hub handle message", messageObj);
        // parse the message type and respond accordingly
        if (!messageObj.type) {
            var noTypeError = new VError("Message from transport layer has no type (%j)", messageObj);
            this._disconnectClient(source, noTypeError);
        } else if (messageObj.type == "publication") {
            this._handlePublication(source, messageObj);
        } else if (messageObj.type == "subscription") {
            this._handleSubscription(source, messageObj);
        } else if (messageObj.type == "unsubscription") {
            this._handleUnsubscription(source, messageObj);
        } else {
            var badTypeError = new VError("Unrecognized message type from transport layer: %s. (%j)", messageObj.type, messageObj);
            this._disconnectClient(source, badTypeError);
        }
        // allow chaining
        return this;
    };
    // distribute a message to subscribers
    Hub.prototype._distribute = function hubDistribute(message, channel, cb) {
        // distribute a message on a channel to subscribers
        // get a non-ambiguous "this"
        var self = this;
        // new message object for distribution to clients
        var newMessageObj = {
            type: 'distribution',
            'message': message,
            'channel': channel,
        };
        // send to each subscriber
        var numPublished = 0;
        var match;
        var matchPattern = function matchPattern(pattern) {
            // closure for match.
            // returns true/false for match test, and also sets
            // the matching pattern
            match = pattern;
            return channel.match(pattern);
        };
        async.eachSeries(_.keys(self._subscribers), function distribute(subscriberId, eachCB) {
            // error response
            var subscriber = self._subscribers[subscriberId];
            if (_.any(subscriber.patterns, matchPattern)) {
                newMessageObj.match = match;
                subscriber.connection.send(newMessageObj, function sendError(error) {
                    log.debug('hub sent to client (%j)', newMessageObj);
                    // close the client conn on error.
                    if (error) {
                        self._disconnectClient(subscriber.connection, error, eachCB);
                    } else {
                        numPublished++;
                        eachCB();
                    }
                    return null;
                });
            } else {
                eachCB();
            }
            return null;
        }, function eachFinal() {
            // errors here would come from disconnectClient, which calls
            // the cb when the client is closed.
            // Client.close does not report an error on close.
            callback(cb)(numPublished);
            return null;
        });
        return this;
    };
    // [ -Public API- ]
    // close a transport object
    Hub.prototype.close = function hubClose(cb) {
        log.info("hub close");
        if (this._closed) {
            throw new VError("Hub has already been closed");
        }
        // add cb to listeners
        if (cb) {
            this.on('close', cb);
        }
        this._transport.close();
        // it doesn't make sense to do anything with the object after this,
        // so return null
        return null;
    };
    // listen for connections
    Hub.prototype.listen = function hubListen(options, cb) {
        log.info("hub listen");
        // non-ambiguous self
        var self = this;
        // FIXME - deal with options better - ask for url/http explicitly?
        // only allow this to be called once on the object
        if (self._transport) {
            // throw immediately - this is programmer error
            throw new VError("'listen' has already been called on this hub.");
        }
        // add cb to listeners
        if (cb) {
            self.on('listening', cb);
        }
        // set transport
        self._transport = new ActualTransportServer();
        // proxy events
        self._transport.on('listening', self.emit.bind(self, 'listening'));
        self._transport.on('close', self.emit.bind(self, 'close'));
        // handle client actions
        self._transport.on('client closed', self._unsubscribeFromAll.bind(self));
        self._transport.on('message', self._handleMessage.bind(self));
        // handle transport actions
        self._transport.on('error', function handleTransportError() {
            // FIXME need a test for this
            // FIXME need some notice - either a propagated error event or a reason for the close
            self.close();
        });
        // listen
        self._transport.listen(options);
        // it doesn't make sense to do anything with the object until listen
        // calls back, so return null
        return null;
    };
    // return a new Hub
    return Hub;
}
var ActualHub = createHubType();


// [ Client ]
// create the client type
function createClientType() {
    log.info("create client");
    // [ -Events- ]
    // error - when there's a problem with a received message
    // open - when the connection is open
    // close - when the connection is closed
    // message - when there's a message from the hub
    // [ -Constructor- ]
    function Client() {
        log.info("instantiate client");
        // get non-ambiguous this
        var self = this;
        // Call parent constructor
        Client.super_.call(self);
        // Internal structures
        self._transport = undefined;
        self._txRegistry = {};
        self._lastTxId = 0;
        self._txLimit = 1000;
        self._state = "NOT_OPENED";
        self._messageDispatch = {
            distribution: self._handleDistribution.bind(self),
            published: self._handlePublication.bind(self),
            subscribed: self._handleSubscription.bind(self),
            unsubscribed: self._handleUnsubscription.bind(self),
        };
        // state listeners
        self.once("open", function handleOpened() {
            self._state = "OPEN";
        }).once("close", function handleClosed() {
            self._state = "CLOSED";
        });
        // constructor - return undefined
        return undefined;
    }
    // [ -Inheritance- ]
    util.inherits(Client, events.EventEmitter);
    // [ -Private API- ]
    // check state for OPEN
    Client.prototype._checkState = function clientCheckState() {
        if (this._state !== "OPEN") {
            throw new VError("Nonsensical to call before 'open' or after 'close' events");
        }
        return this;
    };
    // get a transaction ID
    Client.prototype._getTxID = function clientGetTxID() {
        var txid;
        // try the last txid + 1 first
        var candidate = this._lastTxId + 1;
        // try to get a txid until we get one, or we've failed _txLimit times
        // (this means we have _txLimit txid's already assigned)
        var tries = 0;
        while (txid === undefined && tries < this._txLimit) {
            tries++;
            candidate %= this._txLimit;
            if (this._txRegistry[candidate] === undefined) {
                txid = candidate;
            } else {
                candidate++;
            }
        }
        // catch the error exit
        if (txid === undefined) {
            throw new VError("Cannot issue a transaction ID - too many outstanding transactions (%d)", this._txLimit);
        }
        // set the last txid and return it to the caller
        this._lastTxId = txid;
        return txid;
    };
    // register a transaction ID
    Client.prototype._registerTxID = function clientRegisterTxID(txid, cb) {
        this._txRegistry[txid] = cb;
        // allow chaining
        return this;
    };
    // retire a transaction ID
    Client.prototype._retireTxID = function clientRetireTxID(txid) {
        delete this._txRegistry[txid];
        // allow chaining
        return this;
    };
    // handle publication message
    Client.prototype._handlePublication = function clientHandlePublication(messageObj) {
        log.info("client handle publication");
        // validate message
        var error = validateProperties(
            messageObj,
           "published message from transport layer",
           ['type', 'message', 'channel', 'number', 'transactionID'],
           []
        );
        // FIXME - message should be JSON
        // FIXME - channel should be string
        // FIXME - number should be a number
        // FIXME - txid should be number
        // FIXME - need a test for no tx callback (on purpose)
        if (error) { this.emit('error', error); return null; }
        var transactionCallback = this._txRegistry[messageObj.transactionID];
        if (transactionCallback) {
            transactionCallback(null, messageObj.message, messageObj.channel, messageObj.number);
            this._retireTxID(messageObj.transactionID);
        } else {
            this.emit('error', new VError("received a message with an unrecognized transaction ID: %j", messageObj));
        }
        // allow chaining
        return this;
    };
    // handle subscription message
    Client.prototype._handleSubscription = function clientHandleSubscription(messageObj) {
        log.info("client on subscribed");
        var error = validateProperties(
            messageObj,
           "subscribed message from transport layer",
           ['type', 'pattern', 'number', 'transactionID'],
           []
        );
        // FIXME - pattern should be regex
        // FIXME - number should be a number
        if (error) { this.emit('error', error); return null; }
        var transactionCallback = this._txRegistry[messageObj.transactionID];
        if (transactionCallback) {
            log.debug("calling tx callback with", messageObj.pattern, messageObj.number);
            transactionCallback(null, messageObj.pattern, messageObj.number);
            this._retireTxID(messageObj.transactionID);
        } else {
            this.emit('error', new VError("received a message with an unrecognized transaction ID: %j", messageObj));
        }
        // allow chaining
        return this;
    };
    // handle unsubscription message
    Client.prototype._handleUnsubscription = function clientHandleUnsubscription(messageObj) {
        log.info("client on unsubscribed");
        var error = validateProperties(
            messageObj,
           "unsubscribed message from transport layer",
           ['type', 'pattern', 'number', 'transactionID'],
           []
        );
        // FIXME - pattern should be regex
        // FIXME - number should be a number
        if (error) { this.emit('error', error); return null; }
        var transactionCallback = this._txRegistry[messageObj.transactionID];
        if (transactionCallback) {
            transactionCallback(null, messageObj.pattern, messageObj.number);
            this._retireTxID(messageObj.transactionID);
        } else {
            this.emit('error', new VError("received a message with an unrecognized transaction ID: %j", messageObj));
        }
        // allow chaining
        return this;
    };
    // handle distributions
    Client.prototype._handleDistribution = function clientDistribute(messageObj) {
        log.info("client on distribution");
        var error = validateProperties(
            messageObj,
           "distribution message from transport layer",
           ['type', 'message', 'channel', 'match'],
           []
        );
        // FIXME - message should be JSON
        // FIXME - channel should be string
        // FIXME - match should be a regex
        if (error) { this.emit('error', error); return null; }
        this.emit('message', messageObj.message, messageObj.channel, messageObj.match);
        // allow chaining
        return this;
    };
    // handle messages from the transport layer
    Client.prototype._handleMessage = function clientHandleMessage(messageObj) {
        log.info("client handle message", this._id, messageObj);
        // parse the message type and respond accordingly
        var handler = this._messageDispatch[messageObj.type];
        if (handler === undefined) {
            this.emit('error', new VError("No dispatcher found for message type (%s) (%j)", messageObj.type, messageObj));
        } else {
            handler(messageObj);
        }
        // allow chaining
        return this;
    };
    // [ -Public API- ]
    // get/set the limit for the max number of client-initiated
    // transactions in flight simultaneously
    Client.prototype.txLimit = function clientTxLimit(limit) {
        if (limit) {
            this._txLimit = limit;
        }
        return this._txLimit;
    };
    // subscribe a subscriber
    Client.prototype.subscribe = function clientSubscribe(pattern, cb) {
        log.info("client subscribe", this._transport._id, pattern);
        // get a non-ambiguous "this"
        var self = this;
        // check state
        this._checkState();
        // get a transaction id
        var txid;
        try {
            txid = self._getTxID();
        } catch (e) {
            callback(cb)(new VError(e, "cannot subscribe - no transaction ID available."));
            // early return because we don't want to execute anything else,
            // and js has no try/catch/else
            return self;
        }
        self._registerTxID(txid, callback(cb));
        // send subscription request
        self._transport.send({
            type: 'subscription',
            'pattern': pattern,
            transactionID: txid,
        }, function handleCompletion(error) {
            // if there's an error, need to retire the TXID early.
            // assumes a send error means the message was not sent,
            // and there's not going to be a corresponding response.
            if (error) {
                self._retireTxID(txid);
                cb(error);
            }
            return null;
        });
        // allow chaining of calls
        return self;
    };
    // unsubscribe a pattern
    Client.prototype.unsubscribe = function clientUnsubscribe(pattern, cb) {
        log.info("client unsubscribe", this._transport._id, pattern);
        // get a non-ambiguous "this"
        var self = this;
        // check state
        this._checkState();
        // get a transaction id
        var txid;
        try {
            txid = self._getTxID();
        } catch (e) {
            callback(cb)(new VError(e, "cannot unsubscribe - no transaction ID available."));
            return self;
        }
        self._registerTxID(txid, callback(cb));
        // send unsubscription request
        self._transport.send({
            type: 'unsubscription',
            'pattern': pattern,
            transactionID: txid,
        }, function handleCompletion(error) {
            // if there's an error, need to retire the TXID early.
            // assumes a send error means the message was not sent,
            // and there's not going to be a corresponding response.
            if (error) {
                self._retireTxID(txid);
                callback(cb)(error);
            }
            return null;
        });
        // allow chaining
        return self;
    };
    // publish to subscribers
    Client.prototype.publish = function clientPublish(message, channel, cb) {
        log.info("client publish", this._transport._id, message);
        var self = this;
        // check state
        this._checkState();
        // get a transaction id
        var txid;
        try {
            txid = self._getTxID();
        } catch (e) {
            callback(cb)(new VError(e, "cannot publish - no transaction ID available."));
            return self;
        }
        self._registerTxID(txid, callback(cb));
        // send publication request
        self._transport.send({
            type: 'publication',
            'message': message,
            'channel': channel,
            transactionID: txid,
        }, function handleCompletion(error) {
            // if there's an error, need to retire the TXID early.
            // assumes a send error means the message was not sent,
            // and there's not going to be a corresponding response.
            if (error) {
                self._retireTxID(txid);
                callback(cb)(new VError(error, "Error sending to hub"));
            }
            return null;
        });
        // allow chaining
        return self;
    };
    // close a transport object
    Client.prototype.close = function clientClose() {
        log.info("client close");
        if (this._state !== "OPEN") {
            throw new VError("Cannot close a client which is not open");
        }
        this._transport.close();
        // it doesn't make sense to do anything with the object after this,
        // so return null
        return null;
    };
    // connect to listening client
    Client.prototype.connect = function clientConnect(url, cb) {
        log.info("client connect");
        // only allow this to be called once on the object
        if (this._transport) {
            // throw immediately - this is programmer error
            throw new VError("'connect' has already been called on this client.");
        }
        // add cb to listeners
        if (cb) {
            this.on('open', cb);
        }
        // open a new transport connection
        this._transport = new ActualTransportClient();
        this._transport.connect(url);
        // proxy some events
        this._transport.on('open', this.emit.bind(this, 'open'));
        this._transport.on('close', this.emit.bind(this, 'close'));
        // handle messages from transport
        this._transport.on('message', this._handleMessage.bind(this));
        // it doesn't make sense to do anything with the object until connect
        // calls back, so return null
        return null;
    };
    // return a new Client
    return Client;
}
var ActualClient = createClientType();


// [ Transport Server ]
// create server type
function createTransportServerType() {
    log.info("create transport server type");
    // [ -Events- ]
    // message - a message with transport client source
    // client closed - emitted when a client is closed, with the client
    // close - emitted when the transport is closed
    // error - emitted when the underlying ws has an error
    // listening - emitted when the server is listening
    // [ -Constructor- ]
    function TransportServer() {
        log.info("instantiate transport server");
        // get non-ambiguous this
        var self = this;
        // Call parent constructor
        TransportServer.super_.call(self);
        // Internal structures
        self._ws = undefined;
        self._id = _.uniqueId();
        self._closed = false;
        // state listeners
        self.once('close', function handleClosed() {
            self._closed = true;
        });
        // constructor. return undefined
        return undefined;
    }
    // [ -Inheritance- ]
    util.inherits(TransportServer, events.EventEmitter);
    // [ -Private API- ]
    TransportServer.prototype._handleConnection = function transportServerHandleConnection(wsc) {
        log.info("Transport server handle connection");
        // create a source with send/close
        var source = new ActualTransportClient();
        source.wrap(wsc);
        // proxy events
        source.on('message', this.emit.bind(this, 'message', source));
        source.on('close', this.emit.bind(this, 'client closed', source));
        // Higher layers don't currently need any insight.  If a source
        // has an error, just close it.
        source.on('error', function handleError() {
            source.close();
        });
        // allow chaining
        return this;
    };
    // [ -Public API- ]
    // listen for remote websocket connections
    TransportServer.prototype.listen = function websocketListen(options, cb) {
        log.info("websocket server listen");
        // only allow this to be called once on the object
        if (this._ws) {
            // throw immediately - this is programmer error
            throw new VError("'listen' has already been called on this transport object.");
        }
        // add cb to listeners
        if (cb) {
            this.on('listening', cb);
        }
        // set up websocket server
        this._ws = new ws.Server(options);
        // proxy some events
        // FIXME - be intentional about what errors are passed up
        // at each stage
        this._ws.on('listening', this.emit.bind(this, 'listening'));
        this._ws.on('error', this.emit.bind(this, 'error'));
        this._ws._server.on('close', this.emit.bind(this, 'close'));
        // handle connections from clients
        this._ws.on('connection', this._handleConnection.bind(this));
        // it doesn't make sense to do anything with the object until listen
        // calls back, so return null
        return null;
    };
    // close connection(s)
    TransportServer.prototype.close = function websocketClose() {
        log.info("websocket close");
        if (this._closed) {
            throw new VError("Transport Server has already been closed");
        }
        this._ws.close();
        // it doesn't make sense to do anything with the object
        // after close, so return null
        return null;
    };
    return TransportServer;
}
var ActualTransportServer = createTransportServerType();


// [ Transport Client ]
// create websocket type
function createTransportClientType() {
    log.info("create websocket");
    // [ -Events- ]
    // open - when the transport is open
    // close - when transport is closed
    // message - when transport receives a JSON message
    // [ -Constructor- ]
    function TransportClient() {
        log.info("instantiate websocket");
        // get non-ambiguous this
        var self = this;
        // Call parent constructor
        TransportClient.super_.call(self);
        // Internal structures
        self._ws = undefined;
        self._id = _.uniqueId(); // debugging tool only
        self._state = "NOT_OPENED";
        // state listeners
        self.once("open", function handleOpened() {
            self._state = "OPEN";
        }).once("close", function handleClosed() {
            self._state = "CLOSED";
        });
        // constructor - return undefined
        return undefined;
    }
    // [ -Inheritance- ]
    util.inherits(TransportClient, events.EventEmitter);
    // [ -Private API- ]
    // handle a received message
    // emits 'message' with a JSON argument
    TransportClient.prototype._handleMessage = function transportClientHandleMessage(message, flags) {
        log.info("websocket on message");
        // binay messages are not supported
        if (flags.binary) {
            var error = new VError("Got binary message from remote hub (not supported).");
            error.hubMessage = message;
            // emit error because this occurred asynchronously, and not necessarily due to user or local
            // programmer error
            this.emit('error', error);
        } else {
            // try to structure the message
            var structured;
            try {
                structured = JSON.parse(message);
            } catch (e) {
                var error = new VError(e, "cannot parse message from remote hub as JSON");
                error.hubMessage = message;
                // emit error because this occurred asynchronously, and not necessarily due to user or local
                // programmer error
                this.emit('error', error);
                // need to return here, because js has no try/catch/else,
                // and we don't want to continue after this error.
                return null;
            }
            // else - a non-binary well-formatted JSON message
            this.emit("message", structured);
        }
        // allow chaining
        return this;
    };
    // proxy events from the websocket
    TransportClient.prototype._proxyEvents = function transportClientProxyEvents() {
        this._ws.on('open', this.emit.bind(this, 'open'));
        this._ws.on('close', this.emit.bind(this, 'close'));
        this._ws.on('error', this.emit.bind(this, 'error'));
        // handle messages from remote hub
        this._ws.on("message", this._handleMessage.bind(this));
        // allow chaining
        return this;
    };
    // [ -Public API- ]
    // connect to a remote websocket hub
    // callback is called when the client is connected to the hub
    TransportClient.prototype.connect = function transportClientConnect(url, cb) {
        log.info("websocket client connect");
        // only allow this to be called once on the object
        if (this._ws) {
            // throw immediately - this is programmer error
            throw new VError("'connect' has already been called on this transport object.");
        }
        // add cb to listeners
        if (cb) {
            this.on('open', cb);
        }
        // open a websocket connection
        this._ws = new ws(url);
        // proxy some events
        this._proxyEvents();
        // it doesn't make sense to do anything with the object until connect
        // calls back, so return null
        return null;
    };
    // wrap a websocket conn in a Transport Client
    TransportClient.prototype.wrap = function transportClientWrap(websocketConnection) {
        log.info("websocket client wrap");
        var wsc = websocketConnection;
        // only allow this to be called once on the object
        if (this._ws) {
            // throw immediately - this is programmer error
            throw new VError("'connect' has already been called on this transport object.");
        }
        // theoretically the connection is already open
        this._ws = wsc;
        if (this._ws.readyState === ws.OPEN) {
            this._state = "OPEN";
        } else {
            var error = new VError("must only wrap websockets which are OPEN");
            error.state = ws.readyState;
            throw error;
        }
        // proxy some events
        this._proxyEvents();
        // allow chaining
        return this;
    };
    // close connection
    TransportClient.prototype.close = function transportClientClose() {
        log.info("websocket close");
        if (this._state !== "OPEN") {
            throw new VError("Cannot close a client which is not open");
        }
        this._ws.close();
        // it doesn't make sense to do anything with the object
        // after close, so return null
        return null;
    };
    // send to remote websocket
    TransportClient.prototype.send = function transportClientSend(message, cb) {
        log.info("websocket send", message);
        if (this._state !== "OPEN") {
            throw new VError("Nonsensical to call before 'open' or after 'close' events");
        }
        var stringified;
        try {
            stringified = JSON.stringify(message);
        } catch (e) {
            // do not use the cb to emit - this is a programmer error - throw immediately
            var error = new VError(e, "could not stringify JSON message");
            error.jsonMessage = message;
            throw error;
        }
        log.debug("stringified: ", stringified);
        // explicitly check state, because the ws module has bad
        // internal behavior if the socket is closing when you try
        // to send a message. see https://github.com/websockets/ws/issues/366
        if (this._ws.readyState === ws.OPEN) {
            this._ws.send(stringified, cb);
        } else {
            // throw - this is a programming error (sending while ws in bad state)
            throw new VError("The client connection is not open.  Cannot send.");
        }
        // allow chaining
        return this;
    };
    return TransportClient;
}
var ActualTransportClient = createTransportClientType();


// [ Exports ]
exports.createHub = function createHub() { return new ActualHub(); };
exports.createClient = function createClient() { return new ActualClient(); };
