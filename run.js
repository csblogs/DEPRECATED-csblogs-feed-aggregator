var feed = require('feed-read');
var http = require('http');
var async = require('async');
var req = require('request');
var mongoose = require('mongoose');
var blogger = require('./models/blogger').Blogger;

// Get database connection
mongoose.connect(process.env.CUSTOMCONNSTR_MONGODB_URI || 'mongodb://localhost');

var database = mongoose.connection;
database.on('error', console.error.bind(console, 'MongoDB Connection Error:'));
database.once('open', function (callback) {
    console.log('Database connection established successfully.')
    
    // Get all feed URLs
    blogger.find({}, function(error, allBloggers) {
        if (error) {
			console.log("[FATAL] %j", err);
		}
		else {
			if(!allBloggers) {
				console.log("[WARN] No bloggers in DB");
			}
			else {
				downloadAllFeeds(allBloggers);
			}
		}
	});
});

// Download all RSS/ATOM feeds and process them.
function downloadAllFeeds(allBloggers) {
	async.each(allBloggers,
	    function(blogger, done) {
	        feed(blogger.feedUrl, function(err, articles) {
	            dealWithParsedFeed(articles);
	            done();        
	        });       
	    }, 
	    function(err) {
	        if(!err) {
	            console.log('All feeds downloaded, parsed and new items added to db');
	        }
	        else {
	            console.error('[FATAL] %j', err);        
	        }
	    }
	);
}


function dealWithParsedFeed(articles) {
    console.log(JSON.stringify(articles, null, 4));
}
