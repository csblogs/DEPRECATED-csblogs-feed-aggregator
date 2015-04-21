var feed = require('feed-read');
var http = require('http');
var async = require('async');
var req = require('request');

var feedUrlList = ['http://dannycomputerscientist.wordpress.com/feed',
             'http://robcrocombe.com/feed',
             'http://charlottegodley.co.uk/rss'];

async.each(feedUrlList,
    function(feedUrl, done) {
        feed(feedUrl, function(err, articles) {
            dealWithParsedFeed(articles);
            done();        
        });       
    }, 
    function(err) {
        console.log('All downloaded');
    }
);

function dealWithParsedFeed(articles) {
    console.log(JSON.stringify(articles, null, 4));
}
