Namespace('brook.net.applicationcache')
.use('brook promise')
.use('brook.model createModel')
.define(function(ns) {
    'use strict';

    var appCache = window.applicationCache;
    var names    = 'checking downloading updateready cached error'.split(' ');
    var noop     = ns.promise();

    var listenerise = function(name) {
        return 'on' + name.charAt(0).toUpperCase() + name.substring(1);
    };

    var args  = names.reduce(function(memo, name) {
        memo[listenerise(name)] = noop;
        return memo;
    }, {});

    var model = ns.createModel(args)
    .addMethod('update', ns.promise(function(n, v){
        appCache.update();
    }))
    .addMethod('swapCache', ns.promise(function(n, v){
        appCache.swapCache();
    }));

    names.forEach(function(name) {
        appCache.addEventListener(name, 
            model.notify(listenerise(name)).ready());
    });

    ns.provide({
        getModel: function() { return model; }
    });
});
