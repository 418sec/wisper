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

How do you use it?
---
As a local, in-app service:

```javascript
var wisper = require('wisper');
var service = wisper.create_service();

// Subscribe to a channel and listen to it
service.subscribe('foo', function(error) {
  if(error) {
    console.error(error);
  }
});
service.on('publication', function(publication) {
  console.log(publication.subscriptions);
  console.log(publication.channel);
  console.log(publication.message);
});

// Publish to a channel
service.publish({
  'channel': 'foo',
  'message': 'The FooBar is now open!');
}, function(error) {
  if(error) {
    console.error(error);
  }
);
```

As a client/server... coming soon...

Why...
---
###...write this?
Wisper is being written because I was writing a simple, minimal service (let's call it `small`), and a coworker suggested adding pub/sub.  That was a great idea, because it really improved the usefulness of `small` and eliminated the need for polling.  I looked around at available pub/sub modules and none met my requirements (see the "what is wisper" section).  I ended up having to use a comparatively gargantuan pub/sub service to give `small` this extra feature.

Feel free to let me know if there's a similar or better solution that meets the criteria...less maintenance work for me is better!

###...do you care about minimalism?
I like the idea of doing one thing and doing it well.  Practically, it means that your overall project is easier to wrap your head around, which makes it easier to reason about, to debug, to extend, and to use.  

###...do you care that it uses websockets as opposed to any other protocol?
Websockets allow fast two-way communication on the web, without the complexity of raw TCP.  No need for a client to have their own server running to receive notifications.  No need for all of the latency and overhead of long-polling, or the overhead of SPDY pushes.
###...do you want pub/sub?
Pub/sub allows me to eliminate polling and reduce communication overhead in my network-distributed application.
###...do you care about regex subscriptions?
Flexibility and simplicity for users.  Imagine a scenario in which you are building a chat-room for plants.  Now imagine you only want to listen to the trees.  Would you rather subscribe to "oak-tree", "maple-tree", "aspen-tree", etc, or would you rather just subscribe to ".*-tree"?  Glob-subscriptions can take care of this particular use case, but it shouldn't be hard to understand from here that regex's give you even more flexibility.
###...is it named wisper?
I typed the important bits out in different orders and eventually saw:

Minimal 
**W**eb
**S**ocket
**S**ubscribe
**P**ublish
**R**egex

See the WSSPR?  "Minimal" doesn't make it into the naming explicitly, but a 'wisp' and a 'whisper' are both small (one in mass, the other in amplitude), so I felt like it fit quite nicely.