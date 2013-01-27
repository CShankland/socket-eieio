(function (global) {
Function.prototype.method = function(name, func) {
    this.prototype[name] = func;
    return this;
 };

Function.method('inherits', function(parent) {
    this.prototype.__proto__ = parent.prototype;
    return this;
});

// Define an EventEmitter class
(function() {
	function EventEmitter() {
		this.__listeners = {};
	};

	EventEmitter.prototype.initialize = function initializeEventEmitter() {
		this.__listeners = {};
	};

	EventEmitter.prototype.once = function once(eventName, fn, scope) {
		if (! this.__listeners[eventName]) {
			this.__listeners[eventName] = [];
		}

		this.__listeners[eventName].push({
			fn: function() {
				fn.apply(scope, arguments);
				this.removeEventListener(eventName, fn, scope);
			},
			scope: this
		});
	};

	EventEmitter.prototype.addEventListener = function addEventListener(eventName, fn, scope) {
		if (! this.__listeners[eventName]) {
			this.__listeners[eventName] = [];
		}

		this.__listeners[eventName].push({
			fn: fn,
			scope: scope
		});
	};

	EventEmitter.prototype.on = EventEmitter.prototype.addEventListener;

	EventEmitter.prototype.removeEventListener = function removeEventListener(eventName, fn, scope) {
		var listeners = this.__listeners[eventName];
		if (! listeners || 0 === listeners.length) {
			return false;
		}

		for (var idx = 0, len = listeners.length; idx < len; ++i) {
			if (listeners[idx].fn === fn && listeners[idx].scope === scope) {
				this.__listeners[eventName].splice(idx, 1);
				return true;
			}
		}

		return false;
	};

	EventEmitter.prototype.fireEvent = function fireEvent(eventName) {
		var listeners = this.__listeners[eventName];
		if (undefined === listeners || 0 === listeners.length) {
			return;
		}

		for (var idx = 0, len = listeners.length; idx < len; ++idx) {
			listeners[idx].fn.apply(listeners[idx].scope, arguments);
		}
	};

	EventEmitter.prototype.destroy = function destroy() {
		var listenerTypes = Object.keys(this.__listeners);
		for (var idx = 0, len = listenerTypes.length; idx < len; ++idx) {
			this.__listeners[listenerTypes[idx]].clear();
			delete this.__listeners[listenerTypes[idx]];
		}

		delete this.__listeners;
	};

	global.EventEmitter = EventEmitter;
}());

function Transport(host, options) {
	EventEmitter.prototype.initialize.apply(this);

	// Map of id to callback
	this.__callbackMap = {};

	var me = this;
	var wsUrl = "ws://" + host + (options.port ? ":" + options.port : "");
	this.__ws = new WebSocket(wsUrl);
	this.__ws.binaryType = "arraybuffer";
	this.__ws.onmessage = function onMessage(messageEvent) {
		console.log("Got message:", messageEvent);
		me.__handleMessage(messageEvent);
	}
	this.__ws.onopen = function onOpen() {
		console.log("Connection to " + wsUrl + " open.", this);
		me.fireEvent("connected", this);
	}
	this.__ws.onclose = function onClose(closeEvent) {
		console.log("Got close:", closeEvent);
		me.fireEvent("close", closeEvent);
	}
	this.__ws.onerror = function onError() {
		console.log("Got error", arguments);
		me.fireEvent("error");
	}
};

Transport.inherits(EventEmitter);

Transport.prototype.send = function send(data, callback) {
	var message = MessageFactory.createMessage(data);
	this.__callbackMap[message.id] = callback;
	this.__ws.send(message.serialize());
};

Transport.prototype.__handleMessage = function __handleMessage(data) {
	var message = MessageFactory.deserializeMessage(data);

	// If this is an ack, then we need to deal with our callback
	if (message.ack) {
		var callback = this.__callbackMap[message.id];
		if (callback) {
			callback(message.body);
			delete this.__callbackMap[message.id];
		}
	}

	// Now we fire an event with this message
	this.fireEvent(message.type, message.body);
};

var MESSAGE_TYPES = {
	0: "echo"
};

var FLAG_ACK = 0x02;

var localMessageId = 1;
//                       ID   Type  Flags Time  Body
var deserializeRegex = /(\d+):(\d+):(\d+):(\d+):(.*)/;

var MessageFactory = {
	createMessage: function createMessage(data) {
		return {
			id: localMessageId++,
			serialize: function serialize() {
				// ID, type, flags, timestamp, body
				return [this.id, 0, 0, Date.now(), JSON.stringify(data)].join(":");
			}
		}
	},

	deserializeMessage: function deserializeMessage(messageEvent) {
		var data = messageEvent.data;
		if (data instanceof ArrayBuffer) {
			return this.__deserializeBinaryData(data);
		} else {
			return this.__deserializeTextMessage(data);
		}
	},

	__deserializeTextMessage: function __deserializeTextMessage(data) {
		var parts = deserializeRegex.exec(data);
		return {
			ack: true,
			id: parts[1],
			type: MESSAGE_TYPES[parts[2]],
			flags: parts[3],
			timestamp: parts[4],
			body: JSON.parse(parts[5])
		}
	},

	__deserializeBinaryData: function __deserializeBinaryData(data) {
		var dataArray = new Uint8Array(data);

		// Header
		var id = 	(dataArray[ 0] << 24) |
				 	(dataArray[ 1] << 16) | 
				 	(dataArray[ 2] <<  8) |
				  	 dataArray[ 3];
		var type =  (dataArray[ 4] <<  8) |
					 dataArray[ 5];
		var flags = (dataArray[ 6] <<  8) |
					 dataArray[ 7];
		var time =  (dataArray[ 8] << 56) |
				    (dataArray[ 9] << 48) |
				    (dataArray[10] << 40) |
				    (dataArray[11] << 32) |
				    (dataArray[12] << 24) |
				    (dataArray[13] << 16) |
				    (dataArray[14] <<  8) |
				     dataArray[15];
		var body;
		msgpack.unpack(data, dataArray, 16, 0, function handleUnpackResult(result) {
			body = result;
		});

		return {
			id: id,
			ack: (flags & FLAG_ACK),
			type: MESSAGE_TYPES[type],
			flags: flags,
			timestamp: time,
			body: body
		};
	}
};

global.Transport = Transport;
global.MessageFactory = MessageFactory;

}(window || self));