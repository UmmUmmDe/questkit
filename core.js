/* jshint quotmark: single */

var questkit = {};
questkit.ui = {};

String.prototype.format = function () {
    var args = arguments;
    return this.replace(/{(\d+)}/g, function (match, number) { 
      return typeof args[number] != 'undefined' ? args[number] : match;
    });
};

(function () {
	'use strict';

	var world = {
		attributes: {}
	};

	questkit.init = function (data) {
		world.scripts = data.scripts || {};
		world.objects = data.objects || [];
		world.commands = data.commands || [];
		world.exits = data.exits || [];
		world.regexes = data.regexes || {};
		world.templates = data.templates || {};
		world.walkthroughs = data.walkthroughs || {};

		questkit.startLocation();
		questkit.ui.init();
	};

	questkit.povParent = function () {
		return get(get('pov'), 'parent');
	};

	questkit.allObjects = function () {
		return world.objects;
	};

	questkit.allCommands = function () {
		return world.commands;
	};

	questkit.allExits = function () {
		return world.exits;
	};

	questkit.allWalkthroughs = function () {
		return world.walkthroughs;
	};

	questkit.commandRegex = function (command) {
		return world.regexes[command];
	};

	questkit.displayAlias = function (object) {
		var alias = get(object, 'alias');
		if (alias) return alias;
		return object;
	};

	questkit.subjectPronoun = function (object) {
		return get(object, 'subjectpronoun') || questkit.defaultSubjectPronoun(object);
	};

	questkit.objectPronoun = function (object) {
		return get(object, 'objectpronoun') || questkit.defaultObjectPronoun(object);
	};

	questkit.template = function (template) {
		return world.templates[template];
	};

	// questkit script commmands =====================================================

	questkit.get = function (arg1, arg2) {
		var attribute = arg1;
		if (arg2) {
			attribute = arg1 + '.' + arg2;
		}
		var value = world.attributes[attribute];
		if (value === undefined) return null;
		return JSON.parse(value);
	};

	questkit.set = function (arg1, arg2, arg3) {
		var attribute = arg1;
		var value = arg2;
		if (arg3) {
			attribute = arg1 + '.' + arg2;
			value = arg3;
		}
		world.attributes[attribute] = JSON.stringify(value);
	};

	questkit.getscript = function (arg1, arg2) {
		var attribute = arg1;
		if (arg2) {
			attribute = arg1 + '.' + arg2;
		}
		return world.scripts[attribute];
	};

	questkit.msg = function (text) {
		questkit.ui.addText(text);
	};
})();

var get = questkit.get;
var set = questkit.set;
var getscript = questkit.getscript;
var msg = questkit.msg;

var initData = {
	attributes: {},
	scripts: {},
	objects: [],
	commands: [],
	exits: [],
	regexes: {},
	walkthroughs: [],
};