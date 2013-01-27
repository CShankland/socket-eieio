var WebSocketServer = require("ws").Server;
var msgpack = require("msgpack");

var MESSAGE_TYPES = {
	0: "echo"
};

var MESSAGE_TYPES_REVERSE = {
	"echo": 0
};

var deserializeRegex = /(\d+):(\d+):(\d+):(\d+):(.*)/;
function deserializeAscii(data) {
	var parts = deserializeRegex.exec(data);
	return {
		id: parts[1],
		type: parts[2],
		flags: parts[3],
		timestamp: parts[4],
		body: JSON.parse(parts[5])
	}
}

var FLAG_SUCCESS = 0x01;
var FLAG_ACK     = 0x02;

var HEADER_SIZE = 16; // Bytes

var port = 9999;
var wss = new WebSocketServer({ port: port });
wss.on("connection", function handleNewConnection(ws) {
	ws.on("message", function handleWSMessage(message, flags) {
		var incomingLength = Buffer.byteLength(message);

		var msg;
		if (flags.binary) {
			// TODO:
			// We need to go ahead and grab the header out
			msg = msgpack.unpack(message);
		} else {
			msg = deserializeAscii(message);
		}

		// Echo (with header)
		var packed = msgpack.pack(msg.body);
		var response = new Buffer(packed.length + HEADER_SIZE);
		var time = Date.now();

		// ID - uint32
		response[0] = msg.id >> 24 & 0xFF;
		response[1] = msg.id >> 16 & 0xFF;
		response[2] = msg.id >> 8 & 0xFF;
		response[3] = msg.id & 0xFF;

		// Message Type - uint16
		response[4] = msg.type >> 8 & 0xFF;
		response[5] = msg.type & 0xFF;

		// Flags - uint 16
		response[6] = 0;
		response[7] = (FLAG_SUCCESS | FLAG_ACK);

		// Timestamp - uint64
		response[ 8] = (time >> 56) & 0xFF;
		response[ 9] = (time >> 48) & 0xFF;
		response[10] = (time >> 40) & 0xFF;
		response[11] = (time >> 32) & 0xFF;
		response[12] = (time >> 24) & 0xFF;
		response[13] = (time >> 16) & 0xFF;
		response[14] = (time >>  8) & 0xFF;
		response[15] = (time      ) & 0xFF;

		packed.copy(response, 16);

		var responseLength = response.length;
		console.log("Received: " + incomingLength + " bytes.  Responded with: " + responseLength + " bytes");

		ws.send(response, { binary: true });
	});
});

console.log("Started WebSocketServer on port " + port);
