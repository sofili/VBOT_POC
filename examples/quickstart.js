'use strict';

var express = require('express');
var app = express();
var bodyParser = require("body-parser");
var request = require('request');
// Quickstart example
// See https://wit.ai/l5t/Quickstart

// When not cloning the `node-wit` repo, replace the `require` like so:
// const Wit = require('node-wit').Wit;
const Wit = require('../').Wit;

const token = (() => {
  if (process.argv.length !== 3) {
    console.log('usage: node examples/quickstart.js <wit-token>');
    process.exit(1);
  }
  return process.argv[2];
})();

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

const actions = {
  say(sessionId, context, message, cb) {
    console.log(message);
    cb();
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
   
  ['fetch-top-movies'](sessionId, context, cb) {
    // Here should go the api call, e.g.:
    // context.forecast = apiCall(context.loc)
    context.title = getTopMovie();
    cb(context);
  },
  ['get-response'](sessionId, context, cb) {
    var intent = context.intent;
    var movieTitle = context.movieTitle;

    if (intent == 'watch') {
      if (movieTitle) {
        // return closest movie
        context.title = getMovieInfo(movieTitle);
      }
      else {
        // recommendation
        content.title = getTopMovie();
      }
    } 
    else if (intent == 'review') {
      if (movieTitle) {
        // review of a movie
        context.review = getTomatoReview(movieTitle)
      }
      else {
        // recommendation
        content.title = getTopMovie();
      }


    }
    else if (intent == 'recommendation') {
      // recommendation
      content.title = getTopMovie();
    }
    else {
      // recommendation
      content.title = getTopMovie();
    }

    cb(context);
  },
  ['find-movie'](sessionId, context, cb) {
    context.title = getMovieInfo(context.movieTitle);
    cb(context);
  },
  ['get-review'](sessionId, context, cb) {
    context.review = getTomatoReview(context.movieTitle);
    cb(context);
  },
  ['similar-movie'](sessionId, context, cb) {
    // context.url = "http://apicache.vudu.com/api2/claimedAppId/myvudu/format/application*2Fjson/_type/contentMetaSearch/phrase/" + context.loc
    contentId = sendSearchResult(context.movieTitle);
    context.title = getSimilarMovie(contentId);
    cb(context);

  }
};

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


function getTopMovie() {

  var url_s = 'http://apicache.vudu.com/api2/claimedAppId/myvudu/format/application*2Fjson/_type/contentSearch/count/30/dimensionality/any/offset/0/sortBy/-watchedScore/superType/movies/type/program/type/bundle';

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

      console.log("found it! " + title);
      return title;
    }
  });
};

function getMovieInfo(text) {

  console.log('send search result for ' + text);
  // var search = text.substring(12, text.lenght);
  var encodedSearch = encodeURIComponent(text);
  console.log('type of encoded search :', typeof encodedSearch);
  console.log('encoded search: ', encodedSearch);

  var url_s = 'http://apicache.vudu.com/api2/claimedAppId/myvudu/format/application*2Fjson/_type/contentSearch/titleMagic/' + encodedSearch +'/count/3/type/program/sortBy/tomatoMeter';
  
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

function getTomatoReview(text) {

  console.log('send search result for ' + text);
  // var search = text.substring(12, text.lenght);
  var encodedSearch = encodeURIComponent(text);
  console.log('type of encoded search :', typeof encodedSearch);
  console.log('encoded search: ', encodedSearch);

  var url_s = 'http://apicache.vudu.com/api2/claimedAppId/myvudu/format/application*2Fjson/_type/contentSearch/titleMagic/' + encodedSearch +'/count/3/type/program/sortBy/tomatoMeter';
  
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

        var url_review = 'http://apicache.vudu.com/api2/claimedAppId/myvudu/format/application*2Fjson/_type/tomatoReviewSearch/contentId/' + contentId + '/sortBy/authorRank/count/1';

        request({
          url: url_review,
          method: 'GET'
        }, function(error, response, body) {
          if (error) {
            console.log('*******Error sending message: ', error);
          } else if (response.body) {
            var sub = response.body.substring(10, response.body.length - 2);
            var evaluation = eval('(' + sub + ')');
            
            // var randomNum = getRandomInt(1,30);
            var author = evaluation.tomatoReview[0].author[0];
            var comment = evaluation.tomatoReview[0].comment[0];
            var source = evaluation.tomatoReview[0].source[0];
            var reviewURL = evaluation.tomatoReview[0].url[0];

            console.log("found review! " + comment);
            return comment;
          }
        });
      }
      catch(err) {

        return "Sorry! No Review!";
      }


      }
    });
}


function getSimilarMovie(contentId) {
  var url_s = 'http://apicache.vudu.com/api2/claimedAppId/myvudu/format/application*2Fjson/_type/contentSimilarSearch/contentId/' + contentId +'/count/10';

  request({
    url: url_s,
    method: 'GET'
  }, function(error, response, body) {
    if (error) {
      console.log('*******Error sending message: ', error);
    } else if (response.body) {
      var sub = response.body.substring(10, response.body.length - 2);
      var evaluation = eval('(' + sub + ')');
      
      var randomNum = getRandomInt(1,10);
      var title = evaluation.content[randomNum].title[0];
      var contentId = evaluation.content[randomNum].contentId[0];
      var description = evaluation.content[randomNum].description[0];

      console.log("found similar movie! " + title);
      return title;
    }
  });

}



function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}


const client = new Wit(token, actions);
client.interactive();
