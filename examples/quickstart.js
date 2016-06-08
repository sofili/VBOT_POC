'use strict';

// var express = require('express');
// var app = express();
// var bodyParser = require("body-parser");
var request = require('../node_modules/node-fetch/lib/request');
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
    const loc = firstEntityValue(entities, 'wit_movieTitle');
    if (loc) {
      context.loc = loc;
    }
    cb(context);
  },
  error(sessionId, context, error) {
    console.log(error.message);
  },
   
  ['fetch-top-movies'](sessionId, context, cb) {
    // Here should go the api call, e.g.:
    // context.forecast = apiCall(context.loc)
    context.title = 'Deadpool';
    cb(context);
  },
  ['find-movie'](sessionId, context, cb) {
    //context.url = "http://apicache.vudu.com/api2/claimedAppId/myvudu/format/application*2Fjson/_type/contentMetaSearch/phrase/" + context.loc
    context.title = sendSearchResult(context.loc) // apicall(url)
    cb(context)
  },
  ['similar-movie'](sessionId, context, cb) {
    // context.url = "http://apicache.vudu.com/api2/claimedAppId/myvudu/format/application*2Fjson/_type/contentMetaSearch/phrase/" + context.loc
    context.title = "Superman" // apicall(url)
    cb(context)

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

      var id1 = evaluation.content[0].contentId[0];
      var title1 = evaluation.content[0].title[0];
      var description1 = evaluation.content[0].description[0];

      console.log("found it! " + title1);
      return title1;
    }
  });
};


const client = new Wit(token, actions);
client.interactive();
