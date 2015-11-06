(function () {
	"use strict";

	questkit.goDirection = function (direction) {
		// TODO: Locked exits, exits with scripts
		var foundExit;
		questkit.scopeExits().forEach(function (exit) {
			if (get(exit, 'direction') == direction) {
				foundExit = exit;
				return;
			}
		});

		if (!foundExit) {
			msg(questkit.template('UnresolvedDirection'));
			return;
		}

		questkit.goToExit(foundExit);
	};

	questkit.goToExit = function (exit) {
		// TODO: Locked exits, exits with scripts
		questkit.go(get(exit, 'to'));
	};

	questkit.take = function (objects) {
		objects.forEach(function (object) {
			take(object, objects.length > 1);
		});
	};

	var take = function (object, showName) {
		// TODO: Full conversion

		var template;
		var it = questkit.objectPronoun(object);

		if (get(object, 'parent') == get('pov')) {
			template = 'AlreadyTaken';
		}
		else if (get(object, 'take')) {
			set(object, 'parent', get('pov'));
			template = 'TakeSuccessful';
		}
		else {
			template = 'TakeUnsuccessful';
		}

		msg ((showName ? questkit.displayAlias(object) + ': ' : '') + questkit.template(template).format(it));
	};

	questkit.drop = function (objects) {
		objects.forEach(function (object) {
			drop(object, objects.length > 1);
		});
	};

	var drop = function (object, showName) {
		// TODO: Full conversion

		var template;
		var it = questkit.objectPronoun(object);

		if (questkit.scopeInventory().indexOf(object) == -1) {
			template = 'NotCarrying';
		}
		else if (get(object, 'drop') !== false) {
			set(object, 'parent', questkit.povParent());
			template = 'DropSuccessful';
		}
		else {
			template = 'DropUnsuccessful';
		}

		msg ((showName ? questkit.displayAlias(object) + ': ' : '') + questkit.template(template).format(it));
	};

	//Begin functions added by MarkSill
	questkit.use = function(object, target) {
		var it = questkit.subjectPronoun(object);
		var script;
		if (target) {
			script = getscript(target, "use[" + object + "]");
			if (script) {
				script();
			} else {
				msg(questkit.template("CannotUseOn").format(it, object));
			}
		} else {
			script = getscript(object, "use");
			if (script) {
				script();
			} else {
				msg(questkit.template("CannotUse").format(it));
			}
		}
	};

	questkit.give = function(object, to) {
		var given = false;

		if (!given) {
			msg(questkit.template("DoesNotWant").format(questkit.subjectPronoun(to), questkit.objectPronoun(object)));
		}
	};

	questkit.switch = function(object, mode) {
		set(object + ".switchedon", mode);
	};

	questkit.open = function(object) {
		if (get(object, "container")) {
			if (get(object, "isopen")) {
				msg(questkit.template("AlreadyOpen").format(questkit.subjectPronoun(object)));
			} else {
				msg(questkit.template("Open").format(questkit.subjectPronoun(object)));
				set(object, "isopen", true);
			}
		} else {
			msg(questkit.template("NotContainer").format(questkit.subjectPronoun(object)));
		}
	};

	questkit.close = function(object) {
		if (get(object, "container")) {
			if (get(object, "isopen")) {
				msg(questkit.template("Close").format(questkit.subjectPronoun(object)));
				set(object, "isopen", null);
			} else {
				msg(questkit.template("AlreadyClosed").format(questkit.subjectPronoun(object)));
			}
		} else {
			msg(questkit.template("NotContainer").format(questkit.subjectPronoun(object)));
		}
	};

	questkit.putin = function(object, container) {
		if (get(container, "container")) {
			if (get(container, "isopen")) {
				set(object, "parent", container);
				msg(questkit.template("PutIn").format(questkit.objectPronoun(object), questkit.subjectPronoun(container)));
			} else {
				msg(questkit.template("ContainerClosed").format(questkit.subjectPronoun(container)));
			}
		}
	};
})();
