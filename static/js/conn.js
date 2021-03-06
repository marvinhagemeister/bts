'use strict';
var conn = (function(on_status, on_change) {
var ws;
var reconnect_duration = 500;
var WS_PATH = '/ws/admin';
var request_id = 1;

var callback_handlers = {};

function _construct_url(abspath) {
	var l = window.location;
	return (
		((l.protocol === 'https:') ? 'wss://' : 'ws://') +
		l.hostname +
		(((l.port !== 80) && (l.port !== 443)) ? ':' + l.port : '') +
		abspath
	);
}

function handle_message(ws_msg) {
	var msg_json = ws_msg.data;
	debug.log('>', msg_json.substring(0, 100));
	var msg = JSON.parse(msg_json);
	if (!msg) {
		send({
			type: 'error',
			message: 'Could not parse message',
		});
	}

	switch (msg.type) {
	case 'answer': {
			const cb = callback_handlers[msg.rid];
			if (! cb) {
				return;
			}
			if (cb(null, msg) !== 'keep') {
				delete callback_handlers[msg.rid];
			}
		}
		break;
	case 'error':
		if (msg.rid) {
			const cb = callback_handlers[msg.rid];
			if (cb) {
				if (cb(msg) !== 'keep') {
					delete callback_handlers[msg.rid];
				}
			}
		}
		on_status({
			code: 'error',
			message: 'Received error message from BTS: ' + msg.message,
		});
		break;
	case 'change':
		on_change(msg);
		break;
	default:
		send({
			type: 'error',
			rid: msg.rid,
			message: 'Unsupported message ' + msg.type,
		});
	}
}

function connect() {
	on_status({
		code: 'connecting',
	});

	ws = new WebSocket(_construct_url(WS_PATH), 'bts-admin');
	ws.onopen = function() {
		on_status({
			code: 'connected',
		});
	};
	ws.onmessage = handle_message;
	ws.onclose = function() {
		// Clear callback handlers
		utils.values(callback_handlers).forEach(function(cb) {
			cb({
				type: 'disconnected',
				message: 'Verbindung verloren',
			});
		});
		callback_handlers = {};

		on_status({
			code: 'waiting',
		});
		setTimeout(connect, reconnect_duration);
	};
}

function send(msg, cb) {
	if (! msg.rid) {
		msg.rid = request_id;
		request_id++;
	}
	if (cb) {
		callback_handlers[msg.rid] = cb;
	}
	const msg_json = JSON.stringify(msg);
	debug.log('<', msg_json);
	ws.send(msg_json);
}

return {
	connect,
	send,
};

});

/*@DEV*/
if ((typeof module !== 'undefined') && (typeof require !== 'undefined')) {
	var WebSocket = require('ws');

	var debug = require('./debug');
	var utils = require('../bup/bup/js/utils.js');

	module.exports = conn;
}
/*/@DEV*/
