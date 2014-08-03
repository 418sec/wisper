// Wisper Tests


// [ Pragmas ]
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
// [ -Project- ]
var wisper = require('../wisper.js');


// [ Descriptions ]
describe('local pub/sub', function() {
    // vars
    var service;
    // setup/teardown
    beforeEach(function() {
        service = wisper.create_service();
        return null;
    });
    // tests
    it('allows local publish', function(done) {
        expect(service.publish).toBeDefined();
        service.publish({
            'channel': 'foo',
            'message': 'bar'
        }, function(error) {
            expect(error).toBeFalsy();
            done();
            return null;
        });
        return null;
    });
    it('allows local subscribe', function(done) {
        expect(service.subscribe).toBeDefined();
        service.subscribe('foo', function(error) {
            expect(error).toBeFalsy();
            done();
            return null;
        });
        return null;
    });
    it('delivers publications to subscribers', function(done) {
        service.subscribe('foo', function(error) {
            expect(error).toBeFalsy();
            return null;
        });
        service.on('publication', function(publication) {
            expect(publication).toBeTruthy();
            expect(publication.channel).toEqual('foo');
            expect(publication.message).toEqual('bar');
            done();
            return null;
        });
        service.publish({
            'channel': 'foo',
            'message': 'bar'
        }, function(error) {
            expect(error).toBeFalsy();
            return null;
        });
        return null;
    });
    it('honors regex .* subscriptions', function(done) {
        var regex = '.*';
        service.subscribe(regex, function(error) {
            expect(error).toBeFalsy();
            return null;
        });
        service.on('publication', function(publication) {
            expect(publication).toBeTruthy();
            expect(publication.channel).toEqual('foo');
            expect(publication.message).toEqual('bar');
            expect(publication.subscriptions).toEqual([regex]);
            done();
            return null;
        });
        service.publish({
            'channel': 'foo',
            'message': 'bar'
        }, function(error) {
            expect(error).toBeFalsy();
            return null;
        });
        return null;
    });
    it('honors regex ? subscriptions', function(done) {
        var regex = 'f(?:oo)?';
        service.subscribe(regex, function(error) {
            expect(error).toBeFalsy();
            return null;
        });
        service.on('publication', function(publication) {
            expect(publication).toBeTruthy();
            expect(publication.channel).toEqual('foo');
            expect(publication.message).toEqual('bar');
            expect(publication.subscriptions).toEqual([regex]);
            done();
            return null;
        });
        service.publish({
            'channel': 'foo',
            'message': 'bar'
        }, function(error) {
            expect(error).toBeFalsy();
            return null;
        });
        return null;
    });
});
describe('server', function() {
    // vars
    var server;
    // setup/teardown
    beforeEach(function(done) {
        server = wisper.create_server();
        server.listen(8889, function(error) {
            expect(error).toBeFalsy();
            done();
        });
        return null;
    });
    afterEach(function(done) {
        server.close(done);
    });
    // tests
    it('closes down', function(done) {
        done();
    });
});
describe('client', function() {
    // vars
    var server;
    var client;
    // setup/teardown
    beforeEach(function(done) {
        server = wisper.create_server();
        server.listen(8889, function(error) {
            expect(error).toBeFalsy();
            client = wisper.create_client(8889, '127.0.0.1');
            client.on('open', function() {
                done();
            });
        });
        return null;
    });
    afterEach(function(done) {
        client.close();
        server.close(done);
    });
    // tests
    it('closes down', function(done) {
        done();
    });
});
describe('remote pub/sub', function() {
    // vars
    var server;
    var client_1;
    var client_2;
    // setup/teardown
    beforeEach(function(done) {
        server = wisper.create_server();
        server.listen(8889, function(error) {
            expect(error).toBeFalsy();
            client_1 = wisper.create_client(8889, '127.0.0.1');
            client_1.on('open', function() {
                client_2 = wisper.create_client(8889, '127.0.0.1');
                client_2.on('open', done);
            });
        });
        return null;
    });
    afterEach(function(done) {
        client_1.close();
        client_2.close();
        server.close(done);
    });
    // tests
    it('allows remote publish', function(done) {
        expect(client_1.publish).toBeDefined();
        client_1.publish({
            'channel': 'foo',
            'message': 'bar'
        }, function(error) {
            expect(error).toBeFalsy();
            done();
            return null;
        });
        return null;
    });
    it('allows remote subscribe', function(done) {
        expect(client_2.subscribe).toBeDefined();
        client_2.subscribe('foo', function(error) {
            expect(error).toBeFalsy();
            done();
            return null;
        });
        return null;
    });
    it('delivers publications to remote subscribers', function(done) {
        client_2.subscribe('foo', function(error) {
            expect(error).toBeFalsy();
            return null;
        });
        client_2.on('publication', function(publication) {
            expect(publication).toBeTruthy();
            expect(publication.channel).toEqual('foo');
            expect(publication.message).toEqual('bar');
            done();
            return null;
        });
        client_1.publish({
            'channel': 'foo',
            'message': 'bar'
        }, function(error) {
            expect(error).toBeFalsy();
            return null;
        });
        return null;
    });
    it('honors regex .* subscriptions for remote subscribers', function(done) {
        var regex = '.*';
        client_2.subscribe(regex, function(error) {
            expect(error).toBeFalsy();
            return null;
        });
        client_2.on('publication', function(publication) {
            expect(publication).toBeTruthy();
            expect(publication.channel).toEqual('foo');
            expect(publication.message).toEqual('bar');
            expect(publication.subscriptions).toEqual([regex]);
            done();
            return null;
        });
        client_1.publish({
            'channel': 'foo',
            'message': 'bar'
        }, function(error) {
            expect(error).toBeFalsy();
            return null;
        });
        return null;
    });
    it('honors regex ? subscriptions for remote subscribers', function(done) {
        var regex = 'f(?:oo)?';
        client_2.subscribe(regex, function(error) {
            expect(error).toBeFalsy();
            return null;
        });
        client_2.on('publication', function(publication) {
            expect(publication).toBeTruthy();
            expect(publication.channel).toEqual('foo');
            expect(publication.message).toEqual('bar');
            expect(publication.subscriptions).toEqual([regex]);
            done();
            return null;
        });
        client_1.publish({
            'channel': 'foo',
            'message': 'bar'
        }, function(error) {
            expect(error).toBeFalsy();
            return null;
        });
        return null;
    });
    it('delivers publications to all subscribers', function(done) {
        var sync_sources = {1: false, 2: false};
        function sync(x) {
            sync_sources[x] = true;
            if (_.every(sync_sources)) {
                done();
            }
            return null;
        }
        client_2.subscribe('foo', function(error) {
            expect(error).toBeFalsy();
            return null;
        });
        client_2.on('publication', function(publication) {
            expect(publication).toBeTruthy();
            expect(publication.channel).toEqual('foo');
            expect(publication.message).toEqual('bar');
            sync(2);
            return null;
        });
        client_1.subscribe('foo', function(error) {
            expect(error).toBeFalsy();
            return null;
        });
        client_1.on('publication', function(publication) {
            expect(publication).toBeTruthy();
            expect(publication.channel).toEqual('foo');
            expect(publication.message).toEqual('bar');
            sync(1);
            return null;
        });
        client_1.publish({
            'channel': 'foo',
            'message': 'bar'
        }, function(error) {
            expect(error).toBeFalsy();
            return null;
        });
        return null;
    });
    it('delivers publications to only subscribers', function(done) {
        var sync_sources = {1: false, 2: false};
        function sync(x) {
            sync_sources[x] = true;
            if (_.every(sync_sources)) {
                done();
            }
            return null;
        }
        client_2.subscribe('foo', function(error) {
            expect(error).toBeFalsy();
            return null;
        });
        client_2.on('publication', function(publication) {
            expect(publication).toBeTruthy();
            expect(publication.channel).toEqual('foo');
            expect(publication.message).toEqual('bar');
            if (publication.channel == 'baz') {
                throw new Error('got message for channel not subscribed to');
            }
            sync(2);
            return null;
        });
        client_1.subscribe('baz', function(error) {
            expect(error).toBeFalsy();
            return null;
        });
        client_1.on('publication', function(publication) {
            expect(publication).toBeTruthy();
            expect(publication.channel).toEqual('baz');
            expect(publication.message).toEqual('quux');
            if (publication.channel == 'foo') {
                throw new Error('got message for channel not subscribed to');
            }
            sync(1);
            return null;
        });
        client_1.publish({
            'channel': 'foo',
            'message': 'bar'
        }, function(error) {
            expect(error).toBeFalsy();
            return null;
        });
        client_1.publish({
            'channel': 'baz',
            'message': 'quux'
        }, function(error) {
            expect(error).toBeFalsy();
            return null;
        });
        return null;
    });
});
