module.exports = {
  Logger: require('./lib/logger.js').Logger,
  logLevels: require('./lib/logger.js').logLevels,
  Wit: require('./lib/wit.js').Wit,
}

// When not cloning the `node-wit` repo, replace the `require` like so:
// const Wit = require('node-wit').Wit;
// const Wit = require('node-wit').Wit;

// Webserver parameter
const PORT = process.env.PORT || 8445;
const Wit = require('./lib/wit.js').Wit
// Wit.ai parameters
const WIT_TOKEN = '2T7FBUGWU3EZMQI5LR6TOZ7XJT3PP47W';

// Messenger API parameters
const FB_PAGE_ID = '1626566834232499';
if (!FB_PAGE_ID) {
  throw new Error('missing FB_PAGE_ID');
}
const FB_PAGE_TOKEN = 'EAAEBiRHfG04BAOEiPJrPBy2sKAuCT864cSIECn2E45NUVBUZAZCLbUGq4pAZBI72SrmZCYUSr1BZA0RPHIFXWQyKjZBe1eZAopz2iNDp4dP484AXpRSKUk4G7JcFZC4Jsv2hnbL6kFxM9pTdJI0DvfgI2efY3rtfW93VjaNcU5rfhgZDZD';
if (!FB_PAGE_TOKEN) {
  throw new Error('missing FB_PAGE_TOKEN');
}
const FB_VERIFY_TOKEN = 'testbot_verify_token';

// Starting our webserver and putting it all together
var express = require('express');
var bodyParser = require('body-parser');
var request = require('request');
const app = express();

// Messenger API specific code

// See the Send API reference
// https://developers.facebook.com/docs/messenger-platform/send-api-reference
const fbReq = request.defaults({
  uri: 'https://graph.facebook.com/me/messages',
  method: 'POST',
  json: true,
  qs: { access_token: FB_PAGE_TOKEN },
  headers: {'Content-Type': 'application/json'},
});

const fbMessage = (recipientId, msg, cb) => {
  const opts = {
    form: {
      recipient: {
        id: recipientId,
      },
      message: {
        text: msg,
      },
    },
  };
  fbReq(opts, (err, resp, data) => {
    if (cb) {
      cb(err || data.error && data.error.message, data);
    }
  });
};

// // See the Webhook reference
// // https://developers.facebook.com/docs/messenger-platform/webhook-reference
// const getFirstMessagingEntry = (body) => {
//   const val = body.object == 'page' &&
//     body.entry &&
//     Array.isArray(body.entry) &&
//     body.entry.length > 0 &&
//     body.entry[0] &&
//     body.entry[0].id === FB_PAGE_ID &&
//     body.entry[0].messaging &&
//     Array.isArray(body.entry[0].messaging) &&
//     body.entry[0].messaging.length > 0 &&
//     body.entry[0].messaging[0]
//   ;
//   return val || null;
// };

// // Wit.ai bot specific code

// // This will contain all user sessions.
// // Each session has an entry:
// // sessionId -> {fbid: facebookUserId, context: sessionState}
// const sessions = {};

// const findOrCreateSession = (fbid) => {
//   let sessionId;
//   // Let's see if we already have a session for the user fbid
//   Object.keys(sessions).forEach(k => {
//     if (sessions[k].fbid === fbid) {
//       // Yep, got it!
//       sessionId = k;
//     }
//   });
//   if (!sessionId) {
//     // No session found for user fbid, let's create a new one
//     sessionId = new Date().toISOString();
//     sessions[sessionId] = {fbid: fbid, context: {}};
//   }
//   return sessionId;
// };

// // Our bot actions
// const actions = {
//   say(sessionId, context, message, cb) {
//     // Our bot has something to say!
//     // Let's retrieve the Facebook user whose session belongs to
//     const recipientId = sessions[sessionId].fbid;
//     if (recipientId) {
//       // Yay, we found our recipient!
//       // Let's forward our bot response to her.
//       fbMessage(recipientId, message, (err, data) => {
//         if (err) {
//           console.log(
//             'Oops! An error occurred while forwarding the response to',
//             recipientId,
//             ':',
//             err
//           );
//         }

//         // Let's give the wheel back to our bot
//         cb();
//       });
//     } else {
//       console.log('Oops! Couldn\'t find user for session:', sessionId);
//       // Giving the wheel back to our bot
//       cb();
//     }
//   },
//   merge(sessionId, context, entities, message, cb) {
//     cb(context);
//   },
//   error(sessionId, context, error) {
//     console.log(error.message);
//   },
//   // You should implement your custom actions here
//   // See https://wit.ai/docs/quickstart
// };

// // Setting up our bot
// const wit = new Wit(WIT_TOKEN, actions);



app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.json());
app.listen((process.env.PORT || 3000));

// Server frontpage
app.get('/', function (req, res) {
    res.send('This is TestBot Server');
});

// Facebook Webhook
app.get('/webhook', function (req, res) {
    if (req.query['hub.verify_token'] === FB_VERIFY_TOKEN) {
        res.send(req.query['hub.challenge']);
    } else {
        res.send('Invalid verify token');
    }
});

// handler receiving messages
app.post('/webhook', function (req, res) {
    var events = req.body.entry[0].messaging;
    for (i = 0; i < events.length; i++) {
        var event = events[i];
        if (event.message && event.message.text) {
            sendMessage(event.sender.id, {text: "Echo: " + event.message.text});
        }
    }
    res.sendStatus(200);
});

// generic function sending messages
function sendMessage(recipientId, message) {
    request({
        url: 'https://graph.facebook.com/v2.6/me/messages',
        qs: {access_token: process.env.PAGE_ACCESS_TOKEN},
        method: 'POST',
        json: {
            recipient: {id: recipientId},
            message: message,
        }
    }, function(error, response, body) {
        if (error) {
            console.log('Error sending message: ', error);
        } else if (response.body.error) {
            console.log('Error: ', response.body.error);
        }
    });
};