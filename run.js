var FeedParser = require('feedparser');
var request = require('request')
var async = require('async');
var req = require('request');
var mongoose = require('mongoose');
var blogger = require('./models/blogger').Blogger;
var blog = require('./models/blog').Blog;

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
			downloadFeed(blogger, done);
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

function downloadFeed(blogger, callback) {
	var req = request(blogger.feedUrl, {timeout: 10000, pool: false});
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
		  insertBlogPostToDBIfNew(blogger, item);
      }
    })
	.on('end', function() {
		callback();
	});;
}

function insertBlogPostToDBIfNew(blogger, blogPost) {
    blog.findOne({userProvider: blogger.userProvider, userId: blogger.userId, pubDate: blogPost.pubdate}, function(error, blogPostFromDB) {
        if (error) {
			console.error("[ERROR] Looking up blog \n %j \n\n got error: \n %j \n\n\n\n", blogPost, err);
		}
		else {
			if(!blogPostFromDB) {
				//No blog, add as new
				console.log('Adding \'%s\' as new blog post', blogPost.title);
				insertNewBlog(blogPost, blogger);
			}
			else {
				//Blog already exists. Has it been updated?
				if(blogPost.date != blogPostFromDB.updateDate) {
					//Blog has been updated
					console.log('Updating \'%s\'', blogPost.title);
					updateBlog(blogPost, blogPostFromDB, blogger);
				}
				else {
					//Blog has not been updated
					console.log('\'%s\' is already in DB and will not be updated.', blogPost.title);
				}
			}
		}
	});
	
	function insertNewBlog(blogPost, blogger) {
		var newBlog = new blog({
			// Author Details
			userProvider : blogger.userProvider,
			userId : blogger.userId,

			// Information about blog
			title: blogPost.title,
			imageUrl : blogPost.image,
			summary : blogPost.summary,
			pubDate : blogPost.pubdate,
			updateDate : blogPost.date,
			link : blogPost.link
		});
		newBlog.save();
	}
	
	function updateBlog(blogPost, blogPostFromDB, blogger) {
		blog.update(blogPostFromDB, blogPost, {multi: false}, function(err, numAffected) {
			if(!err) {
				console.log('Updated blog \'%s\' sucessfully', blogPost.title);
			}
			else {
				console.log('[ERROR] Error updating \'%s\' \n %j', blogPost.title, err)
			}
		})
	}
}