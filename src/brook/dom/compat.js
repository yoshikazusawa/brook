
Namespace('brook.dom.compat')
.define(function(ns){
    var dataset = (function(){
        var wrapper = function(element){
            return element.dataset;
        };
        if( window["HTMLElemenT"] && HTMLElement.prototype ){
            var proto = HTMLElement.prototype;
            if( proto.dataset ) 
                return wrapper;
            if( proto.__lookupGetter__ && proto.__lookupGetter__('dataset') ) 
                return wrapper;
        }
        var camelize = function(string){
            return string.replace(/-+(.)?/g, function(match, chr) {
              return chr ? chr.toUpperCase() : '';
            });
        };
        return function(element){
            var sets = {};
            for(var i=0,a=element.attributes,l=a.length;i<l;i++){
                var attr = a[i];
                if( !attr.name.match(/^data-/) ) continue;
                sets[camelize(attr.name.replace(/^data-/,''))] = attr.value;
            }
            return sets;
        };
    })();
    
    var ClassList = function(element){
        this._element = element;
        this._refresh();
    };
    var classList = function(element){
        return new ClassList(element);
    };

    ClassList.prototype = new Array;
    (function(proto){
        var check = function(token) {
            if (token == "") {
                throw "SYNTAX_ERR";
            }
            if (token.indexOf(/\s/) != -1) {
                throw "INVALID_CHARACTER_ERR";
            }
        };
        this._fake = true;
        this._refresh = function () {
            var clss = this._element.getAttribute("class");
            if (!clss) {
                return this;
            }
            var classes = clss.split(/\s+/);
            if (classes.length && classes[0] == "") {
                classes.shift();
            }
            if (classes.length && classes[classes.length - 1] == "") {
                classes.pop();
            }
            this.length = classes.length;
            if (this.length == 0) {
                return this;
            }
            for (var i = 0; i < this.length; ++i) {
                this[i] = classes[i];
            }
            return this;
        };
        this.item = function (i) {
            return this[i] || null;
        }
        this.contains = function (token) {
            check(token);
            for (var i = 0; i < this.length; ++i) {
                if (this[i] == token) {
                    return true;
                }
            }
            return false;
        }
        this.add = function (token) {
            check(token);
            for (var i = 0; i < this.length; ++i) {
                if (this[i] == token) {
                    return;
                }
            }
            this.push(token);
            this._element.setAttribute("class", this.join(" "));
        }
        this.remove = function (token) {
            check(token);
            for (var i = 0; i < this.length; ++i) {
                if (this[i] == token) {
                    this.splice(i, 1);
                    this._element.setAttribute("class", this.join(" "));
                }
            }
        }
        this.toggle = function (token) {
            check(token);
            for (var i = 0; i < this.length; ++i) {
                if (this[i] == token) {
                    this.remove(token);
                    return false;
                }
            }
            this.add(token);
            return true;
        }
    }).apply(ClassList.prototype);

    var hasClassName = function(element,className){
        var classSyntax = element.className;
        if ( !(classSyntax && className) ) return false;
        return (new RegExp("(^|\\s)" + className + "(\\s|$)").test(classSyntax)); 
    };
    var getElementsByClassName = function(className){
        if( document.getElementsByClassName ) return document.getElementsByClassName( className );
        var allElements = document.getElementsByTagName('*');
        var ret = [];
        for(var i=0,l=allElements.length;i<l;i++){
            if( !hasClassName( allElements[i] , className ) )
                continue;
            ret.push( allElements[i] )
        }
        return ret;
    };

    ns.provide({
        getElementsByClassName : getElementsByClassName,
        hasClassName : hasClassName,
        dataset   : dataset,
        classList : classList
    });
});
