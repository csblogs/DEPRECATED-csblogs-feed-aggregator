"use strict";

var FeedParser = require('feedparser');
var request = require('request')
var async = require('async');
var req = require('request');
var mongoose = require('mongoose');
var blogger = require('./models/blogger').Blogger;
var blog = require('./models/blog').Blog;
var jsdom = require("jsdom");
var URI = require('URIjs'); 

// Get database connection
mongoose.connect(process.env.CUSTOMCONNSTR_MONGODB_URI || 'mongodb://localhost');

var database = mongoose.connection;
database.on('error', console.error.bind(console, 'MongoDB Connection Error:'));
database.once('open', function(callback) {
    console.log('[INFO] Database connection established successfully.');

    // Get all feed URLs
    blogger.find({}, function(error, allBloggers) {
        if (error) {
            console.log("[FATAL] %j", error);
        } else {
            if (!allBloggers) {
                console.log("[WARN] No bloggers in DB");
            } else {
                downloadAllFeeds(allBloggers);
            }
        }
    });
});

// Download all RSS/ATOM feeds and process them.
var changesOccured = 0;
function downloadAllFeeds(allBloggers) {
    async.each(allBloggers, function(blogger, done) {
        downloadFeed(blogger, done);
    },
    function(err) {
        if (!err) {
            if(changesOccured > 0) {
                console.log('[END] %d changes were made to database...', changesOccured);
            }
            else {
                console.log('[END] No changes were made to the Database');
            }
            process.exit();
        } else {
            console.error('[FATAL] %j', err);
        }
    });
}

function downloadFeed(blogger, callback) {
    var req = request(blogger.feedUrl, {
        timeout: 10000,
        pool: false
    });
    req.setMaxListeners(50);
    
    // Some feeds do not respond without user-agent and accept headers.
    req.setHeader('user-agent', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_8_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/31.0.1650.63 Safari/537.36')
    req.setHeader('accept', 'text/html,application/xhtml+xml');
    
    var items = [];

    req.on('error', function(error) {
        console.error(error);
    })
    .pipe(new FeedParser())
    .on('error', function(error) {
        console.error(error);
    })
    .on('meta', function(meta) {
        //if(meta["rss:lastbuilddate"] && meta["rss:lastbuilddate"]["#"]) {
            //We could use meta["rss:lastbuilddate"]["#"] to determine whether to bother even parsing the feed.
            //This would require another db to hold lastbuilddates so I haven't implemented it yet 
        //}
    })
    .on('readable', function() {
        var stream = this, item;
        while (item = stream.read()) {
            items.push(item);
        }
    })
    .on('end', function() {
        async.each(items, function(item, done) {
            insertBlogPostToDBIfNew(blogger, item, done);
        }, function(err) {
            callback();
        });
    });;
}

function insertBlogPostToDBIfNew(blogger, blogPost, done) {
    blog.findOne({
        userProvider: blogger.userProvider,
        userId: blogger.userId,
        pubDate: blogPost.pubdate
    }, function(error, blogPostFromDB) {
        if (error) {
            console.error("[ERROR] Looking up blog \n %j \n\n got error: \n %j \n\n\n\n", blogPost, error);
        } else {
            if (!blogPostFromDB) {
                //No blog, add as new
                console.log('[INFO] Adding \'%s\' as new blog post', blogPost.title);
                insertNewBlog(blogPost, blogger, done);
            } else {
                //Blog already exists. Has it been updated?
                if (blogPost.date.getTime() != blogPostFromDB.updateDate.getTime()) {
                    //Blog has been updated
                    console.log('[INFO] Updating \'%s\'', blogPost.title);
                    updateBlog(blogPost, blogPostFromDB, blogger, done);
                } else {
                    //Blog has not been updated
                    console.log('[INFO] \'%s\' is already in DB and will not be updated.', blogPost.title);
                    done();
                }
            }
        }
    });

    function insertNewBlog(blogPost, blogger, done) { 
        grabImage(blogPost, function (image) {
            var newBlog = new blog({
                // Author Details
                userProvider: blogger.userProvider,
                userId: blogger.userId,
    
                // Information about blog
                title: blogPost.title,
                imageUrl: image,
                summary: blogPost.summary,
                pubDate: setDate(blogPost.pubdate),
                updateDate: setDate(blogPost.date),
                link: blogPost.link
            });
    
            newBlog.save(); 
            changesOccured++;
            done();
        });
    }

    function updateBlog(blogPost, blogPostFromDB, blogger, done) {
        //This can be implemented much more effeciency...
        //However, am reusing insertNewBlog() because its not quite as simple as updating fields.
        //Have to re-grab images etc.
        blog.find(blogPostFromDB).remove(function() {
            insertNewBlog(blogPost, blogger, done);
        });   
    }

    function grabImage(blogPost, done) {
        if ((blogPost.image) && (blogPost.image.url)) {
            //If the RSS/ATOM feed is nice enough to tell us an image to use, use it.
            done(blogPost.image.url.split("?")[0]); //This fixes the fact that Wordpress tries to give us a small thumbnail 
            //by attaching a width query. ?w=150 for example
        }
        else {
            jsdom.env(
                blogPost.description,
                function(errors, window) {
                    var imgs = window.document.getElementsByTagName('img');
                    
                    if (imgs && !errors && imgs.length > 0) {
                        var firstImageUrl = new URI(imgs[0].getAttribute('src'));
                        var blogPostLink = new URI(blogPost.link);
                       
                        var image = "";
                        if(firstImageUrl.is("relative")) {
                            image = blogPostLink.protocol() + "://" + blogPostLink.domain() + "/" + firstImageUrl.toString();
                        }
                        else {
                            image = firstImageUrl.toString();
                        }
                        
                        done(image);
                    }
                    else {
                        done(null); //An error occured or no images in post
                    }
                }
            );
        }
    }
    
    function setDate(dateString) {
        var date = new Date(dateString);
        
        if (isValidDate(date)) {
            return date;
        }
        else {
            return new Date();
            // Returning today's date as it seems likely the blog was posted
            // on the day the aggregator puts it in the database.
        }
    }
    
    function isValidDate(date) {
        if (Object.prototype.toString.call(date) !== "[object Date]")
            return false;
        return !isNaN(date.getTime());
    }
}
