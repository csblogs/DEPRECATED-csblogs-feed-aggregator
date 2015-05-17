# Computer Science Blogs [![Build Status](https://travis-ci.org/csblogs/csblogs-web-app.svg?branch=master)](https://travis-ci.org/csblogs/csblogs-web-app)
## Microsoft Azure RSS/ATOM Feed Aggregation Webjob

This is the repository for the Azure Webjob (cronjob compatible) RSS/ATOM feed aggregator which powers CS Blogs.

For more information about the Computer Science Blogs project, and to view the other repositories please [click here](https://github.com/csblogs/).

The webjob is contained in its own git repository to highlight the fact that it is completely sandboxed from anything the web application does.

The webjob runs once every 5 minutes, downloads all feeds from all CS Blogs contributors, and checks if any are new. If so they are added to the database of blog posts maintained in our MongoDB database.
