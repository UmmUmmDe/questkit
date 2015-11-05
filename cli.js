/* jshint quotmark: single */

var readline = require('readline');

(function () {
	'use strict';

	questkit.ui.addText = function (text, singleline) {
		console.log(text);
	};

	questkit.ui.escapeString = function (str) {
		return str;
	};

	questkit.ui.init = function () {
		msg('');
		var rl = readline.createInterface({
			input: process.stdin,
			output: process.stdout
		});

		rl.setPrompt('> ');
		rl.prompt();

		rl.on('line', function(input) {
			if (input == 'q') {
				rl.close();
			}
			else {
				questkit.handleCommand(input);
				console.log('');
				rl.prompt();
			}
		});
	};
})();
