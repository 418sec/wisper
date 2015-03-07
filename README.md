#wisper

regex pub/sub

---

**WARNING**:  This project is in alpha.  To be clear, that means I haven't asked anyone else to use it yet - the only testing it has is internal.

**ANOTHER WARNING**:  It should be clear from the version, but this project is not stable.  At the moment, I make no guarantees about API or features.  I know what I intend, but a lot can happen in early development.

---

#Use

Here is a series of functions showing use, distilled from the tests.  The tests (in the `spec` directory) showcase more advanced use.

```javascript
var wisper = require('../wisper');
var hub = wisper.createHub();
var client = wisper.createClient();
var pattern = '^p.*$';

function listenOnHub(cb) {
    // set up hub
    hub.listen({port:8080}, cb);
}

function connectClient(cb) {
    // connect client to hub
    client.connect('http://127.0.0.1:8080', cb);
}

function subscribeClient(cb) {
    // subscribe client to p.*
    client.subscribe(pattern, cb);
}

function publishPublic(cb) {
    var messageToPublish = "is anyone out there?";
    var channelToPublishOn = "public";
    client.once('message', function checkMessage(message, channel, match) {
        // message is a json message
        // channel is the channel published on
        // match is the first pattern the hub thinks the client is subscribed to which matched the channel
        cb();
    });
    client.publish(messageToPublish, channelToPublishOn);
}

function unsubscribe(cb) {
    client.unsubscribe('^p.*$', cb);
}

function closeHub(cb) {
    hub.on('close', cb);
    hub.close();
}

function failToPublish(cb) {
    var messageToPublish = "is anyone out there?";
    var channelToPublishOn = "public";
    // expect client not to get message on channel and match
    client.once('message', function checkMessage(message, channel, match) {
        throw new VError("should never get here");
    });
    // expect the following to throw an exception for publishing on a closed client
    // the client will have become closed when the hub was closed.
    client1.publish(messageToPublish, channelToPublishOn, cb);
}
```

# API

For now, see the source for the API.  It's pretty well documented there.
