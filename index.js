var request = require('request'),
    cheerio = require('cheerio'),
    fields = require('./lib/fields'),
    utils = require('./lib/utils');

var Item = function () {};

Item.prototype.setProp = function(key, value) {
    this[key] = value;
};

var getOpenGraph = function(options, callback) {
    var cb = callback || utils.createPromiseCallback();

    request(options, function(err, response, body) {
        if(!err && response.statusCode === 200) {
            var $ = cheerio.load(body),
                title = $('head title'),
                meta = $('head').find('meta[property*="og:"], meta[property*="fb:"], meta[property*="twitter:"]'),
                openGraph = {};

            meta.each(function(idx) {
                var key = $(this).attr('property');
                var value = $(this).attr('content');
                var data = fields[key];
                var groupItem;
                
                if (!data) return;

                if (!data.group) {
                    openGraph[data.fieldName] = value;
                } else if (data.type === 'item') {
                    openGraph[data.group] = new Item();
                    openGraph[data.group].setProp(data.fieldName, value);
                } else if (data.type === 'array') {
                    if (Array.isArray(openGraph[data.group])) {
                        groupItem = openGraph[data.group][openGraph[data.group].length - 1];
                    } else {
                        groupItem = openGraph[data.group];
                    }
                    groupItem = openGraph[data.group] || {};
                    groupItem[data.fieldName] = openGraph[data.group][data.fieldName] || [];
                    groupItem[data.fieldName].push(value);
                } else {
                    if (data.type === 'arrayItem') {
                        groupItem = new Item();
                        openGraph[data.group] = openGraph[data.group] || [];
                        openGraph[data.group].push(groupItem);
                    } else if (Array.isArray(openGraph[data.group])) {
                        groupItem = openGraph[data.group][openGraph[data.group].length - 1];
                    }

                    groupItem.setProp(data.fieldName, value);
                }
            });

            if (!openGraph.title) {
                openGraph.title = title.text();
            }

            if(!openGraph.image || openGraph.image.length==0){
                openGraph.image = [];
                var href = response.request.href;
                if (href.lastIndexOf('/')==href.length-1){
                    href = href.substring(0, href.length - 1);
                }
                if (href.indexOf('http')!=0){
                    href = 'http://'+href;
                }
                $('img').each(function(){
                    var image = {};
                    for(var key in $(this)[0].attribs){
                        if(key==='src'){
                            image.url = $(this).attr('src');
                        }else{
                            image[key] = $(this).attr(key);
                        }
                    }

                    if(!!image.url){
                        if(image.url.indexOf('//')==0){
                            image.url = 'http:'+image.url;
                        }
                        if(image.url.indexOf('/')==0){
                            image.url = href+image.url;
                        }
                        if(image.url.indexOf('http')!=0){
                            image.url = href+'/'+image.url;
                        }
                        openGraph.image.push(image);
                    }
                });
            }

            if(!openGraph.description || openGraph.description.length==0){
                var selector = 'body';
                if($('body p').length>0){
                    selector='body p';
                }
                if($('#main p').length>0){
                    selector='#main p';
                }
                if($('#content p').length>0){
                    selector='#content p';
                }
                if($('#bodyContent p').length>0){
                    selector='#bodyContent p';
                }
                var desc = $(selector).text().replace(/(?=\s)[^ ]/g, ' ').trim().substr(0, 512);
                var endIndex = desc.lastIndexOf('. ');
                desc = desc.substr(0, endIndex!=-1?endIndex+1: desc.length+1);
                openGraph.description = desc;
            }

            cb(null, openGraph);
        } else {
            cb(err);
        }
    });

    return cb.promise;
};

module.exports = getOpenGraph;
