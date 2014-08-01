// Wisper Tests


// [ Pragmas ]
'use strict';
/* global require */
/* global describe */
/* global it */
/* global beforeEach */
/* global expect */


// [ Requires ]
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
        service.subscribe('.*', function(error) {
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
    it('honors regex ? subscriptions', function(done) {
        service.subscribe('f(?:oo)?', function(error) {
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
});
