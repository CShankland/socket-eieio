(function(exports) {

// Each of these unpack functions take in a single parameter
// That parameter is an object that contains the following properties
// 
// idx: The current index of the deserialization
// data: The raw data in the form of an ArrayBuffer
// 
// The functions are expected to modify their input to facilitate
// the rest of the deserialization.  The return value is the result
// of deserialization.

// Positive Fixed Range Number (0XXXXXXX)
function unpackPositiveFixNum(input) {
	return input.data[input.idx++];
};

// Negative Fixed Range Number (111XXXX)
function unpackNegativeFixNum(input) {
	return input.data[input.idx++] - 0x0100;
};

// uint8 - Stored in 2 bytes
// 11001100 XXXXXXXX
function unpackUInt8(input) {
	input.idx += 2;
	return input.data[input.idx - 1];
};

// uint16 - Stored in 3 bytes
// 11001101 XXXXXXXX XXXXXXXX
function unpackUInt16(input) {
	input.idx += 3;
	return input.data[input.idx - 2] << 8 | input.data[input.idx - 1];
};

// uint32 - Stored in 5 bytes
// 11001110 XXXXXXXX XXXXXXXX XXXXXXXX XXXXXXXX
function unpackUInt32(input) {
	input.idx += 5;
	return input.data[input.idx - 4] << 24 |
		   input.data[input.idx - 3] << 16 |
		   input.data[input.idx - 2] <<  8 |
		   input.data[input.idx - 1];
};

// uint64 - Stored in 9 bytes
// 11001111 XXXXXXXX XXXXXXXX XXXXXXXX XXXXXXXX XXXXXXXX XXXXXXXX XXXXXXXX XXXXXXXX
function unpackUInt64(input) {
	input.idx += 9;
	// Due to javascript being super dumb, we can't just shift (all values in a shift
	// operation are converted to int32), so we have to multiply
	return input.data[input.idx - 8] * 0x0100000000000000 +
		   input.data[input.idx - 7] * 0x0001000000000000 +
		   input.data[input.idx - 6] * 0x0000010000000000 +
		   input.data[input.idx - 5] * 0x0000000100000000 +
		   input.data[input.idx - 4] * 0x0000000001000000 +
		   input.data[input.idx - 3] * 0x0000000000010000 +
		   input.data[input.idx - 2] * 0x0000000000000100 +
		   input.data[input.idx - 1];
};

// int8 - Stored in 2 bytes
// 1101000 XXXXXXXX
function unpackInt8(input) {
	input.idx += 2;
	return (input.data[input.idx - 1] & 0x80 ? -1 : 1) * 
		   (input.data[input.idx - 1] & 0x7F);
};

// int16 - Stored in 3 bytes
// 11010001 XXXXXXXX XXXXXXXX
function unpackInt16(input) {
	input.idx += 3;
	return (input.data[input.idx - 2] & 0x80 ? -1 : 1) * 
		   (input.data[input.idx - 2] & 0x7F) << 8 |
		   (input.data[input.idx - 1]);
};

// int32 - Stored in 5 bytes
// 11010010 XXXXXXXX XXXXXXXX XXXXXXXX XXXXXXXX
function unpackInt32(input) {
	input.idx += 5;
	return (input.data[input.idx - 4] & 0x80 ? -1 : 1) * 
		   (input.data[input.idx - 4] & 0x7F) << 24 |
		   (input.data[input.idx - 3]       ) << 16 |
		   (input.data[input.idx - 2]       ) <<  8 |
		   (input.data[input.idx - 1]);
};

// int64 - Stored in 9 bytes
// 11010011 XXXXXXXX XXXXXXXX XXXXXXXX XXXXXXXX XXXXXXXX XXXXXXXX XXXXXXXX XXXXXXXX
function unpackInt64(input) {
	input.idx += 9;
	// Due to javascript being super dumb, we can't just shift (all values in a shift
	// operation are converted to int32), so we have to multiply
	return (input.data[input.idx - 8] & 0x80 ? -1 : 1) * 
		   (input.data[input.idx - 8] & 0x7F) * 0x0100000000000000 +
		   (input.data[input.idx - 7]       ) * 0x0001000000000000 +
		   (input.data[input.idx - 6]       ) * 0x0000010000000000 +
		   (input.data[input.idx - 5]       ) * 0x0000000100000000 +
		   (input.data[input.idx - 4]       ) * 0x0000000001000000 +
		   (input.data[input.idx - 3]       ) * 0x0000000000010000 +
		   (input.data[input.idx - 2]       ) * 0x0000000000000100 +
		   (input.data[input.idx - 1]);
};

// nil - Stored in 1 byte
// 0xC0 ~ 11000000
function unpackNil(input) {
	++input.idx;
	return null;
};

// true - Stored in 1 byte
// 0xC3 ~ 11000011
function unpackTrue(input) {
	++input.idx;
	return true;
};

// false - Stored in 1 byte
// 0xC2 ~ 11000010
function unpackFalse(input) {
	++input.idx;
	return false;
};

var denominatorSinglePrecision = 1 / (1 << 23);

// IEEE 754 single precision - Stored in 5 bytes
// 11001010 XXXXXXXX XXXXXXXX XXXXXXXX XXXXXXXX
// Unpacked through a Float32Array view
function unpackFloat(input) {
	input.idx += 5;
	var view = new Float32Array(input.raw.slice(input.idx - 4, input.idx));
	return view[0];
	/*
	// sign exponent (8 bits)  significand (23 bits)
	//  X       XXXXXXXX      XXXXXXXXXXXXXXXXXXXXXXX
	var sign = (input.data[input.idx - 4] & 0x80 ? -1 : 1);
	var exponent = ((input.data[input.idx - 4] << 1) & 0xFF | (input.data[input.idx - 3] >> 7)) - 127;
	var significand = denominatorSinglePrecision * 
					  ((input.data[input.idx - 3] | 0x80) << 16 |
					   (input.data[input.idx - 2]       ) <<  8 |
					   (input.data[input.idx - 1]       ));
	return (exponent >= 0) ? sign * significand * (1 << exponent)
						   : sign * significand / (1 << exponent);
	*/
};

var denominatorDoublePrecision = 1 / (1 << 52);

// IEEE 754 double precision - Stored in 9 bytes
// 11001011 XXXXXXXX XXXXXXXX XXXXXXXX XXXXXXXX XXXXXXXX XXXXXXXX XXXXXXXX XXXXXXXX
function unpackDouble(input) {
	input.idx += 9;
	var view = new Float64Array(input.raw.slice(input.idx - 8, input.idx));
	return view[0];
	/*
	// TODO:  Fix the issues with precision and overflow / underflow
	// sign exponent (11 bits)  significand (52 bits)
	//  X      XXXXXXXXXXX      XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
	var sign = (input.data[input.idx - 8] & 0x80 ? -1 : 1);
	console.log("sign: " + sign);
	var exponent = -1023 +
				   ((input.data[input.idx - 8] & 0x7F) << 4 |
					(input.data[input.idx - 7] >> 4));
	console.log("exponent: " + exponent);
	var significand = denominatorDoublePrecision * 
					  ((input.data[input.idx - 7] & 0x0F | 0x10) << 48 |
					   input.data[input.idx - 6]                 << 40 |
					   input.data[input.idx - 5]                 << 32 |
					   input.data[input.idx - 4]                 << 24 |
					   input.data[input.idx - 3]                 << 16 |
					   input.data[input.idx - 2]                 <<  8 |
					   input.data[input.idx - 1]);
	console.log("significand: " + significand);
	return (exponent >= 0) ? sign * significand * (1 << exponent)
						   : sign * significand / (1 << exponent);
   */
};

// Unpack a map
// There are 3 types of maps, "fixed size", map16, and map32
function unpackMap(input) {
	var mapSize = 0;
	var firstByte = input.data[input.idx];
	// Type flag and size in 1 byte
	if (firstByte <= 0x8F) {
		mapSize = firstByte & 0x0F;
	// Size in the next 2 bytes	
	} else if (firstByte === 0xDE) {
		mapSize = input.data[input.idx + 1] << 8 | input.data[input.idx + 2];
		input.idx += 2;
	// Size in the next 4 bytes
	} else if (firstByte === 0xDF) {
		mapSize = input.data[input.idx + 1] << 24 | 
				  input.data[input.idx + 2] << 16 |
				  input.data[input.idx + 3] <<  8 |
				  input.data[input.idx + 4];
		input.idx += 4;
	}
	 
	var isKey = true;
	var lastKey = null;
	var map = {};
	if (0 === mapSize) {
		++input.idx;
	} else {
		input.idx = unpack(input.raw, input.data, input.idx + 1, mapSize * 2, function handleItem(item) {
			if (isKey) {
				map[item] = undefined;
				lastKey = item;
			} else {
				map[lastKey] = item;
			}
			isKey = !isKey;
		});
	}
	return map;
};

// Unpack an array
// There are 3 types of array encodings, "fixed", array16, and array32
function unpackArray(input) {
	var arraySize = 0;
	var firstByte = input.data[input.idx];
	// Type flag and size in 1 byte
	if (firstByte <= 0x9F) {
		arraySize = firstByte & 0x0F;
	// Size in the next 2 bytes	
	} else if (firstByte === 0xDC) {
		arraySize = input.data[input.idx + 1] << 8 | input.data[input.idx + 2];
		input.idx += 2;
	// Size in the next 4 bytes
	} else if (firstByte === 0xDD) {
		arraySize = input.data[input.idx + 1] << 24 | 
				  input.data[input.idx + 2] << 16 |
				  input.data[input.idx + 3] <<  8 |
				  input.data[input.idx + 4];
		input.idx += 4;
	}

	var array = [];
	if (0 === arraySize) {
		++input.idx;
	} else {
		input.idx = unpack(input.raw, input.data, input.idx + 1, arraySize, function handleItem(item) {
			array.push(item);
		});
	}
	return array;
};

// Fixed size raw (101XXXXX)
// Raw binary length XXXXXb bytes, interpreted as a UTF-8 string
function unpackRaw(input) {
	// From http://en.wikipedia.org/wiki/UTF-8#Description
	// Note that msgpack requires a UTF-8 encoding, while ECMAScript
	// allows either a UTF-16 or a UCS-2 encoding, depending on how
	// the implementer feels.  So, we're limited to at most 3 byte encodings
	// w.r.t. UTF-8.
	var codePoints = [];
	var length = 0;
	var firstByte = input.data[input.idx];
	if (firstByte <= 0xBF) {
		length = firstByte & 0x1F;
	} else if (0xDA === firstByte) {
		length = input.data[input.idx] << 8 |
				 input.data[input.idx];
		input.idx += 2;
	} else if (0xDB === firstByte) {
		length = input.data[input.idx] << 24 |
				 input.data[input.idx] << 16 |
				 input.data[input.idx] <<  8 |
				 input.data[input.idx];
		input.idx += 4;
	}

	var end = input.idx + length;

	var cp;
	while (input.idx < end) {
		cp = input.data[++input.idx];
		// 1 byte code points end at 0x7F
		if (cp > 0x7F) {
			// 2 byte code points' first byte end at 0xDF
			if (cp > 0xDF) {
				// 3 byte sequence is 4 bits from the first byte
				// and 6 bits from the next 2 bytes
				cp = (cp & 0x0F) << 12 |
					 (input.data[++input.idx] & 0x3F) << 6 |
					 (input.data[++input.idx] & 0x3F);
			} else {
				// 2 byte sequence has 5 bits from the first byte
				// and 6 bits from the next byte
				cp = (cp & 0x1F) << 6 |
					 (input.data[++input.idx] & 0x3F);
			}
		}

		codePoints.push(cp);
	}

	// Advance to the next element
	++input.idx;

	return String.fromCharCode.apply(null, codePoints);
};

function unpackError() {
	throw "Error during unpack detected";
};

/**
 *
 * @param {ArrayBuffer} buffer
 * @param {Uint8Array} bytes
 * @param {Number} offset
 * @param {Number} count
 * @param handler
 */
function unpack(buffer, bytes, offset, count, handler) {
	var unpackStruct = {
		idx: offset,
		data: bytes,
		raw: buffer
	};

	if (0 === count) {
		while (unpackStruct.idx < buffer.byteLength) {
			handler(unpackFnMap[bytes[unpackStruct.idx]](unpackStruct));
		}
	} else {
		for (var itemCount = 0; itemCount < count; ++itemCount) {
			handler(unpackFnMap[bytes[unpackStruct.idx]](unpackStruct));
		}
	}

	return unpackStruct.idx;
};

// Types
var TYPES = {
	POSITIVE_FIX_NUM: {
		start: 0x00,
		end:   0x7F
	},
	FIX_MAP: {
		start: 0x80,
		end:   0x8F
	},
	FIX_ARRAY: {
		start: 0x90,
		end:   0x9F
	},
	FIX_RAW: {
		start: 0xA0,
		end:   0xBF
	},
	NIL: 0xC0,
	FALSE: 0xC2,
	TRUE: 0xC3,
	FLOAT: 0xCA,
	DOUBLE: 0xCB,
	UINT_8: 0xCC,
	UNIT_16: 0xCD,
	UINT_32: 0xCE,
	UINT_64: 0xCF,
	INT_8: 0xD0,
	INT_16: 0xD1,
	INT_32: 0xD2,
	INT_64: 0xD3,
	RAW_16: 0xDA,
	RAW_32: 0xDB,
	ARRAY_16: 0xDC,
	ARRAY_32: 0xDD,
	MAP_16: 0xDE,
	MAP_32: 0xDF,
	NEGATIVE_FIX_NUM: {
		start: 0xE0,
		end: 0xFF
	}
};

function pack() {
	throw "WE DO NOT PACK RIGHT NOW";
};

var unpackFnMap = {
	0x00: unpackPositiveFixNum,
	0x01: unpackPositiveFixNum,
	0x02: unpackPositiveFixNum,
	0x03: unpackPositiveFixNum,
	0x04: unpackPositiveFixNum,
	0x05: unpackPositiveFixNum,
	0x06: unpackPositiveFixNum,
	0x07: unpackPositiveFixNum,
	0x08: unpackPositiveFixNum,
	0x09: unpackPositiveFixNum,
	0x0A: unpackPositiveFixNum,
	0x0B: unpackPositiveFixNum,
	0x0C: unpackPositiveFixNum,
	0x0D: unpackPositiveFixNum,
	0x0E: unpackPositiveFixNum,
	0x0F: unpackPositiveFixNum,
	0x10: unpackPositiveFixNum,
	0x11: unpackPositiveFixNum,
	0x12: unpackPositiveFixNum,
	0x13: unpackPositiveFixNum,
	0x14: unpackPositiveFixNum,
	0x15: unpackPositiveFixNum,
	0x16: unpackPositiveFixNum,
	0x17: unpackPositiveFixNum,
	0x18: unpackPositiveFixNum,
	0x19: unpackPositiveFixNum,
	0x1A: unpackPositiveFixNum,
	0x1B: unpackPositiveFixNum,
	0x1C: unpackPositiveFixNum,
	0x1D: unpackPositiveFixNum,
	0x1E: unpackPositiveFixNum,
	0x1F: unpackPositiveFixNum,
	0x20: unpackPositiveFixNum,
	0x21: unpackPositiveFixNum,
	0x22: unpackPositiveFixNum,
	0x23: unpackPositiveFixNum,
	0x24: unpackPositiveFixNum,
	0x25: unpackPositiveFixNum,
	0x26: unpackPositiveFixNum,
	0x27: unpackPositiveFixNum,
	0x28: unpackPositiveFixNum,
	0x29: unpackPositiveFixNum,
	0x2A: unpackPositiveFixNum,
	0x2B: unpackPositiveFixNum,
	0x2C: unpackPositiveFixNum,
	0x2D: unpackPositiveFixNum,
	0x2E: unpackPositiveFixNum,
	0x2F: unpackPositiveFixNum,
	0x30: unpackPositiveFixNum,
	0x31: unpackPositiveFixNum,
	0x32: unpackPositiveFixNum,
	0x33: unpackPositiveFixNum,
	0x34: unpackPositiveFixNum,
	0x35: unpackPositiveFixNum,
	0x36: unpackPositiveFixNum,
	0x37: unpackPositiveFixNum,
	0x38: unpackPositiveFixNum,
	0x39: unpackPositiveFixNum,
	0x3A: unpackPositiveFixNum,
	0x3B: unpackPositiveFixNum,
	0x3C: unpackPositiveFixNum,
	0x3D: unpackPositiveFixNum,
	0x3E: unpackPositiveFixNum,
	0x3F: unpackPositiveFixNum,
	0x40: unpackPositiveFixNum,
	0x41: unpackPositiveFixNum,
	0x42: unpackPositiveFixNum,
	0x43: unpackPositiveFixNum,
	0x44: unpackPositiveFixNum,
	0x45: unpackPositiveFixNum,
	0x46: unpackPositiveFixNum,
	0x47: unpackPositiveFixNum,
	0x48: unpackPositiveFixNum,
	0x49: unpackPositiveFixNum,
	0x4A: unpackPositiveFixNum,
	0x4B: unpackPositiveFixNum,
	0x4C: unpackPositiveFixNum,
	0x4D: unpackPositiveFixNum,
	0x4E: unpackPositiveFixNum,
	0x4F: unpackPositiveFixNum,
	0x50: unpackPositiveFixNum,
	0x51: unpackPositiveFixNum,
	0x52: unpackPositiveFixNum,
	0x53: unpackPositiveFixNum,
	0x54: unpackPositiveFixNum,
	0x55: unpackPositiveFixNum,
	0x56: unpackPositiveFixNum,
	0x57: unpackPositiveFixNum,
	0x58: unpackPositiveFixNum,
	0x59: unpackPositiveFixNum,
	0x5A: unpackPositiveFixNum,
	0x5B: unpackPositiveFixNum,
	0x5C: unpackPositiveFixNum,
	0x5D: unpackPositiveFixNum,
	0x5E: unpackPositiveFixNum,
	0x5F: unpackPositiveFixNum,
	0x60: unpackPositiveFixNum,
	0x61: unpackPositiveFixNum,
	0x62: unpackPositiveFixNum,
	0x63: unpackPositiveFixNum,
	0x64: unpackPositiveFixNum,
	0x65: unpackPositiveFixNum,
	0x66: unpackPositiveFixNum,
	0x67: unpackPositiveFixNum,
	0x68: unpackPositiveFixNum,
	0x69: unpackPositiveFixNum,
	0x6A: unpackPositiveFixNum,
	0x6B: unpackPositiveFixNum,
	0x6C: unpackPositiveFixNum,
	0x6D: unpackPositiveFixNum,
	0x6E: unpackPositiveFixNum,
	0x6F: unpackPositiveFixNum,
	0x70: unpackPositiveFixNum,
	0x71: unpackPositiveFixNum,
	0x72: unpackPositiveFixNum,
	0x73: unpackPositiveFixNum,
	0x74: unpackPositiveFixNum,
	0x75: unpackPositiveFixNum,
	0x76: unpackPositiveFixNum,
	0x77: unpackPositiveFixNum,
	0x78: unpackPositiveFixNum,
	0x79: unpackPositiveFixNum,
	0x7A: unpackPositiveFixNum,
	0x7B: unpackPositiveFixNum,
	0x7C: unpackPositiveFixNum,
	0x7D: unpackPositiveFixNum,
	0x7E: unpackPositiveFixNum,
	0x7F: unpackPositiveFixNum,
	0x80: unpackMap,
	0x81: unpackMap,
	0x82: unpackMap,
	0x83: unpackMap,
	0x84: unpackMap,
	0x85: unpackMap,
	0x86: unpackMap,
	0x87: unpackMap,
	0x88: unpackMap,
	0x89: unpackMap,
	0x8A: unpackMap,
	0x8B: unpackMap,
	0x8C: unpackMap,
	0x8D: unpackMap,
	0x8E: unpackMap,
	0x8F: unpackMap,
	0x90: unpackArray,
	0x91: unpackArray,
	0x92: unpackArray,
	0x93: unpackArray,
	0x94: unpackArray,
	0x95: unpackArray,
	0x96: unpackArray,
	0x97: unpackArray,
	0x98: unpackArray,
	0x99: unpackArray,
	0x9A: unpackArray,
	0x9B: unpackArray,
	0x9C: unpackArray,
	0x9D: unpackArray,
	0x9E: unpackArray,
	0x9F: unpackArray,
	0xA0: unpackRaw,
	0xA1: unpackRaw,
	0xA2: unpackRaw,
	0xA3: unpackRaw,
	0xA4: unpackRaw,
	0xA5: unpackRaw,
	0xA6: unpackRaw,
	0xA7: unpackRaw,
	0xA8: unpackRaw,
	0xA9: unpackRaw,
	0xAA: unpackRaw,
	0xAB: unpackRaw,
	0xAC: unpackRaw,
	0xAD: unpackRaw,
	0xAE: unpackRaw,
	0xAF: unpackRaw,
	0xB0: unpackRaw,
	0xB1: unpackRaw,
	0xB2: unpackRaw,
	0xB3: unpackRaw,
	0xB4: unpackRaw,
	0xB5: unpackRaw,
	0xB6: unpackRaw,
	0xB7: unpackRaw,
	0xB8: unpackRaw,
	0xB9: unpackRaw,
	0xBA: unpackRaw,
	0xBB: unpackRaw,
	0xBC: unpackRaw,
	0xBD: unpackRaw,
	0xBE: unpackRaw,
	0xBF: unpackRaw,
	0xC0: unpackNil,
	0xC1: unpackError,
	0xC2: unpackFalse,
	0xC3: unpackTrue,
	0xC4: unpackError,
	0xC5: unpackError,
	0xC6: unpackError,
	0xC7: unpackError,
	0xC8: unpackError,
	0xC9: unpackError,
	0xCA: unpackFloat,
	0xCB: unpackDouble,
	0xCC: unpackUInt8,
	0xCD: unpackUInt16,
	0xCE: unpackUInt32,
	0xCF: unpackUInt64,
	0xD0: unpackInt8,
	0xD1: unpackInt16,
	0xD2: unpackInt32,
	0xD3: unpackInt64,
	0xD4: unpackError,
	0xD5: unpackError,
	0xD6: unpackError,
	0xD7: unpackError,
	0xD8: unpackError,
	0xD9: unpackError,
	0xDA: unpackRaw,
	0xDB: unpackRaw,
	0xDC: unpackArray,
	0xDD: unpackArray,
	0xDE: unpackMap,
	0xDF: unpackMap,
	0xE0: unpackNegativeFixNum,
	0xE1: unpackNegativeFixNum,
	0xE2: unpackNegativeFixNum,
	0xE3: unpackNegativeFixNum,
	0xE4: unpackNegativeFixNum,
	0xE5: unpackNegativeFixNum,
	0xE6: unpackNegativeFixNum,
	0xE7: unpackNegativeFixNum,
	0xE8: unpackNegativeFixNum,
	0xE9: unpackNegativeFixNum,
	0xEA: unpackNegativeFixNum,
	0xEB: unpackNegativeFixNum,
	0xEC: unpackNegativeFixNum,
	0xED: unpackNegativeFixNum,
	0xEE: unpackNegativeFixNum,
	0xEF: unpackNegativeFixNum,
	0xF0: unpackNegativeFixNum,
	0xF1: unpackNegativeFixNum,
	0xF2: unpackNegativeFixNum,
	0xF3: unpackNegativeFixNum,
	0xF4: unpackNegativeFixNum,
	0xF5: unpackNegativeFixNum,
	0xF6: unpackNegativeFixNum,
	0xF7: unpackNegativeFixNum,
	0xF8: unpackNegativeFixNum,
	0xF9: unpackNegativeFixNum,
	0xFA: unpackNegativeFixNum,
	0xFB: unpackNegativeFixNum,
	0xFC: unpackNegativeFixNum,
	0xFD: unpackNegativeFixNum,
	0xFE: unpackNegativeFixNum,
	0xFF: unpackNegativeFixNum,
};

exports.msgpack = {
	unpack: unpack,
	pack: pack
};

}(this));