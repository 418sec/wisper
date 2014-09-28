// Wisper Tests


// [ Pragmas ]
/* jshint globalstrict: true */
'use strict';
/* global require */
/* global describe */
/* global it */
/* global beforeEach */
/* global afterEach */
/* global expect */
/* global console */
/* global xit */
/* global xdescribe */


// [ Requires ]
// [ -Third Party- ]
var _ = require('underscore');
var async = require('async');
// [ -Project- ]
var wisper = require('../wisper.js');


// [ Test Complexity ]
//  - number of pubs
//  - number of subs
//  - regex vs simple
//  - number of matches
//  - number of clients
//  - web client/server
//
// [ Helpers ]
// reusable vars
var service, local_client, client_2;
var web_proxy, web_server, web_client, web_client_2;
var sub_foo, pub_foo;
var pub_bar;
var sub_foo_regex;
var pub_foo_2;
var on_foo, on_foo_regex;
var web_pub_foo, web_sub_foo, web_pub_foo_2, web_pub_foo_list;
var web_pub_bar, web_pub_baz;
var web_sub_foo_regex, web_sub_foo_regex_2, web_sub_list;
var web_sub_all;
var web_on_foo_regex, web_on_foo_regex_2, web_on_foo_regex_list, web_on_bar;
var web_on_foo_star, web_on_bar_star;
// misc vars
var host_ip = '127.0.0.1';
var host_port = 8084;
var foo_message = 'foo-message';
var foo_channel = 'foo-channel';
var foo_list = ['foo-channel'];
var bar_channel = 'bar-channel';
var baz_channel = 'baz-channel';
var foo_regex_channel = 'foo.*-channel';
// Builders
function get_sub(client, channel) {
    expect(client.subscribe).toBeDefined();
    return async.apply(client.subscribe, channel);
}
function get_pub(client, message, channel) {
    expect(client.publish).toBeDefined();
    return async.apply(client.publish, message, channel);
}
function get_on(client, message, p_channels, s_channel) {
    return function(done) {
        expect(client.on).toBeDefined();
        client.on('message', function(m, p, s) {
            if (m == message) {
                expect(m).toEqual(message);
                expect(p).toEqual(p_channels);
                expect(s).toEqual(s_channel);
                done();
            }
        });
    };
}
// Global setup
beforeEach(function() {
    // Servers/clients/proxies
    service = wisper.create_service();
    local_client = wisper.create_client(service);
    client_2 = wisper.create_client(service);
    // Pub/subs
    sub_foo = get_sub(local_client, foo_channel);
    pub_foo = get_pub(local_client, foo_message, foo_channel);
    pub_bar = get_pub(local_client, 'bar-message', bar_channel);
    sub_foo_regex = get_sub(local_client, foo_regex_channel);
    pub_foo_2 = get_pub(client_2, foo_message, foo_channel);
    on_foo = get_on(local_client, foo_message, foo_list, foo_channel);
    on_foo_regex = get_on(local_client, foo_message, foo_list, foo_regex_channel);
});
// pubsub
function simple_pub_sub(sub_f, pub_f, on_f, done) {
    // register with client for messages
    on_f(done);
    // subscribe and publish so that we get a message
    async.series([
        sub_f,
        pub_f,
    ], function(error) {
        expect(error).toBeFalsy();
        return null;
    });
    return null;
}
function mult_or_simul_limit(type, on_fs, pub_fs) {
    if (type == 'multi') {
        return on_fs.length * pub_fs.length;
    } else if (type == 'simul') {
        return on_fs.length;
    } else {
        return -1;
    }
}
function mult_or_simul_pub_sub(type) {
    return function(sub_fs, pub_fs, on_fs, done) {
        // register with client for messages
        var limit = mult_or_simul_limit(type, on_fs, pub_fs);
        var received = 0;
        _.each(on_fs, function(on_f) {
            on_f(function(error) {
                expect(error).toBeFalsy();
                received += 1;
                if (received == limit) {
                    done();
                }
                return null;
            });
            return null;
        });
        // subscribe and publish so that we get a message
        async.eachSeries(_.flatten([sub_fs, pub_fs]), function(func, callback) {
            func(callback);
            return null;
        }, function(error) {
            expect(error).toBeFalsy();
            return null;
        });
        return null;
    };
}
var multi_pub_sub = mult_or_simul_pub_sub('multi');
var simul_pub_sub = mult_or_simul_pub_sub('simul');
//
// [ Tests ]
// [ -Simple- ]
describe('simple use', function() {
// publish to one channel
    it('allows publish', function(done) {
        pub_foo(function(error) {
            expect(error).toBeFalsy();
            done();
            return null;
        });
        return null;
    });
// subscribe to one channel
    it('allows subscribe', function(done) {
        sub_foo(function(error) {
            expect(error).toBeFalsy();
            done();
            return null;
        });
        return null;
    });
// receive a message
    it('sends a message from publisher to subscriber', function(done) {
        simple_pub_sub(sub_foo, pub_foo, on_foo, done);
        return null;
    });
// unsubscribe from a channel
    it('allows unsubscribe', function(done) {
        expect(local_client.unsubscribe).toBeDefined();
        // register with client for messages
        var bar_count = 0;
        local_client.on('message', function(message, p_channels, s_channel) {
            if (s_channel == bar_channel) {
                bar_count +=1;
                expect(bar_count).toEqual(1);
            } else {
                expect(message).toEqual(foo_message);
                expect(p_channels).toEqual(foo_list);
                expect(s_channel).toEqual(foo_channel);
                done();
            }
        });
        // subscribe and publish so that we get a message
        async.series([
            async.apply(local_client.subscribe, bar_channel),
            pub_bar,
            async.apply(local_client.unsubscribe, bar_channel),
            pub_bar,
            sub_foo,
            pub_foo,
        ], function(error) {
            expect(error).toBeFalsy();
            return null;
        });
    });
// subscribe with a regex
    it('allows regex subscription', function(done) {
        simple_pub_sub(sub_foo_regex, pub_foo, on_foo_regex, done);
        return null;
    });
// pub/sub from different clients
    it('allows regex subscription', function(done) {
        simple_pub_sub(sub_foo_regex, pub_foo_2, on_foo_regex, done);
        return null;
    });
});
function before_web(done) {
    // Servers/clients/proxies
    web_server = wisper.create_web_server(service);
    web_server.listen(host_port, function() {
        web_proxy = wisper.create_web_proxy(host_ip, host_port);
        web_proxy.on('connect', function() {
            var foo_channel_list = ['foo-channel', 'food-channel', 'foot-channel'];
            web_client = wisper.create_client(web_proxy);
            web_client_2 = wisper.create_client(web_proxy);
            // Pub/subs
            web_pub_foo = get_pub(web_client, 'foo-message', 'foo-channel');
            web_pub_foo_2 = get_pub(web_client_2, 'foo-message', 'foo-channel');
            web_pub_foo_list = get_pub(web_client_2, 'foo-message', foo_channel_list);
            web_pub_bar = get_pub(web_client, 'bar-message', 'bar-channel');
            web_pub_baz = get_pub(web_client, 'baz-message', 'baz-channel');
            web_sub_foo = get_sub(web_client, 'foo-channel');
            web_sub_foo_regex = get_sub(web_client, 'foo.*-channel');
            web_sub_foo_regex_2 = get_sub(web_client_2, 'foo.*-channel');
            web_sub_list = get_sub(web_client, ['foo.*-channel', 'bar-channel']);
            web_sub_all = web_client.subscribe;
            web_on_foo_regex = get_on(web_client, 'foo-message', ['foo-channel'], 'foo.*-channel');
            web_on_bar = get_on(web_client, 'bar-message', ['bar-channel'], 'bar-channel');
            web_on_bar_star = get_on(web_client, 'bar-message', ['bar-channel'], '.*');
            web_on_foo_star = get_on(web_client, 'foo-message', ['foo-channel'], '.*');
            web_on_foo_regex_list = get_on(web_client, 'foo-message', foo_channel_list, 'foo.*-channel');
            web_on_foo_regex_2 = get_on(web_client_2, 'foo-message', ['foo-channel'], 'foo.*-channel');
            done();
        });
    });
}
function after_web() {
    web_proxy.close();
    web_server.close();
}
// [ -Simple Web- ]
describe('simple web use', function() {
    beforeEach(before_web);
    afterEach(after_web);
// pub over web
    it('allows pub over the web', function(done) {
        // attach server to service
        simple_pub_sub(sub_foo_regex, web_pub_foo, on_foo_regex, done);
    });
// sub over web
    it('allows sub over the web', function(done) {
        // attach server to service
        simple_pub_sub(web_sub_foo_regex, pub_foo, web_on_foo_regex, done);
    });
// messages to/from web
    it('allows pub/sub over the web', function(done) {
        // attach server to service
        simple_pub_sub(web_sub_foo_regex, web_pub_foo, web_on_foo_regex, done);
    });
// unsubscribe from a channel
    it('allows web unsubscribe', function(done) {
        expect(web_client.unsubscribe).toBeDefined();
        // register with client for messages
        var bar_count = 0;
        web_client.on('message', function(message, p_channels, s_channel) {
            if (s_channel == bar_channel) {
                bar_count +=1;
                expect(bar_count).toEqual(1);
            } else {
                expect(message).toEqual(foo_message);
                expect(p_channels).toEqual(foo_list);
                expect(s_channel).toEqual(foo_channel);
                done();
            }
        });
        // subscribe and publish so that we get a message
        async.series([
            async.apply(web_client.subscribe, bar_channel),
            web_pub_bar,
            async.apply(web_client.unsubscribe, bar_channel),
            web_pub_bar,
            web_sub_foo,
            web_pub_foo,
        ], function(error) {
            expect(error).toBeFalsy();
            return null;
        });
    });
// subscribe with a regex
    it('allows web regex subscription', function(done) {
        simple_pub_sub(web_sub_foo_regex, web_pub_foo, web_on_foo_regex, done);
        return null;
    });
// pub/sub from different clients
    it('allows regex subscription', function(done) {
        simple_pub_sub(web_sub_foo_regex, web_pub_foo_2, web_on_foo_regex, done);
        return null;
    });
});
// [ -Clients- ]
describe("multiple clients", function() {
    beforeEach(before_web);
    afterEach(after_web);
// multiple publishers
    it('can publish to single subscriber', function(done) {
        multi_pub_sub([web_sub_foo_regex],[web_pub_foo, web_pub_foo_2], [web_on_foo_regex], done);
        return null;
    });
// multiple subscribers
    it('can support multiple subscriptions to single publisher', function(done) {
        multi_pub_sub([web_sub_foo_regex, web_sub_foo_regex_2],[web_pub_foo], [web_on_foo_regex, web_on_foo_regex_2], done);
        return null;
    });
});
// [ -Channels- ]
describe("channel functionality", function() {
    beforeEach(before_web);
    afterEach(after_web);
// publish simultaneously
    it('allows simultaneous publishing', function(done) {
        simple_pub_sub(web_sub_foo_regex, web_pub_foo_list, web_on_foo_regex_list, done);
        return null;
    });
// subscribe simultaneously
    it('allows simultaneous subscription', function(done) {
        simul_pub_sub([web_sub_list],[web_pub_foo, web_pub_bar], [web_on_foo_regex, web_on_bar], done);
        return null;
    });
// subscribe all
    it('allows subscribe to all', function(done) {
        simul_pub_sub([web_sub_all] ,[web_pub_foo, web_pub_bar], [web_on_foo_star, web_on_bar_star], done);
        return null;
    });
// unsubscribe simultaneously
    it('allows simultaneous unsubscription', function(done) {
        var bar_count = 0;
        var foo_count = 0;
        web_client.on('message', function(message, p_channels, s_channel) {
            if (s_channel == bar_channel) {
                bar_count +=1;
                expect(bar_count).toEqual(1);
            }
            if (s_channel == foo_channel) {
                foo_count +=1;
                expect(foo_count).toEqual(1);
            }
            if (s_channel == baz_channel) {
                done();
            }
        });
        async.series([
            async.apply(web_client.subscribe, [foo_channel, bar_channel]),
            web_pub_foo,
            web_pub_bar,
            async.apply(web_client.unsubscribe, [foo_channel, bar_channel]),
            web_pub_foo,
            web_pub_bar,
            async.apply(web_client.subscribe, [baz_channel]),
            web_pub_baz,
        ], function(error) {
            expect(error).toBeFalsy();
        });
        return null;
    });
// unsubscribe all
    it('allows unsubscription from all', function(done) {
        var bar_count = 0;
        var foo_count = 0;
        web_client.on('message', function(message, p_channels, s_channel) {
            if (s_channel == bar_channel) {
                bar_count +=1;
                expect(bar_count).toEqual(1);
            }
            if (s_channel == foo_channel) {
                foo_count +=1;
                expect(foo_count).toEqual(1);
            }
            if (s_channel == baz_channel) {
                done();
            }
        });
        async.series([
            async.apply(web_client.subscribe, [foo_channel, bar_channel]),
            web_pub_foo,
            web_pub_bar,
            async.apply(web_client.unsubscribe),
            web_pub_foo,
            web_pub_bar,
            async.apply(web_client.subscribe, [baz_channel]),
            web_pub_baz,
        ], function(error) {
            expect(error).toBeFalsy();
        });
        return null;
    });
});
// [ -Combos- ]
// multi pub/sub simul
// multi pub/sub m:n
// multi pub/sub mixed
// multi pub/sub mixed over web
// [ -Negative- ]
describe("negative tests", function() {
    beforeEach(before_web);
    afterEach(after_web);
// missing args
    it('disallows missing args', function() {
        var on_empty, on_message;
        var pub_empty, pub_message;
        var web_pub_empty, web_pub_message;
        try {
            web_client.on();
        } catch (e) {
            on_empty = true;
        }
        expect(on_empty).toBeTruthy();
        try {
            web_client.on('foo');
        } catch (e) {
            on_message = true;
        }
        expect(on_message).toBeTruthy();
        try {
            web_client.publish();
        } catch (e) {
            web_pub_empty = true;
        }
        expect(web_pub_empty).toBeTruthy();
        try {
            web_client.publish('foo');
        } catch (e) {
            web_pub_message = true;
        }
        expect(web_pub_message).toBeTruthy();
        try {
            local_client.publish();
        } catch (e) {
            pub_empty = true;
        }
        expect(pub_empty).toBeTruthy();
        try {
            local_client.publish('foo');
        } catch (e) {
            pub_message = true;
        }
        expect(pub_message).toBeTruthy();
    });
// bad regex
    it('fails with bad regexes', function(done) {
        web_client.subscribe('(abc', function(error) {
            expect(error).toBeTruthy();
            done();
        });
    });
// automatically terminate regexes
    it('automatically terminates regexes', function(done) {
        var foo_channel_5 = foo_channel + '-5';
        local_client.on('message', function(message, p_channels, s_channel) {
            expect(p_channels).not.toContain(foo_channel_5);
            done();
        });
        // subscribe and publish so that we get a message
        async.series([
            async.apply(local_client.subscribe, foo_channel),
            async.apply(local_client.publish, 'foo-message-5', foo_channel_5),
            async.apply(local_client.publish, 'foo-message', foo_channel),
        ], function(error) {
            expect(error).toBeFalsy();
            return null;
        });
    });
});

var host_ip = '127.0.0.1';
var host_port = 8084;
var service;
var server;
var proxy;
var client;

// Bugs (escapes)
describe('wisper web-proxy subscription', function() {
    beforeEach(function(setup_callback) {
        // setup
        host_ip = '127.0.0.1';
        host_port = 8084;
        service = wisper.create_service();
        server = wisper.create_web_server(service);
        server.listen(host_port, function() {
            proxy = wisper.create_web_proxy(host_ip, host_port);
            client = wisper.create_client(proxy);
            proxy.once('connect', setup_callback);
        });
    });
    afterEach(function () {
        client.unsubscribe();
        proxy.close();
        server.close();
        service = null;
        server = null;
        proxy = null;
        client = null;
    });
    it('does not fire a connect event', function(done) {
        // test
        var connect_event_caught = false;
        proxy.on('connect', function() { connect_event_caught = true; });
        client.subscribe('foo', function() {
            expect(connect_event_caught).toBeFalsy();
            done();
        });
    });
});
