'use strict';

const Logger = require('./lib/logger.js').Logger;
const logLevels = require('./lib/logger.js').logLevels;
const Wit = require('./lib/wit.js').Wit;
const Promise = require('promise');
const rp = require('request-promise');

const logger = new Logger(logLevels.DEBUG);
// When not cloning the `node-wit` repo, replace the `require` like so:
// const Wit = require('node-wit').Wit;
// const Wit = require('node-wit').Wit;

// Webserver parameter
const PORT = process.env.PORT || 8445;
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
      message: msg,
    },
  };
  fbReq(opts, (err, resp, data) => {
    if (cb) {
      cb(err || data.error && data.error.message, data);
    }
  });
};

// See the Webhook reference
// https://developers.facebook.com/docs/messenger-platform/webhook-reference
const getFirstMessagingEntry = (body) => {
  const val = body.object == 'page' &&
    body.entry &&
    Array.isArray(body.entry) &&
    body.entry.length > 0 &&
    body.entry[0] &&
    body.entry[0].id === FB_PAGE_ID &&
    body.entry[0].messaging &&
    Array.isArray(body.entry[0].messaging) &&
    body.entry[0].messaging.length > 0 &&
    body.entry[0].messaging[0]
  ;
  return val || null;
};

// Wit.ai bot specific code

// This will contain all user sessions.
// Each session has an entry:
// sessionId -> {fbid: facebookUserId, context: sessionState}
const sessions = {};

const findOrCreateSession = (fbid) => {
  let sessionId;
  // Let's see if we already have a session for the user fbid
  Object.keys(sessions).forEach(k => {
    if (sessions[k].fbid === fbid) {
      // Yep, got it!
      sessionId = k;
    }
  });
  if (!sessionId) {
    // No session found for user fbid, let's create a new one
    sessionId = new Date().toISOString();
    sessions[sessionId] = {fbid: fbid, context: {}};
  }
  return sessionId;
};

const firstEntityValue = (entities, entity) => {
  const val = entities && entities[entity] &&
    Array.isArray(entities[entity]) &&
    entities[entity].length > 0 &&
    entities[entity][0].value
  ;
  if (!val) {
    return null;
  }
  return typeof val === 'object' ? val.value : val;
};

// Our bot actions
const actions = {
  say(sessionId, context, message, cb) {
    // Our bot has something to say!
    // Let's retrieve the Facebook user whose session belongs to
    const recipientId = sessions[sessionId].fbid;
    if (recipientId) {
      // Yay, we found our recipient!
      // Let's forward our bot response to her.

      console.log("Say context:" + JSON.stringify(context));
      var elements = getFBElement(context);
      console.log("fb msg:" + JSON.stringify(elements));

      var msg;

      if (elements) {
		msg = {
			attachment: {
				type: "template",
				payload: {
				"template_type": "generic",
				"elements": elements
				}
			}
		};
      }
      else {
      	console.log("wit.ai message:", message);
      	msg = {
	    	text: message,
	    };
      }

      fbMessage(recipientId, msg, (err, data) => {
        if (err) {
          console.log(
            'Oops! An error occurred while forwarding the response to',
            recipientId,
            ':',
            err
          );
        }

        // Let's give the wheel back to our bot
        cb();
      });
    } else {
      console.log('Oops! Couldn\'t find user for session:', sessionId);
      // Giving the wheel back to our bot
      cb();
    }
  },
  merge(sessionId, context, entities, message, cb) {
  	// Retrieve the location entity and store it into a context field
    const movieTitle = firstEntityValue(entities, 'wit_movieTitle');
    if (movieTitle) {
      context.movieTitle = movieTitle;
    }

    const intent = firstEntityValue(entities, 'intent');
    if (intent) {
      context.intent = intent;
    }
    cb(context);
  },
  error(sessionId, context, error) {
    console.log(error.message);
  },
  // You should implement your custom actions here
  // See https://wit.ai/docs/quickstart

  ['fetch-top-movies'](sessionId, context, cb) {
    // Here should go the api call, e.g.:
    // context.forecast = apiCall(context.loc)
    getTopMovie(cb);

  },
   ['get-response'](sessionId, context, cb) {
    var intent = context.intent;
    var movieTitle = context.movieTitle;

    console.log('intent:' + intent);
    console.log('movieTitle:' + movieTitle);

    if (intent == 'watch') {
      if (movieTitle) {
        // return closest movie
        context.title = getMovieInfo(movieTitle);
      }
      else {
        // recommendation
        context.title = getTopMovie(cb);
      }
    }
    else if (intent == 'review') {
      if (movieTitle) {
        // review of a movie
        console.log('before context:' + context);
        getReview(movieTitle, cb)

      }
      else {
        // recommendation
        context.title = getTopMovie(cb);
      }


    }
    else if (intent == 'recommendation') {
      // recommendation
      context.title = getTopMovie(cb);
    }
    else {
      // recommendation
      if (movieTitle) {
      	// Can't find intent but user typed something for a movie
      	getReview(movieTitle, cb)
      }
      else {
      	// No intent no movie title, just response with top movies
      	context.title = getTopMovie(cb);
      }

    }

  },
  ['get-price'](sessionId, context, cb) {
    getPrice(context.movieTitle, cb);
  },
  ['similar-movie'](sessionId, context, cb) {
    getSimilarMovie(context.movieTitle, cb);
  }
};

// Setting up our bot
const wit = new Wit(WIT_TOKEN, actions);

const app = express();
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

// Message handler
app.post('/webhook', (req, res) => {
  // Parsing the Messenger API response
  const messaging = getFirstMessagingEntry(req.body);
  if (messaging && messaging.message && messaging.recipient.id === FB_PAGE_ID) {
    // Yay! We got a new message!

    // We retrieve the Facebook user ID of the sender
    const sender = messaging.sender.id;

    // We retrieve the user's current session, or create one if it doesn't exist
    // This is needed for our bot to figure out the conversation history
    const sessionId = findOrCreateSession(sender);

    // We retrieve the message content
    const msg = messaging.message.text;
    const atts = messaging.message.attachments;

    if (atts) {
      // We received an attachment

      // Let's reply with an automatic message
      fbMessage(
        sender,
        'Sorry I can only process text messages for now.'
      );
    } else if (msg) {
      // We received a text message

      // Let's forward the message to the Wit.ai Bot Engine
      // This will run all actions until our bot has nothing left to do
      wit.runActions(
        sessionId, // the user's current session
        msg, // the user's message
        sessions[sessionId].context, // the user's current session state
        (error, context) => {
          if (error) {
            console.log('Oops! Got an error from Wit:', error);
          } else {
            // Our bot did everything it has to do.
            // Now it's waiting for further messages to proceed.
            console.log('Waiting for futher messages.');

            // Based on the session state, you might want to reset the session.
            // This depends heavily on the business logic of your bot.
            // Example:
            // if (context['done']) {
            //   delete sessions[sessionId];
            // }

            // Updating the user's current session state

            sessions[sessionId].context = context;
          }
        }
      );
    }
  }
  res.sendStatus(200);
});

/*
 * Postback Event
 *
 * This event is called when a postback is tapped on a Structured Message. Read
 * more at https://developers.facebook.com/docs/messenger-platform/webhook-reference#postback
 *
 */
function receivedPostback(event) {
  var senderID = event.sender.id;
  var recipientID = event.recipient.id;
  var timeOfPostback = event.timestamp;

  // The 'payload' param is a developer-defined field which is set in a postback
  // button for Structured Messages.
  var payload = event.postback.payload;

  console.log("Received postback for user %d and page %d with payload '%s' " +
    "at %d", senderID, recipientID, payload, timeOfPostback);

  // When a postback is called, we'll send a message back to the sender to
  // let them know it was successful
  sendTextMessage(senderID, "Postback called");
}

/*
 * Send a text message using the Send API.
 *
 */
function sendTextMessage(recipientId, messageText) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      text: messageText
    }
  };

  callSendAPI(messageData);
}

/*
 * Send a button message using the Send API.
 *
 */
function sendButtonMessage(recipientId) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      attachment: {
        type: "template",
        payload: {
          template_type: "button",
          text: "This is test text",
          buttons:[{
            type: "web_url",
            url: "https://www.oculus.com/en-us/rift/",
            title: "Open Web URL"
          }, {
            type: "postback",
            title: "Call Postback",
            payload: "Developer defined postback"
          }]
        }
      }
    }
  };

  callSendAPI(messageData);
}

/*
 * Call the Send API. The message data goes in the body. If successful, we'll
 * get the message id in a response
 *
 */
function callSendAPI(messageData) {
  request({
    uri: 'https://graph.facebook.com/v2.6/me/messages',
    qs: { access_token: PAGE_ACCESS_TOKEN },
    method: 'POST',
    json: messageData

  }, function (error, response, body) {
    if (!error && response.statusCode == 200) {
      var recipientId = body.recipient_id;
      var messageId = body.message_id;

      console.log("Successfully sent generic message with id %s to recipient %s",
        messageId, recipientId);
    } else {
      console.error("Unable to send message.");
      console.error(response);
      console.error(error);
    }
  });
}

function sendSearchResult(text) {

  console.log('send search result for ' + text);
  // var search = text.substring(12, text.lenght);
  var encodedSearch = encodeURIComponent(text);
  console.log('type of encoded search :', typeof encodedSearch);
  console.log('encoded search: ', encodedSearch);

  var url_s = `http://apicache.vudu.com/api2/claimedAppId/myvudu/format/application*2Fjson/_type/contentSearch/count/1/dimensionality/any/followup/ratingsSummaries/includeComingSoon/true/includePreOrders/true/offset/0/streamable/true/titleMagic/${encodedSearch}/type/program/type/season/type/episode/type/bundle/type/bonus/type/series`;
  console.log('type of url: ', typeof url_s);

  request({
    url: url_s,
    method: 'GET'
  }, function(error, response, body) {
    if (error) {
      console.log('*******Error sending message: ', error);
    } else if (response.body) {
      var sub = response.body.substring(10, response.body.length - 2);
      var evaluation = eval('(' + sub + ')');
      // get first search result
      var contentId = evaluation.content[0].contentId[0];
      var title = evaluation.content[0].title[0];
      var description = evaluation.content[0].description[0];

      console.log("found it! " + title + "id:" + contentId);
      return contentId;
    }
  });
};


function getTopMovie(cb) {

 	var url_s = 'http://apicache.vudu.com/api2/claimedAppId/myvudu/format/application*2Fjson/_type/contentSearch/count/30/dimensionality/any/offset/0/sortBy/-watchedScore/superType/movies/type/program/type/bundle/followup/totalCount';
  	var contentArray = [];

	rp(url_s)
		.then(function (response) {
			// console.log('in getTopMovie - got response:' + response);
			if (response) {
				var sub = response.substring(10, response.length - 2);
				var evaluation = eval('(' + sub + ')');
				var totalCount = evaluation.totalCount[0];
				console.log('totalCount:' + totalCount);
				// get first search result

				if (parseInt(totalCount) <= 0 && parseInt(totalCount) > 30) {
					console.log('something is wrong with getTopMovie totalCount');
				}
				else {
					// Get random 3 top movies
					var randomIndex =[];
					for (var i = 0; i < 3; i++) {
						var randomNum = getRandomInt(0,9) + i * 10;
						randomIndex[i] = randomNum;
					}

				  	for (var i = 0; i < 3; i++) {
				  		var randomNum = randomIndex[i];
				  		// console.log("get top movie:" + randomNum);

				  		var vuduContent = {};
				  		vuduContent.contentId = evaluation.content[randomNum].contentId[0];
				    	vuduContent.title = evaluation.content[randomNum].title[0];
				    	vuduContent.description = evaluation.content[randomNum].description[0];
				    	vuduContent.tomatoMeter = evaluation.content[randomNum].tomatoMeter[0];

				    	contentArray[i] = vuduContent;

				    	console.log("found it! " + vuduContent.title + "/id:" + vuduContent.contentId);

				  	}
				    // Need to handle if there's no review
				    // console.log(JSON.stringify(msg));
				    cb({"Action": contentArray});
				}
			}
		})
		.catch(function (err) {
			console.log('---*******Error sending message: ', err);
	});
};

function getMovieInfo(text) {

  console.log('send search result for ' + text);
  // var search = text.substring(12, text.lenght);
  var encodedSearch = encodeURIComponent(text);
  console.log('type of encoded search :', typeof encodedSearch);
  console.log('encoded search: ', encodedSearch);

  var url_s = 'http://apicache.vudu.com/api2/claimedAppId/myvudu/format/application*2Fjson/_type/contentMetaSearch/phrase/'+ encodedSearch + '/includePreOrders/true/followup/totalCount';

  request({
    url: url_s,
    method: 'GET'
  }, function(error, response, body) {
    if (error) {
      console.log('*******Error sending message: ', error);
    } else if (response.body) {
      var sub = response.body.substring(10, response.body.length - 2);
      var evaluation = eval('(' + sub + ')');

      console.log('result:' + response.body);
      // get first search result

      try {
        var contentId = evaluation.content[0].contentId[0];
        var title = evaluation.content[0].title[0];
        var description = evaluation.content[0].description[0];

        // Need to handle if there's no review

        console.log("found it! " + title + "/id:" + contentId);

        var url_s = 'http://apicache.vudu.com/api2/claimedAppId/myvudu/format/application*2Fjson/_type/contentSearch/contentId/' + contentId ;

        request({
          url: url_s,
          method: 'GET'
        }, function(error, response, body) {
          if (error) {
            console.log('*******Error sending message: ', error);
          } else if (response.body) {
            var sub = response.body.substring(10, response.body.length - 2);
            var evaluation = eval('(' + sub + ')');

            var randomNum = getRandomInt(1,30);
            var id = evaluation.content[randomNum].contentId[0];
            var title = evaluation.content[randomNum].title[0];
            var description = evaluation.content[randomNum].description[0];

            console.log("found search title! " + title);
            return title;
          }
        });
      }
      catch(err) {

        return "Sorry! No movie found!";
      }


      }
    });


};

function getContentSimilarSearch(vuduContent) {

	console.log("called getContentSimilarSearch");
	var contentId = vuduContent.contentId;
	var url_s = 'http://apicache.vudu.com/api2/claimedAppId/myvudu/format/application*2Fjson/_type/contentSimilarSearch/contentId/' + contentId +'/count/10/followup/totalCount';

	return rp(url_s)
		.then(function (response) {
			console.log('in getContentSimilarSearch - got response:' + response);
			if (response) {
				var sub = response.substring(10, response.length - 2);
				var evaluation = eval('(' + sub + ')');
				var totalCount = evaluation.totalCount[0];

				// get first search result

				if (parseInt(totalCount) === 0) {
					console.log('cannot find a similar movie for contentId:' + contentId);
				}
				else {
					var similarMoviesArray = [];

					for (var i = 0; i < evaluation.content.length; i ++) {
						var movieElement = {};

						movieElement.title = evaluation.content[i].title[0];
						movieElement.contentId = evaluation.content[i].contentId[0];
						movieElement.releaseTime = evaluation.content[i].releaseTime[0];
						movieElement.mpaaRating = evaluation.content[i].mpaaRating[0];

						similarMoviesArray[i] = movieElement;
						console.log( i,"-similar movie:", JSON.stringify(movieElement));
					}
					console.log("before the final:", similarMoviesArray);
					return similarMoviesArray;
				}
			}
			else {
				console.log("getContentSimilarSearch - something went wrong");
			}
		})
		.catch(function (err) {
			console.log('*******getContentSimilarSearch-Error sending message: ', err);
	});

}

function getTomatoReview(vuduContent) {

	console.log("called getTomatoReview");
	var contentId = vuduContent.contentId;
	var url_review = 'http://apicache.vudu.com/api2/claimedAppId/myvudu/format/application*2Fjson/_type/tomatoReviewSearch/contentId/' + contentId + '/sortBy/isByTopAuthor/followup/totalCount';

	console.log("About to call:", url_review);
	return rp(url_review)
		.then(function (response) {
			console.log('in getTomatoReview - got response:' + response);
			if (response) {
				var sub = response.substring(10, response.length - 2);
				var evaluation = eval('(' + sub + ')');
				var totalCount = evaluation.totalCount[0];
				console.log('totalCount:' + totalCount);
				// get first search result

				if (parseInt(totalCount) === 0) {
					console.log('cannot find a review for contentId:' + contentId);
				}
				else {
					var reviewArray = [];
				  	vuduContent.reviewComment = evaluation.tomatoReview[0].comment[0];
				  	vuduContent.reviewAuthor = evaluation.tomatoReview[0].author[0];
				  	vuduContent.reviewSource = evaluation.tomatoReview[0].source[0];
				  	vuduContent.reviewURL = evaluation.tomatoReview[0].url[0];

				  	reviewArray[0] = vuduContent;
					return reviewArray;
				}
			}
			else {
				console.log("getTomatoReview - something went wrong");
			}
		})
		.catch(function (err) {
			console.log('*******getTomatoReview-Error sending message: ', err);
	});
}

function getReview(text, cb) {

	console.log('send search result for ' + text);
	// var search = text.substring(12, text.lenght);
	var encodedSearch = encodeURIComponent(text);
	console.log('type of encoded search :', typeof encodedSearch);
	console.log('encoded search: ', encodedSearch);

  	var url_s = 'http://apicache.vudu.com/api2/claimedAppId/myvudu/format/application*2Fjson/_type/contentMetaSearch/phrase/'+ encodedSearch + '/includePreOrders/true/followup/totalCount/count/3';

	rp(url_s)
		.then(function (response) {
			console.log('in GetReview - got response:' + response);
			if (response) {
				var sub = response.substring(10, response.length - 2);
				var evaluation = eval('(' + sub + ')');
				var totalCount = evaluation.totalCount[0];
				console.log('totalCount:' + totalCount);
				// get first search result

				if (parseInt(totalCount) === 0) {
					console.log('cannot find a matching movie');
				}
				else {
					var vuduContent = {};
				  	vuduContent.contentId = evaluation.content[0].contentId[0];
			    	vuduContent.title = evaluation.content[0].title[0];

			    	console.log("found it! " + vuduContent.title + "/id:" + vuduContent.contentId);
				    // Need to handle if there's no review
				    // console.log(JSON.stringify(msg));
				    return vuduContent;
				}
			}
			else {
				console.log("getReview - something went wrong");
			}
		})
		.then(function (vuduContent) {
			return getMovieDetail(vuduContent);
		})
		.then(function (vuduContent) {
			return getTomatoReview(vuduContent);
		})
		.then(function (reviewArray) {
			cb({"Action": reviewArray});
		})
		.catch(function (err) {
			console.log('*******Error sending message: ', err);
		});
}

function getMovieDetail(vuduContent) {
	console.log("called getMovieDetail");
	var contentId = vuduContent.contentId;
	var url_review = 'http://apicache.vudu.com/api2/claimedAppId/myvudu/format/application*2Fjson/_type/contentSearch/contentId/' + contentId + '/followup/totalCount/followup/mpaaRating';

	return rp(url_review)
		.then(function (response) {
			console.log('in getMovieDetail - got response:' + response);
			if (response) {
				var sub = response.substring(10, response.length - 2);
				var evaluation = eval('(' + sub + ')');
				var totalCount = evaluation.totalCount[0];
				console.log('totalCount:' + totalCount);
				// get first search result

				if (parseInt(totalCount) === 0) {
					console.log('cannot find a review for contentId:' + contentId);
				}
				else {
				  	vuduContent.description = evaluation.content[0].description[0] ? evaluation.content[0].description[0] : "";
				  	vuduContent.releaseTime = evaluation.content[0].releaseTime[0] ? evaluation.content[0].releaseTime[0] : "";
				  	vuduContent.mpaaRating = evaluation.content[0].mpaaRating[0] ? evaluation.content[0].mpaaRating[0] : "";
				  	vuduContent.tomatoMeter = evaluation.content[0].tomatoMeter[0] ? evaluation.content[0].tomatoMeter[0] : "";
					return vuduContent;
				}
			}
			else {
				console.log("getMovieDetail - something went wrong");
			}
		})
		.catch(function (err) {
			console.log('*******getMovieDetail-Error sending message: ', err);
	});
}

// This should return an array
function getFBElement(contents) {
	var msgArray = contents["Action"];
	var outputArray = [];

	if (msgArray) {
		for (var i = 0; i < msgArray.length; i++) {
			var vuduContent = msgArray[i];

			var title = vuduContent.title;
			var description = vuduContent.description;
			var contentId = vuduContent.contentId;

			var element = {
			  "title": title,
			  "subtitle": description.length ? description : "Release Date:" + vuduContent.releaseTime + " Rating:" + vuduContent.mpaaRating ,
			  "image_url": "http://images2.vudu.com/poster2/" + contentId + "-l",
			  "buttons": [{
			    "type": "web_url",
			    "url": "http://www.vudu.com/movies/#!content/" + contentId,
			    "title": "View Details"
				}]
			};

			outputArray[i] = element;
		}
		return outputArray;
	}
	else {
		// No custom action data found, could be wit.ai reply
		return;
	}


}

function getSimilarMovie(text, cb) {

	var encodedSearch = encodeURIComponent(text);
	console.log('encoded search: ', encodedSearch);

  	var url_s = 'http://apicache.vudu.com/api2/claimedAppId/myvudu/format/application*2Fjson/_type/contentMetaSearch/phrase/'+ encodedSearch + '/includePreOrders/true/followup/totalCount/count/3';

	rp(url_s)
		.then(function (response) {
			console.log('in getSimilarMovie - got response:' + response);
			if (response) {
				var sub = response.substring(10, response.length - 2);
				var evaluation = eval('(' + sub + ')');
				var totalCount = evaluation.totalCount[0];
				console.log('totalCount:' + totalCount);
				// get first search result

				if (parseInt(totalCount) === 0) {
					console.log('cannot find a matching movie');
				}
				else {
					var vuduContent = {};

					vuduContent.contentId = evaluation.content[0].contentId[0];
			    	vuduContent.title = evaluation.content[0].title[0];

				    console.log("found it! " + vuduContent.title + "/id:" + vuduContent.contentId);

				    return vuduContent;
				}
			}
			else {
				console.log("getSimilarMovie - something went wrong");
			}
		})
		.then(function(vuduContent) {
			return getContentSimilarSearch(vuduContent);

		})
		.then(function(similarMoviesArray) {
			console.log("final then!");
			console.log("final array,", similarMoviesArray);
			cb({"Action": similarMoviesArray});
		})
		.catch(function (err) {
			console.log('*******Error sending message: ', err);
		});
}

function getPrice(text, cb) {

	console.log('send search result for ' + text);
	// var search = text.substring(12, text.lenght);
	var encodedSearch = encodeURIComponent(text);
	console.log('type of encoded search :', typeof encodedSearch);
	console.log('encoded search: ', encodedSearch);

  	var url_s = 'http://apicache.vudu.com/api2/claimedAppId/myvudu/format/application*2Fjson/_type/contentMetaSearch/phrase/'+ encodedSearch + '/includePreOrders/true/followup/totalCount/count/3';

	rp(url_s)
		.then(function (response) {
			console.log('in getPrice - got response:' + response);
			if (response) {
				var sub = response.substring(10, response.length - 2);
				var evaluation = eval('(' + sub + ')');
				var totalCount = evaluation.totalCount[0];
				console.log('totalCount:' + totalCount);
				// get first search result

				if (parseInt(totalCount) === 0) {
				console.log('cannot find a matching movie');
				}
				else {
					var vuduContent = {};
				  	vuduContent.contentId = evaluation.content[i].contentId[0];
			    	vuduContent.title = evaluation.content[i].title[0];

			    	console.log("found it! " + vuduContent.title + "/id:" + vuduContent.contentId);
				    // Need to handle if there's no review
				    // console.log(JSON.stringify(msg));
				    return vuduContent;
				}
			}
			else {
				console.log("getPrice - something went wrong");
			}
		})
		.then(function(vuduContent) {
			return getPriceInfo(vuduContent);
		})
		.then(function(vuduContent) {
			cb(vuduContent);

		})
		.catch(function (err) {
			console.log('*******Error sending message: ', err);
		});

}


function getPriceInfo(vuduContent) {

	console.log("called getPriceInfo");
	var contentId = vuduContent.contentId;
	var url_review = 'http://apicache.vudu.com/api2/claimedAppId/myvudu/format/application*2Fjson/_type/contentSearch/contentId/' + contentId + '/followup/totalCount/followup/offers';

	return rp(url_review)
		.then(function (response) {
			console.log('in getPriceInfo - got response:' + response);
			if (response) {
				var sub = response.substring(10, response.length - 2);
				var evaluation = eval('(' + sub + ')');
				var totalCount = evaluation.totalCount[0];
				console.log('totalCount:' + totalCount);
				// get first search result

				if (parseInt(totalCount) === 0) {
					console.log('cannot find the price for contentId:' + contentId);
				}
				else {
					var ptoArray = []; //[sdPrice, hdPrice, hdxPrice]
					var ptrArray = [];

					for (var i = 0; i < evaluation.content[0].contentVariants[0].contentVariant.length; i++) {
						var videoQuality = evaluation.content[0].contentVariants[0].contentVariant[i].videoQuality[0];
						var videoQualityInt;

						if (videoQuality === "sd") {
							videoQualityInt = 0;
						}
						else if (videoQuality === "hd") {
							videoQualityInt = 1;
						}
						else if (videoQuality === "hdx") {
							videoQualityInt = 2;
						}
						else {
							console.log("Error with pricing, this should never happen!");
						}

						for (var j = 0; j < evaluation.content[0].contentVariants[0].contentVariant[i].offers[0].offer.length; j ++) {
							// pto/ptr
							var offerType = evaluation.content[0].contentVariants[0].contentVariant[i].offers[0].offer[j].offerType[0];

							if (offerType === "pto") {
								ptoArray[videoQualityInt] = evaluation.content[0].contentVariants[i].contentVariant[0].offers[0].offer[j].price[0];
							}
							else if(offerType === "ptr") {
								ptrArray[videoQualityInt] = evaluation.content[0].contentVariants[i].contentVariant[0].offers[0].offer[j].price[0];
							}
							else {
								console.log("get price - something wrong with offerType");
							}
						}
					}

					vuduContent.ptrPriceArray = ptrArray;
					vuduContent.ptoPriceArray = ptoArray;

				    return vuduContent;
				}
			}
			else {
				console.log("getPriceInfo - something went wrong");
			}
		})
		.catch(function (err) {
			console.log('*******Error sending message: ', err);
		});
}

function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}
