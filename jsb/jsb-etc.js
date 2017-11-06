/****************************************************************************
 Copyright (c) 2013-2016 Chukong Technologies Inc.

 http://www.cocos.com

 Permission is hereby granted, free of charge, to any person obtaining a copy
 of this software and associated engine source code (the "Software"), a limited,
  worldwide, royalty-free, non-assignable, revocable and  non-exclusive license
 to use Cocos Creator solely to develop games on your target platforms. You shall
  not use Cocos Creator software for developing other software or tools that's
  used for developing games. You are not granted to publish, distribute,
  sublicense, and/or sell copies of Cocos Creator.

 The software or tools in this License Agreement are licensed, not sold.
 Chukong Aipu reserves all rights not expressly granted to you.

 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 THE SOFTWARE.
 ****************************************************************************/

'use strict';

cc.sys.now = function () {
    return Date.now();
};

var NORMALIZE_RE = /[^\.\/]+\/\.\.\//;

// cc.path
cc.js.mixin(cc.path, {
    //todo make public after verification
    _normalize: function (url) {
        var oldUrl = url = String(url);

        //removing all ../
        do {
            oldUrl = url;
            url = url.replace(NORMALIZE_RE, '');
        } while (oldUrl.length !== url.length);
        return url;
    },

    // The platform-specific file separator. '\\' or '/'.
    sep: (cc.sys.os === cc.sys.OS_WINDOWS ? '\\' : '/'),

    // @param {string} path
    stripSep (path) {
        return path.replace(/[\/\\]$/, '');
    }
});

// cc.Scheduler
var _callbackId = 0;
cc.Scheduler.prototype.schedule = function (callback, target, interval, repeat, delay, paused) {
    if (delay === undefined || paused === undefined) {
        paused = !!repeat;
        repeat = cc.macro.REPEAT_FOREVER;
    }
    else {
        paused = !!paused;
        repeat = isFinite(repeat) ? repeat : cc.macro.REPEAT_FOREVER;
    }
    delay = delay || 0;
    var instanceId = target.__instanceId || target.uuid;
    cc.assertID(instanceId !== undefined, 1510);
    if (!callback.__callbackId) {
        callback.__callbackId = _callbackId++;
    }
    var key = instanceId + '_' + callback.__callbackId;
    this._schedule(target, callback, interval, repeat, delay, paused, key);
};
cc.Scheduler.prototype.scheduleUpdate = cc.Scheduler.prototype.scheduleUpdateForTarget;
cc.Scheduler.prototype._unschedule = cc.Scheduler.prototype.unschedule;
cc.Scheduler.prototype.unschedule = function (callback, target) {
    if (typeof target === 'function') {
        var tmp = target;
        target = callback;
        callback = tmp;
    }
    if (callback.__callbackId === undefined) {
        return;
    }

    var instanceId = target.__instanceId || target.uuid;
    cc.assertID(instanceId !== undefined, 1510);
    var key = instanceId + '_' + callback.__callbackId;
    this._unschedule(key, target);
};
cc.Scheduler.prototype._isScheduled = cc.Scheduler.prototype.isScheduled;
cc.Scheduler.prototype.isScheduled = function (callback, target) {
    if (typeof target === 'function') {
        var tmp = target;
        target = callback;
        callback = tmp;
    }
    if (callback.__callbackId === undefined) {
        return;
    }

    var instanceId = target.__instanceId || target.uuid;
    cc.assertID(instanceId !== undefined, 1510);
    var key = instanceId + '_' + callback.__callbackId;
    this._isScheduled(key, target);
};

// Node
var nodeProto = cc.Node.prototype;
cc.defineGetterSetter(nodeProto, "_parent", nodeProto.getParent, nodeProto.setParent);

// View
cc.view.isViewReady = cc.view.isOpenGLReady;
cc.view.setOrientation = function () {};

// setTimeout, setInterval, clearTimeout, clearInteval
var _windowTimeIntervalId = 0;
var _windowTimeFunHash = {};
var WindowTimeFun = function (code) {
    this.__instanceId = cc.ClassManager.getNewInstanceId();
    this._intervalId = _windowTimeIntervalId++;
    this._code = code;
};

WindowTimeFun.prototype.fun = function () {
    if (!this._code) return;
    var code = this._code;
    if (typeof code === 'string') {
        Function(code)();
    }
    else if (typeof code === 'function') {
        code.apply(null, this._args);
    }
};

/**
 * overwrite window's setTimeout
 @param {String|Function} code
 @param {number} delay
 @return {number}
 */
window.setTimeout = function (code, delay, ...args) {
    var target = new WindowTimeFun(code);
    if (args.length > 0) {
        target._args = args;
    }
    var original = target.fun;
    target.fun = function () {
        original.call(this);
        clearTimeout(target._intervalId);
    };
    cc.director.getScheduler().schedule(target.fun, target, delay / 1000, 0, 0, false);
    _windowTimeFunHash[target._intervalId] = target;
    return target._intervalId;
};

/**
 * overwrite window's setInterval
 @param {String|Function} code
 @param {number} delay
 @return {number}
 */
window.setInterval = function (code, delay, ...args) {
    var target = new WindowTimeFun(code);
    if (args.length > 0) {
        target._args = args;
    }
    cc.director.getScheduler().schedule(target.fun, target, delay / 1000, cc.macro.REPEAT_FOREVER, 0, false);
    _windowTimeFunHash[target._intervalId] = target;
    return target._intervalId;
};

/**
 * overwrite window's clearInterval
 @param {number} intervalId
 */
window.clearInterval = function (intervalId) {
    var target = _windowTimeFunHash[intervalId];
    if (target) {
        cc.director.getScheduler().unschedule(target.fun, target);
        delete _windowTimeFunHash[intervalId];
    }
};
window.clearTimeout = clearInterval;

// SocketIO
if (window.SocketIO) {
    window.io = window.SocketIO;
    SocketIO.prototype._jsbEmit = SocketIO.prototype.emit;
    SocketIO.prototype.emit = function (uri, delegate) {
        if (typeof delegate === 'object') {
            delegate = JSON.stringify(delegate);
        }
        this._jsbEmit(uri, delegate);
    };
}

cc.Node.prototype.setIgnoreAnchorPointForPosition = cc.Node.prototype.ignoreAnchorPointForPosition;

// ccsg
window._ccsg = {
    Node: cc.Node,
    Scene: cc.Scene,
    Sprite: cc.Sprite,
    ParticleSystem: cc.ParticleSystem,
    Label: cc.Label,
    EditBox: cc.EditBox,
    VideoPlayer: cc.VideoPlayer,
    WebView: cc.WebView,
    TMXTiledMap: cc.TMXTiledMap,
    TMXObjectGroup: cc.TMXObjectGroup,
    TMXObject: cc.TMXObject,
    TMXObjectImage: cc.TMXObjetImage,
    TMXObjectShape: cc.TMXObjectShape,
    TMXLayer: cc.TMXLayer,
    MotionStreak: cc.MotionStreak,
    CameraNode: cc.CameraNode
};

// fix cc.formatStr (#2630)
cc.formatStr = cc.js.formatStr;

// disabled premultiplied alpha for png
if (cc.Image && cc.Image.setPNGPremultipliedAlphaEnabled) {
    cc.Image.setPNGPremultipliedAlphaEnabled(false);
}

// __errorHandler
// window.__errorHandler = function (filename, lineno, message, stack) {
// };

// global cleanup. Dangerous!!! please do not invoke this function, it's used internally by the restart process
window.__cleanup = function () {
    // Destroy scene
    cc.director.getScene().destroy();
    cc.Object._deferredDestroy();
    // Reset other js caches
    cc.js._registeredClassIds = {};
    cc.js._registeredClassNames = {};
    // Cleanup loader
    cc.loader.releaseAll();
    // Cleanup textureCache
    cc.textureCache.removeAllTextures();
};
