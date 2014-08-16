wisper
======

minimalist websocket pub/sub with regex subscriptions

---

**WARNING**:  This project is in alpha.  To be clear, that means I haven't asked anyone else to use it yet - the only testing it has is internal.

**ANOTHER WARNING**:  It should be clear from the version, but this project is not stable.  At the moment, I make no guarantees about API or features.  I know what I intend, but a lot can happen in early development.

**FINAL WARNING**:  please don’t actually try to use this yet.  wait for version 1.0.  this is very much proof of concept and likely to be quite buggy.  API's are likely to switch out from underneath you.  Documentation will probably suck.

**JUST ENOUGH ROPE**:  If you want to mess with this anyway, having read all the above, `npm install wisper` will do the trick.  `npm test wisper` will run the automated tests.  If you find problems or missing features, feel free to submit issues and pull requests.

---

What is wisper?
---
Wisper is, as the subtitle above says, a minimalist websocket pub/sub with regex subscriptions:

* *Minimalist* -  The goal is to do as little as possible in this module while still making it simple to use.  It's not code golf.  It's not the minimum viable feature set.  If I can better formulate what I mean by "simple to use" I'll update this text.
* *Websocket* -  It uses websockets for the underlying communication.
* *Pub/Sub* -  Publish/subscribe
* *Regex subscriptions* -  Subscribe to channels via regex!

There are three main entities in the core of `wisper`:

1. The `service`, which manages subscriptions and distributes published messages to the appropriate subscribers. All local interactions are with a `service`, which handles any and all websocket communication with remote peer `service`s.
2. The `subscriber`, which subscribes to channels on both local and remote `service`s.
3. The `publisher`, which publishes to both local and remote `service`s .


How do you use it?
---
The general flow of events for a simple use case goes like this:

1. A `subscriber` prepares to receive messages.
2. The `subscriber` then subscribes to a channel on a `service`.
3. A `publisher` asks the `service` to publish a message on a channel.
4. The `service` determines which subscribers to send the message to and does so.
5. The `subscriber` receives the message and does something with it.

In code, that's:

```
// Get wisper
var wisper = require('wisper');

// Get service and subscriber
var service = wisper.create_service();
var subscriber = wisper.create_subscriber();
var publisher = wisper.create_publisher();

// Prepare to receive messages
subscriber.on('message', function respond_to(message, published_channels, subscribed_channels, service) {
	console.log(message);  // The published message.
	console.log(published_channels);
	// The channels published on.
	// If a message is published on multiple channels, and the subscriber is subscribed to 
	// more than one of them, the subscriber only receives the message once, and is given
	// a list of subscribed channels on which the message was published.
	console.log(subscribed_channels);
	// The channels subscribed to.
	// If a message is published on a channel, and the subscriber is subscribed to multiple
	// regex channels which match the published channel, the subscriber only receives the
	// message once, and is given a list of subscribed channels which match the channel
	// on which the message was published.
	console.log(service.name);
	// The service subscribed to.
	// Subscribers are free to subscribe to as many services as are available.  This
	// argument allows to you recognize which service sent the message.
});

// Subscribe
subscriber.subscribe(service, 'b.*', callback(error) {
	console.error(error);
});

// Publish
publisher.publish(service, 'bar', 'a message', callback(error) {
	console.error(error);
});
//`respond_to` is now called with 'a message', ['bar'], and ['b.*']

```

`publisher` and `subscriber` objects can publish and subscribe either to local or remote services.  For remote services, instead of passing a service object, pass the URL and port which the remote service is listening on.

To configure the `service` to accept subscriptions or publications from remote users, use `service.listen`.


Why...
---
###...write this?
Wisper is being written because I was writing a simple, minimal service (let's call it `small`), and a coworker suggested adding pub/sub.  That was a great idea, because it really improved the usefulness of `small` and eliminated the need for polling.  I looked around at available pub/sub modules and none met my requirements (see the "what is wisper" section).  I ended up having to use a comparatively gargantuan pub/sub service to give `small` this extra feature.

Feel free to let me know if there's a similar or better solution that meets the criteria...less maintenance work for me is better!

###...do you care about minimalism?
I like the idea of doing one thing and doing it well.  Practically, it means that your overall project is easier to wrap your head around, which makes it easier to reason about, to debug, to extend, and to use.  

###...do you care that it uses websockets as opposed to any other protocol?
Websockets allow fast two-way communication on the web, without the complexity of raw TCP.  No need for a subscriber to have their own server running to receive notifications.  No need for all of the latency and overhead of long-polling, or the overhead of SPDY pushes.
###...do you want pub/sub?
Pub/sub allows me to eliminate polling and reduce communication overhead in my network-distributed application.
###...do you care about regex subscriptions?
Flexibility and simplicity for users.  Imagine a scenario in which you are building a chat-room for plants.  Now imagine you only want to listen to the trees.  Would you rather subscribe to "oak-tree", "maple-tree", "aspen-tree", etc, or would you rather just subscribe to ".*-tree"?  Glob-subscriptions can take care of this particular use case, but it shouldn't be hard to understand from here that regex's give you even more flexibility.
###...is it named wisper?
I typed the important bits out in different orders and eventually saw:

Minimal 
**W** eb
**S** ocket
**S** ubscribe
**P** ublish
**R** egex

See the WSSPR?  "Minimal" doesn't make it into the naming explicitly, but a 'wisp' and a 'whisper' are both small (one in mass, the other in amplitude), so I felt like it fit quite nicely.