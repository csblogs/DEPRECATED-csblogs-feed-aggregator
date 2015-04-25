var FeedParser = require('feedparser');
var request = require('request')
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
			downloadFeed(blogger.feedUrl, done);
	    }, 
	    function(err) {
	        if(!err) {
	            console.log('All feeds downloaded, parsed and new items added to db');
	        	process.exit();
			}
	        else {
	            console.error('[FATAL] %j', err);        
	        }
	    }
	);
}

function downloadFeed(feedUrl, callback) {
	var req = request(feedUrl, {timeout: 10000, pool: false});
	req.setMaxListeners(50);
	  // Some feeds do not respond without user-agent and accept headers.
	req.setHeader('user-agent', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_8_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/31.0.1650.63 Safari/537.36')
	req.setHeader('accept', 'text/html,application/xhtml+xml');
	
	
	req.on('error', function (error) {
      console.error(error);
    })
    .pipe(new FeedParser())
    .on('error', function (error) {
      console.error(error);
    })
    .on('meta', function (meta) {
      console.log('===== Downloading %s =====', meta.title);
    })
    .on('readable', function() {
      var stream = this, item;
      while (item = stream.read()) {
		  console.log("%j", item);
		  console.log('\n\n\n\n\n\n\n');
      }
    })
	.on('end', function() {
		callback();
	});;
}