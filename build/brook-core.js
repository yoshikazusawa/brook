Namespace('brook').define(function(ns){
    var VERSION = "0.01";
    var Promise = function(next){
        this.next = next ||  function(next,val){ return next(val); };
    };
    (function(proto){
    proto.concat = function(promise){
        var _before = this;
        var after  = promise;
        var next   = function(n,val){
            return _before.subscribe( promise.ready(n),val);
        };
        return new Promise(next);
    };
    proto.bind = function(){
        var r = this;
        for( var i = 0,l = arguments.length;i<l;i++){
            var s = arguments[i];
            s = ( s instanceof Promise) ? s : promise( s );
            r = r.concat( s );
        }
        return r;
    };
    proto.ready = function(n){
        var proc = this.next;
        return function(val){
            return proc(n,val);
        };
    };
    proto.run = function(val){
        this.subscribe( undefined , val );
    };
    proto.subscribe = function(next,val){
        var next = next ? next : function(){};
        if( !this.errorHandler )
            return this.next(next,val);
        
        try {
            this.next(next,val);
        }
        catch(e){
            this.onError(e);
        }
    };
    
    proto.setErrorHandler = function(promise){
        this.errorHandler = promise;
    };
    proto.onError = function(e){
        (this.errorHandler||new Promise).subscribe(function(){},e);
    };
    })(Promise.prototype);

    var promise = function(next){return new Promise(next)};
    ns.provide({
        promise : promise,
        VERSION : VERSION
    });
});

Namespace('brook.util')
.use('brook promise')
.define(function(ns){
    var mapper = function(f){
        return ns.promise(function(next,val){
            return next(f(val));
        });
    };
    var filter = function(f){
        return ns.promise(function(next,val){
            if( f(val) ) return next(val);
        });
    };
    var takeBy = function(by){
        var num = 1;
        var queue = [];
        return ns.promise(function(next,val){
            queue.push( val );
            if( num++ % (by) ==0){
                next(queue);
                queue = [];
            }
        });
    };

    var scatter = function(){
        return ns.promise(function(next,val){
            val.forEach(function(e){
                next(e);
            });
        });
    };
    var wait = function(msec){
        var msecFunc = ( typeof msec == 'function' )
            ? msec : function(){return msec};
        return ns.promise(function(next,val){
            setTimeout(function(){
                next(val);
            },msecFunc());
        });
    };
    var waitUntil = function(f){
        var p = function(next,val){
            if( f() ){
                return next(val);
            }
            setTimeout(function(){ p(next,val)},100);
        };
        return ns.promise(p);
    };
    var debug = function(sig){
        var sig = sig ? sig : "debug";
        return ns.promise(function(next,val){
            console.log(sig + ":",val);
            return next( val );
        });
    };
    var cond = function(f,promise){
        return ns.promise(function(next,val){
            if( !f(val) )
                return next( val );
            promise.subscribe(function(val){
                return next( val );
            },val);
        });
    };
    var match = function(dispatchTable){
        return ns.promise(function(next,val){
            var promise = dispatchTable[val] || dispatchTable['__default__'] || ns.promise();
            promise.subscribe(function(v){
                next(v);
            },val);
        });
    };
    var LOCK_MAP = {};
    var unlock = function(name){
        return ns.promise(function(next,val){
            LOCK_MAP[name] = false;
            next(val);
        });
    };
    var lock = function(name){
        var tryLock = (function(next,val){
            if( !LOCK_MAP[name] ){
                LOCK_MAP[name] = true;
                return next(val);
            }
            setTimeout(function(){
                tryLock(next,val);
            },100);
        });
        return ns.promise(tryLock);
    };

    var emitInterval = function(msec){
        var msecFunc = ( typeof msec == 'function' )
            ? msec : function(){return msec};

        return ns.promise(function(next,val){
            var id = setInterval(function(){
                next(val);
            },msecFunc());
        });
    };
    ns.provide({
        mapper  : mapper,
        filter  : filter,
        scatter : scatter,
        takeBy  : takeBy,
        wait    : wait,
        cond    : cond,
        match   : match,
        debug   : debug,
        lock    : lock,
        unlock  : unlock,
        waitUntil : waitUntil,
        emitInterval: emitInterval
    });
});



Namespace('brook.lang.class')
.define(function(ns){
    ns.provide({
        defineClass: function() {
            var properties = $A(arguments);
            var klass = function() {
                this.initialize.apply(this, arguments);
            }
            for (var i = 0, l = properties.length; i < l; i++)
                for (var property in properties[i]) 
                    klass.prototype[property] = properties[i][property];

            if (!klass.prototype.initialize)
                klass.prototype.initialize = function(){};
            klass.prototype.constructor = klass;
            return klass;
        }
    })
});
Namespace('brook.lamda')
.define(function(ns){
    var cache = {};
    var hasArg = function(expression){
        return expression.indexOf('->') >= 0;
    };
    var parseExpression = function(expression){
        var fixed = hasArg( expression ) ? expression : "$->"+expression;
        var splitted = fixed.split("->");
        var argsExp = splitted.shift();
        var bodyExp = splitted.join('->');
        return {
            argumentNames : argsExp.split(','),
            body   : hasArg(bodyExp) ? lamda( bodyExp ).toString() : bodyExp
        };
    };
    var lamda = function(expression){
        if( cache[expression] )
            return cache[expression];
        var parsed = parseExpression(expression);
        var func = new Function( parsed.argumentNames,"return ("+ parsed.body + ");");
        cache[expression] = func;
        return func;
    };
    ns.provide({
        lamda : lamda
    });
});
Namespace('brook.channel')
.use('brook promise')
.define(function(ns){
    
    var channels = {};
    var queues   = {};
    var register = function(hash,name,val){
        if(!hash[name])
            hash[name] = [];
        hash[name].push(val);
    };

    var Channel = function(){
        this.queue = [];
        this.promises = [];
    };
    (function(proto){

        var through = function(k){return k};
        proto.sendMessage = function(msg){
            this.queue.push(msg);
            while( this.queue.length ){
                var v = this.queue.shift();
                this.promises.forEach(function(p){ p.run( v );});
            }
        };
        proto.send = function(func){
            var func = ( func ) ? func : through;
            var _self = this;
            return ns.promise(function(next,val){
                _self.sendMessage(func(val));
                next(val);
            });
        };
        proto.observe = function(promise){
            this.promises.push(promise);
        };
    })(Channel.prototype);

    var NAMED_CHANNEL = {};
    var getNamedChannel = function(name){
        if( NAMED_CHANNEL[name] )
            return NAMED_CHANNEL[name];
        NAMED_CHANNEL[name] = new Channel;
        return NAMED_CHANNEL[name];
    };
    var observeChannel = function(name,promise){
        getNamedChannel( name ).observe( promise );
    };
    var sendChannel = function(name,func){
        var channel = getNamedChannel( name );
        return channel.send(func);
    };
    ns.provide({
        sendChannel    : sendChannel,
        observeChannel : observeChannel,
        createChannel  : function(){ return new Channel;}
    });
});


Namespace('brook.model')
.use('brook promise')
.use('brook.util *')
.use('brook.channel *')
.use('brook.lamda *')
.define(function(ns){
    var Model = function(obj){
        this.methods = {};
        this.channels= {};
        for( var prop in obj ){
            if( !obj.hasOwnProperty(prop) )
                continue;
            this.addMethod( prop,obj[prop]);
        }
    };
    Model.prototype.addMethod = function(method,promise){
        if( this.methods[method] )
            throw('already '+ method +' defined');
        var channel = ns.createChannel();
        this.methods[method] = promise.bind( channel.send() );
        this.channels[method] = channel;
        return this;
    };
    Model.prototype.notify = function(method){
        return ns.promise().bind( this.methods[method] );
    };
    Model.prototype.observe   = function(method,observer){
        if( !this.channels[method] )
            throw('do not observe undefined method');

        this.channels[method].observe( observer );
        return this;
    
    };
    var createModel = function(){
        return new Model;
    };
    ns.provide({
        createModel : createModel
    });
});

