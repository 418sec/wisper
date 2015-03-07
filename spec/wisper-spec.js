// Wisper Tests


// [ Pragmas ]
/* jshint globalstrict: true */
'use strict';
/* global require */
/* global setTimeout */
/* global setInterval */
/* global describe */
/* global it */
/* global beforeEach */
/* global afterEach */
/* global expect */
/* global console */
/* global xit */
/* global xdescribe */
/* global clearInterval */


// [ Requires ]
// [ -Node- ]
var util = require('util');
// [ -Third Party- ]
var _ = require('underscore');
var async = require('async');
var VError = require('verror');
// [ -Project- ]
var wisper = require('../wisper.js');


// [ Global setup ]
var hub;
var client1;
var client2;
beforeEach(function() {
    hub = wisper.createHub();
    client1 = wisper.createClient();
    client2 = wisper.createClient();
});


// [ Tests ]
describe('Wisper', function() {
    var wisper = require('../wisper');
    var initialPatterns = ['^p.*$', '^.*lic$'];
    function listenOnHub(cb) {
        testLog(">>>listenOnHub");
        // set up hub
        hub.listen({port:8080}, cb);
    }
    function connectClients(cb) {
        testLog(">>>connectClients");
        // connect clients to hub
        async.each([client1, client2], function connectClient(client, innerCb) {
            testLog("connectClient");
            client.connect('http://127.0.0.1:8080', innerCb);
        }, cb);
    }
    function subscribeClients(cb) {
        testLog(">>>subscribeClients");
        // subscribe clients to p.*, .*lic
        async.eachSeries(initialPatterns, function subscribePatterns(pattern, patternCB) {
            async.each([client1, client2], function subscribeClient(client, clientCB) {
                client.subscribe(pattern, function subscribed(error, p) {
                    testLog("got subscribed", p);
                    expect(p).toEqual(pattern);
                    clientCB(error);
                });
            }, patternCB);
        }, cb);
    }
    function closeHub(cb) {
        testLog(">>>close hub");
        hub.on('close', cb);
        hub.close();
    }
    //var testLog = console.error.bind(console, 'test: %s');
    var testLog = _.noop;
    it('does pub/sub', function(done) {
        async.series([
            listenOnHub,
            connectClients,
            subscribeClients,
            function publishPublicC1(cb) {
                testLog(">>>publishPublicC1");
                var messageToPublish = "is anyone out there?";
                var channelToPublishOn = "public";
                // actually only call cb after 3 calls - one for each client message and once for
                // finishing the series below.
                var moveOn = _.after(3, cb);
                async.series([
                    function expectMessages(seriesCB) {
                        testLog("expectMessages");
                        // expect both clients to get message on channel and match
                        async.each([client1, client2], function expectMessage(client, eachCB) {
                            client.once('message', function checkMessage(message, channel, match) {
                                expect(message).toEqual(messageToPublish);
                                expect(channel).toEqual(channelToPublishOn);
                                expect(initialPatterns).toContain(match);
                                testLog("got message", message, channel, match);
                                moveOn();
                            });
                            eachCB();
                        }, seriesCB);
                    },
                    function publishPublic(seriesCB) {
                        testLog("publishPublic");
                        // publish to public from c1
                        client1.publish(messageToPublish, channelToPublishOn, seriesCB);
                    },
                ], function seriesFinal(error) {
                    if (error) {
                        cb(error);
                    } else {
                        moveOn();
                    }
                });
            },
            function publishPrivateC2(cb) {
                var messageToPublish = "I'm here";
                var channelToPublishOn = "private";
                // actually only call cb after 3 calls - one for each client message and once for
                // finishing the series below.
                var moveOn = _.after(3, cb);
                async.series([
                    function(seriesCB) {
                        // expect both clients to get message on channel and match
                        async.each([client1, client2], function expectMessage(client, eachCB) {
                            client.once('message', function checkMessage(message, channel, match) {
                                expect(message).toEqual(messageToPublish);
                                expect(channel).toEqual(channelToPublishOn);
                                expect(initialPatterns).toContain(match);
                                moveOn();
                            });
                            eachCB();
                        }, seriesCB);
                    },
                    function(seriesCB) {
                        // publish to private from c2
                        client2.publish(messageToPublish, channelToPublishOn, seriesCB);
                    },
                ], function seriesFinal(error) {
                    if (error) {
                        cb(error);
                    } else {
                        moveOn();
                    }
                });
            },
            closeHub,
        ], function final(error) {
            expect(error).toEqual(null);
            done();
        });
    });
    it('allows unsubscribe', function(done) {
        async.series([
            listenOnHub,
            connectClients,
            subscribeClients,
            function unsubscribeC2(cb) {
                testLog('unsubscribe2');
                // unsubscribe c2 from .*lic
                client2.unsubscribe('^.*lic$', function(error, pattern) {
                    // TODO - what happens if I unsubscribe from a pattern not subscribed to? Should be an error.
                    // TODO - need a way for hub to relay errors to clients
                    expect(pattern).toEqual('^.*lic$');
                    cb(error);
                });
            },
            function publishNotPublicC2(cb) {
                testLog('>>>publishNotPublicC2');
                // TODO - api for asking for your subscriptions
                var messageToPublish = "I'm not listening";
                var channelToPublishOn = "not-public";
                var messageToPublishPublicly = "I'm still on public";
                var publicChannel = "public";
                // actually only call cb after 4 calls - one for each client message and once for
                // finishing the series below.
                var moveOn = _.after(4, cb);
                async.series([
                    function(seriesCB) {
                        // expect c1 to get message on channel and match
                        client1.once('message', function checkMessage(message, channel, match) {
                            testLog("client 1 got message", message, channel);
                            expect(message).toEqual(messageToPublish);
                            expect(channel).toEqual(channelToPublishOn);
                            expect(initialPatterns).toContain(match);
                            moveOn();
                        });
                        seriesCB();
                    },
                    function(seriesCB) {
                        // expect c2 to get the next message on public
                        client2.once('message', function checkMessage(message, channel, match) {
                            testLog("client 2 got message", message, channel);
                            expect(message).toEqual(messageToPublishPublicly);
                            expect(channel).toEqual(publicChannel);
                            expect(match).toEqual('^p.*$');
                            moveOn();
                        });
                        seriesCB();
                    },
                    function(seriesCB) {
                        // publish on not-public from c2
                        client2.publish(messageToPublish, channelToPublishOn, function(error, message, channel) {
                            expect(message).toEqual(messageToPublish);
                            expect(channel).toEqual(channelToPublishOn);
                            seriesCB(error);
                        });
                    },
                    function(seriesCB) {
                        // expect c1 to get message on public, like c2 does
                        client1.once('message', function checkMessage(message, channel, match) {
                            testLog("client 1 got message", message, channel);
                            expect(message).toEqual(messageToPublishPublicly);
                            expect(channel).toEqual(publicChannel);
                            expect(initialPatterns).toContain(match);
                            moveOn();
                        });
                        seriesCB();
                    },
                    function(seriesCB) {
                        // publish on not-public from c2
                        client2.publish(messageToPublishPublicly, publicChannel, seriesCB);
                    },
                ], function seriesFinal(error) {
                    if (error) {
                        cb(error);
                    } else {
                        moveOn();
                    }
                });
            },
            function publishNotPublicAtAllC2(cb) {
                testLog(">>>publish not public at all c2");
                var messageToPublish = "Nobody's listening";
                var channelToPublishOn = "not-public-at-all";
                var messageToPublishPrivately = "We're still on private";
                var privateChannel = "private";
                // actually only call cb after 3 calls - one for each client message and once for
                // finishing the series below.
                var moveOn = _.after(3, cb);
                async.series([
                    function(seriesCB) {
                        // expect clients to get message on private channel
                        async.each([client1, client2], function expectMessage(client, eachCB) {
                            // expect client to get message on channel and match
                            client.once('message', function checkMessage(message, channel, match) {
                                testLog('client got message', client._transport._id, message, channel, match);
                                expect(message).toEqual(messageToPublishPrivately);
                                expect(channel).toEqual(privateChannel);
                                expect(match).toEqual('^p.*$');
                                moveOn();
                            });
                            eachCB();
                        }, seriesCB);
                    },
                    function(seriesCB) {
                        // publish on not-public-at-all from c2
                        client2.publish(messageToPublish, channelToPublishOn, seriesCB);
                    },
                    function(seriesCB) {
                        // publish on private from c2
                        client2.publish(messageToPublishPrivately, privateChannel, seriesCB);
                    },
                ], function seriesFinal(error) {
                    if (error) {
                        cb(error);
                    } else {
                        moveOn();
                    }
                });
            },
            closeHub,
        ], function final(error) {
            expect(error).toEqual(null);
            done();
        });
    });
    it('gracefully allows a client to close', function(done) {
        async.series([
            listenOnHub,
            connectClients,
            subscribeClients,
            function closeC2(cb) {
                testLog(">>>close C2");
                client2.on('close', function() {
                    testLog("c2 closed");
                    cb();
                });
                client2.close();
            },
            function publishPrivateC1(cb) {
                testLog(">>>publish private C1");
                var messageToPublish = "is anyone out there?";
                var channelToPublishOn = "public";
                // actually only call cb after 2 calls - one for client 1 and once for
                // finishing the series below.
                var moveOn = _.after(2, cb);
                async.series([
                    function(seriesCB) {
                        // expect client1 to get message on channel and match
                        client1.once('message', function checkMessage(message, channel, match) {
                            testLog("client got message", client1._transport._id, message, channel);
                            expect(message).toEqual(messageToPublish);
                            expect(channel).toEqual(channelToPublishOn);
                            expect(initialPatterns).toContain(match);
                            moveOn();
                        });
                        seriesCB();
                    },
                    function(seriesCB) {
                        // expect client2 not to get message on channel and match
                        client2.once('message', function checkMessage(message, channel, match) {
                            throw new VError("should never get here");
                        });
                        seriesCB();
                    },
                    function(seriesCB) {
                        // publish to public from c1
                        client1.publish(messageToPublish, channelToPublishOn, seriesCB);
                    },
                    // implied - no errors on hub trying to publish to C2
                ], function seriesFinal(error) {
                    if (error) {
                        cb(error);
                    } else {
                        moveOn();
                    }
                });
            },
            closeHub,
        ], function final(error) {
            expect(error).toEqual(null);
            done();
        });
    });
    it('fails to publish to a closed hub', function(done) {
        async.series([
            listenOnHub,
            connectClients,
            subscribeClients,
            closeHub,
            function failToPublishC1(cb) {
                testLog(">>>fail to publish c1");
                var messageToPublish = "is anyone out there?";
                var channelToPublishOn = "public";
                // expect client1 not to get message on channel and match
                client1.once('message', function checkMessage(message, channel, match) {
                    throw new VError("should never get here");
                });
                expect(function shouldThrow() {
                    client1.publish(messageToPublish, channelToPublishOn, cb);
                }).toThrow();
                cb();
            },
            function closeC1(cb) {
                testLog(">>>close client 1");
                // Should already be closed
                client1.on('close', function shouldNotGetHere () {
                    throw new VError("should never get here");
                });
                expect(function shouldThrow() {
                    client1.close();
                }).toThrow();
                cb();
            }
        ], function final(error) {
            expect(error).toEqual(null);
            done();
        });
    });
    // TODO - add test for error publications
    // TODO - add test for # subscribers response on publication
    // TODO - add test for status update on new client connection
});
